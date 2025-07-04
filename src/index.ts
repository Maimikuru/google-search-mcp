#!/usr/bin/env node

import dotenv from 'dotenv'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import {
  Config,
  responseSchema,
  SearchItem,
} from './type.js'

dotenv.config()

// Validate required environment variables
function validateEnvironment(): Config {
  const googleSearchApiKey = process.env.GOOGLE_SEARCH_API_KEY
  const googleCseId = process.env.GOOGLE_CSE_ID

  if (!googleSearchApiKey || !googleCseId) {
    throw new Error(
      'Required environment variables are missing.',
    )
  }

  return {
    googleSearchApiKey,
    googleCseId,
    port: parseInt(process.env.PORT ?? '3000'), // Default port
  }
}

const config: Config = validateEnvironment()

// Google Custom Search API implementation
export async function customSearch(query: string, num = 5) {
  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', config.googleSearchApiKey)
  url.searchParams.set('cx', config.googleCseId)
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(Math.min(num, 10))) // Limit to max 10 results

  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(
        `Google Search API error: ${res.status} ${res.statusText} - ${errorText}`,
      )
    }

    const data = await res.json()
    const parsedData = responseSchema.safeParse(data)

    if (!parsedData.success) {
      console.error('Failed to parse API response:', parsedData.error)
      return []
    }

    return parsedData.data?.items ?? []
  }
  catch (error) {
    console.error(
      'Search error:',
      error instanceof Error ? error.message : String(error),
    )
    throw error
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'google-search-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// Provide tools list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = [
    {
      name: 'search',
      description:
        ' Performs a web search using the Google Search API, ideal for general queries, news, articles, and online content. Use this for broad information gathering, recent events, or when you need diverse web sources．',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          num: {
            type: 'number',
            description: 'Number of results to return (1-10, default: 5)',
            minimum: 1,
            maximum: 10,
            default: 5,
          },
        },
        required: ['query'],
      },
    },
  ]

  return { tools }
})

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async request => {
  if (request.params.name === 'search') {
    const { query, num = 5 } = request.params.arguments as {
      query: string
      num?: number
    }

    try {
      const results = await customSearch(query, num)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                query,
                resultsCount: results.length,
                results: results.map((item: SearchItem) => ({
                  title: item.title,
                  url: item.link,
                  snippet: item.snippet,
                  metadata: {
                    ogTitle: item.pagemap?.metatags?.[0]?.['og:title'],
                    ogDescription: item.pagemap?.metatags?.[0]
                      ?.['og:description'],
                    ogImage: item.pagemap?.metatags?.[0]?.['og:image'],
                  },
                })),
              },
              null,
              2,
            ),
          },
        ],
      }
    }
    catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Search error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`)
})

// Server startup process
async function main() {
  console.log('Starting google-search-mcp server')

  const app = express()

  // Parse JSON request body
  app.use(express.json({ limit: '10mb' }))

  // Request logging (development only)
  if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`)
      next()
    })
  }

  // Create StreamableHTTPServerTransport (stateless)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Set to undefined for stateless server
    enableJsonResponse: true, // Support both HTTP JSON response and SSE streaming
  })

  // Connect MCP server to transport
  await server.connect(transport)
  console.log('MCP server connected to transport')

  // MCP endpoint (StreamableHTTP)
  // Handle MCP communication via POST requests
  app.post('/mcp', async (req, res) => {
    try {
      await transport.handleRequest(req, res, req.body)
    }
    catch (error) {
      console.error(
        'MCP request handling error:',
        error instanceof Error ? error.message : String(error),
      )
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        })
      }
    }
  })

  // GET requests return 405 for SSE endpoint compatibility
  app.get('/mcp', (req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed. Use POST for Streamable HTTP.',
      },
      id: null,
    })
  })

  // DELETE requests return 405 for stateless server
  app.delete('/mcp', (req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message:
          'Method not allowed. Stateless server does not support session termination.',
      },
      id: null,
    })
  })

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      mode: 'streamable-http',
      config: {
        googleApiConfigured: true, // Checked at startup
        port: config.port,
      },
    })
  })

  // Root endpoint (minimal info for security)
  app.get('/', (req, res) => {
    res.json({ status: 'ok' })
  })

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found',
    })
  })

  // Error handler
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error('Express error:', err.message)
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development'
          ? err.message
          : 'An internal server error occurred',
      })
    },
  )

  // Start HTTP server
  const httpServer = app.listen(config.port, '0.0.0.0', () => {
    console.log(`google-search-mcp server started (port: ${config.port})`)
  })

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`Received ${signal} signal. Shutting down server...`)
    httpServer.close(err => {
      if (err) {
        console.error('Server shutdown error:', err.message)
        process.exit(1)
      }
      else {
        console.log('Server shut down gracefully')
        process.exit(0)
      }
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

// Error handling
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error.message, error.stack)
  process.exit(1)
})

process.on('unhandledRejection', (reason, _promise) => {
  console.error('Unhandled promise rejection:', String(reason))
  process.exit(1)
})

// Execute main process
main().catch(error => {
  console.error('Server startup error:', error.message, error.stack)
  process.exit(1)
})
