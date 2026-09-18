import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * `/api/*` during `npm run dev`.
 *
 * In production Vercel runs the files in `api/` as functions; the Vite
 * dev server knows nothing about them, so `npm run dev` would answer
 * the panel's fetch with index.html. This mounts the same handler on
 * the dev server and gives it the two things the Vercel runtime adds
 * over a plain Node request: a parsed `body`, and `status()`/`json()`.
 *
 * The handler is loaded through `ssrLoadModule`, so it is the very file
 * that ships — edited, it reloads like everything else.
 */
function devApi(): Plugin {
  return {
    name: 'croquis-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/chat', (request, response, next) => {
        void (async () => {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of request) chunks.push(chunk as Buffer)
            const raw = Buffer.concat(chunks).toString('utf8')

            const shimmed = Object.assign(request, {
              body: raw ? (JSON.parse(raw) as unknown) : undefined,
              query: {},
              cookies: {},
            })
            const replied = Object.assign(response, {
              status(code: number) {
                response.statusCode = code
                return replied
              },
              json(payload: unknown) {
                response.setHeader('content-type', 'application/json')
                response.end(JSON.stringify(payload))
                return replied
              },
            })

            const module = (await server.ssrLoadModule('/api/chat.ts')) as {
              default: (req: unknown, res: unknown) => Promise<unknown>
            }
            await module.default(shimmed, replied)
          } catch (caught) {
            server.config.logger.error(`[api/chat] ${String(caught)}`)
            if (!response.writableEnded) {
              response.statusCode = 500
              response.setHeader('content-type', 'application/json')
              response.end(JSON.stringify({ error: 'Algo ha fallado al preguntar.' }))
            }
            next()
          }
        })()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
