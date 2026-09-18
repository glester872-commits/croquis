import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { usePrefersReducedMotion } from '@/hooks/useMediaPreference'
import { buildAskContext, suggestionsFor } from '@/lib/chat/context'
import { ASK_LIMITS, type AskContext, type AskMessage } from '@/lib/chat/contract'
import { AskStore, useAsk, type AskState, type AskStatus } from '@/lib/chat/store'
import { cn } from '@/lib/utils'

/**
 * Ask Croquis.
 *
 * Not a widget bolted to a corner: a panel that draws in from the edge
 * of the same room, on the same ground, in the same three faces. A
 * question is set in the display serif, like a pull quote; the answer
 * is the working sans at reading size. There are no bubbles, because
 * two voices on one page is a typographic problem, not a shape one.
 *
 * The conversation lives in this provider for as long as the tab does.
 * Navigating between screens keeps it; reloading does not, and nothing
 * is written anywhere.
 */

export function AskProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<readonly AskMessage[]>([])
  const [status, setStatus] = useState<AskStatus>({ kind: 'idle' })
  const { pathname } = useLocation()

  /* The address at the moment of asking, so a question sent while a
     screen is still settling is answered about the screen the reader
     is actually looking at. Written in an effect, never during render. */
  const pathRef = useRef(pathname)
  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  const send = useCallback((question: string) => {
    const asked = question.trim().slice(0, ASK_LIMITS.maxCharsPerMessage)
    if (!asked) return

    setStatus({ kind: 'asking' })
    setMessages((current) => [...current, { role: 'user', content: asked }])

    void (async () => {
      try {
        const context = await buildAskContext(pathRef.current)
        const history = [...messages, { role: 'user' as const, content: asked }].slice(
          -ASK_LIMITS.maxMessages,
        )
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: history, context }),
        })
        const payload: unknown = await response.json().catch(() => null)

        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload
              ? String((payload as { error: unknown }).error)
              : 'El asistente no ha respondido.'
          setStatus({ kind: 'error', message })
          return
        }

        const reply =
          typeof payload === 'object' && payload !== null && 'reply' in payload
            ? String((payload as { reply: unknown }).reply)
            : ''
        if (!reply) {
          setStatus({ kind: 'error', message: 'El asistente no ha respondido.' })
          return
        }
        setMessages((current) => [...current, { role: 'assistant', content: reply }])
        setStatus({ kind: 'idle' })
      } catch {
        setStatus({ kind: 'error', message: 'Sin conexión con el asistente.' })
      }
    })()
  }, [messages])

  const value = useMemo<AskState>(
    () => ({
      open,
      messages,
      status,
      toggle: () => setOpen((was) => !was),
      close: () => setOpen(false),
      send,
    }),
    [open, messages, status, send],
  )

  return <AskStore.Provider value={value}>{children}</AskStore.Provider>
}

/** The way in. A word with a rule under it, like every other act here. */
export function AskTrigger({ className }: { className?: string }) {
  const { open, toggle } = useAsk()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-controls="ask-croquis"
      className={cn('u-meta u-nav-link gap-1.5 hover:text-bone', open && 'border-b-bone text-bone', className)}
    >
      Ask Croquis
      <span aria-hidden>↗</span>
    </button>
  )
}

export function AskPanel() {
  const { open, messages, status, close, send } = useAsk()
  const { pathname } = useLocation()
  const reduced = usePrefersReducedMotion()
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<readonly string[]>([])
  const logRef = useRef<HTMLDivElement | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement | null>(null)

  /* Openers are offered only where the reading can actually answer
     them, so they are resolved from the same context the question
     travels with rather than hard-coded per route. */
  useEffect(() => {
    if (!open) return
    let live = true
    void buildAskContext(pathname).then((context: AskContext) => {
      if (live) setSuggestions(suggestionsFor(context))
    })
    return () => {
      live = false
    }
  }, [open, pathname])

  // The newest turn, always in view.
  useEffect(() => {
    if (!open) return
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [open, messages, status])

  useEffect(() => {
    if (open) fieldRef.current?.focus()
  }, [open])

  // Escape closes, from anywhere inside the panel or out of it.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const submit = () => {
    const asked = draft.trim()
    if (!asked || status.kind === 'asking') return
    setDraft('')
    send(asked)
  }

  if (!open) return null

  return (
    <aside
      id="ask-croquis"
      aria-label="Ask Croquis"
      className={cn(
        // A panel of the same room, drawn in from the right. Full width
        // on a phone, a column on a desktop — never a floating card.
        'fixed inset-0 z-[70] flex flex-col border-studio-600 bg-studio-900',
        'sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[min(440px,42vw)] sm:border-l',
        !reduced && 'u-ask-in',
      )}
    >
      <header className="flex items-center justify-between gap-4 border-b border-studio-600 px-5 py-4 sm:px-6">
        <p className="u-meta text-bone">Ask Croquis</p>
        <button type="button" onClick={close} className="u-meta u-act-word">
          Cerrar
        </button>
      </header>

      <div ref={logRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
        {messages.length === 0 ? (
          <p className="u-label max-w-[34ch]">
            Pregunta sobre el look abierto, tu archivo o una tendencia.
          </p>
        ) : (
          <ol className="space-y-8">
            {messages.map((message, index) => (
              <li key={index}>
                {message.role === 'user' ? (
                  // The question, set as a statement. No bubble, no
                  // avatar: the face and the rule say who is speaking.
                  <p className="border-l border-bone/45 pl-4 font-display text-[19px] leading-snug tracking-[-0.01em] text-bone">
                    {message.content}
                  </p>
                ) : (
                  <div className="space-y-3 text-[14px] leading-relaxed text-bone-dim">
                    {message.content.split(/\n{2,}/).map((para, i) => (
                      <p key={i} className="whitespace-pre-wrap">
                        {para}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {status.kind === 'asking' ? (
          <p role="status" className="u-meta mt-8">
            Leyendo…
          </p>
        ) : null}

        {status.kind === 'error' ? (
          <p role="alert" className="u-label mt-8 text-interpretation">
            {status.message}
          </p>
        ) : null}
      </div>

      {suggestions.length > 0 && messages.length === 0 ? (
        <ul className="flex flex-col border-t border-studio-600">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => send(suggestion)}
                className="flex min-h-11 w-full items-center px-5 py-2 text-left text-[13.5px] text-bone-dim transition-colors duration-(--duration-fast) hover:text-bone sm:px-6"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="border-t border-studio-600 px-5 py-4 sm:px-6"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label className="sr-only" htmlFor="ask-field">
          Tu pregunta
        </label>
        <textarea
          id="ask-field"
          ref={fieldRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a new line. An unmodified
            // Enter in a textarea would otherwise only ever add space.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          rows={2}
          maxLength={ASK_LIMITS.maxCharsPerMessage}
          placeholder="Escribe tu pregunta"
          className="u-field min-h-0 resize-none"
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <span className="u-note">Enter envía · Shift+Enter salta línea</span>
          <button
            type="submit"
            disabled={status.kind === 'asking' || draft.trim().length === 0}
            className="u-act px-5"
          >
            Preguntar
          </button>
        </div>
      </form>
    </aside>
  )
}
