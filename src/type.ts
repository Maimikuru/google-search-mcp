import { z } from 'zod'

// Cloud Run configuration
export interface Config {
  googleSearchApiKey: string
  googleCseId: string
  port: number
}

// Google Search API response type definition
export const responseSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string(),
        link: z.string(),
        snippet: z.string().optional(),
        pagemap: z
          .object({
            metatags: z
              .array(
                z.object({
                  'og:title': z.string().optional(),
                  'og:description': z.string().optional(),
                  'og:image': z.string().optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
})

// Search result type definitions (inferred)
export type SearchResponse = z.infer<typeof responseSchema>
export type SearchItem = NonNullable<SearchResponse['items']>[0]
