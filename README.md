# google-search-mcp

A Model Context Protocol (MCP) server that provides Google Search functionality.

## 🚀 Features

- **StreamableHTTP Transport**: High-performance and scalable HTTP communication
- **Google Custom Search**: Real-time web search capabilities
- **Secure**: Proper authentication and error handling
- **Health Check**: Standard health check endpoint support

## 🛠 Requirements

- Node.js 18 or higher
- Google Custom Search API key

## 📦 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variables

```bash
GOOGLE_SEARCH_API_KEY=your_actual_google_search_api_key
GOOGLE_CSE_ID=your_actual_custom_search_engine_id

cp env.example .env
```

### 3. Local development

```bash
npm run dev
```

## 🔧 API Endpoints

Once the server is running, the following endpoints are available:

| Endpoint  | Description                |
| --------- | -------------------------- |
| `/mcp`    | MCP protocol communication |
| `/health` | Health check               |
| `/`       | Status                     |

## 🔌 Client Configuration

### Cursor IDE / Claude Desktop Configuration

Example configuration for using the server from MCP clients:

```json
{
  "mcpServers": {
    "google_search": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

## 🧪 Available Tools

### `search`

Performs a web search using the Google Search API.

**Parameters:**

- `query` (string, required): Search query
- `num` (number, optional): Number of results to return (1-10, default: 5)

**Example:**

```json
{
  "name": "search",
  "arguments": {
    "query": "artificial intelligence",
    "num": 5
  }
}
```

## 🔑 Google Custom Search Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Custom Search API
4. Create credentials (API Key)
5. Set up a [Custom Search Engine](https://cse.google.com/cse/all)
6. Get your Search Engine ID

## 📝 Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format
```

---

**Note**: This server is designed for StreamableHTTP mode only. It does not support stdio mode.
