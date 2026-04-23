'use client'
import { useEffect, useRef, useState } from 'react'
import { useChat, type UIToolEvent } from '@/hooks/useChat'

type Props = {
  open:      boolean
  onClose:   () => void
  boardSid?: number
}

const TOOL_LABELS: Record<string, string> = {
  search_items:       'Buscando items',
  get_item:           'Leyendo item',
  create_item:        'Creando item',
  update_item:        'Actualizando item',
  change_stage:       'Cambiando etapa',
  add_message:        'Enviando mensaje',
  list_boards:        'Listando boards',
  get_board_summary:  'Calculando resumen',
}

export default function ChatPanel({ open, onClose, boardSid }: Props) {
  const { messages, sendMessage, sending, error, reset } = useChat(boardSid)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (open) textareaRef.current?.focus()
  }, [open])

  if (!open) return null

  const handleSubmit = () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    sendMessage(text)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-[420px] max-w-[100vw] flex flex-col bg-[var(--surface)] border-l border-[var(--border)] shadow-[var(--shadow-lg)]"
        role="dialog"
        aria-label="Asistente Tratto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] bg-[var(--brand)] text-[var(--brand-ink)] font-bold text-[12px]">
              T
            </div>
            <div>
              <div className="text-[13.5px] font-semibold text-[var(--ink)] leading-tight">Asistente Tratto</div>
              <div className="text-[11px] text-[var(--ink-3)] leading-tight">Experimental</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                className="text-[11.5px] text-[var(--ink-3)] hover:text-[var(--ink)] px-2 py-1 rounded transition-colors"
                title="Nueva conversación"
              >
                Limpiar
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--surface-2)] text-[var(--ink-3)]"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="text-[13px] text-[var(--ink-3)] mt-8 text-center">
              <div className="mb-2">Pregunta lo que necesites:</div>
              <ul className="text-[12px] text-[var(--ink-4)] space-y-1">
                <li>· &quot;oportunidades en costeo&quot;</li>
                <li>· &quot;crea un contacto María García&quot;</li>
                <li>· &quot;cuánto hay en el pipeline&quot;</li>
              </ul>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-1.5'}>
              {msg.role === 'user' ? (
                <div className="max-w-[85%] px-3 py-2 rounded-[var(--radius)] bg-[var(--brand)] text-[var(--brand-ink)] text-[13px] whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              ) : (
                <>
                  {msg.tools.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {msg.tools.map(tool => <ToolPill key={tool.callId} tool={tool} />)}
                    </div>
                  )}
                  {(msg.content || !msg.streaming) && (
                    <div className="px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-2)] text-[13px] text-[var(--ink)] whitespace-pre-wrap break-words">
                      {msg.content}
                      {msg.streaming && <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-[var(--ink-3)] animate-pulse" />}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {error && (
            <div className="px-3 py-2 rounded border border-red-300 bg-red-50 text-[12px] text-red-800">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              disabled={sending}
              rows={1}
              maxLength={500}
              placeholder="Pregunta algo…"
              className="flex-1 resize-none px-3 py-2 text-[13px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand)] disabled:opacity-60"
              style={{ maxHeight: 120 }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || sending}
              className="px-3 py-2 rounded-[var(--radius)] bg-[var(--brand)] text-[var(--brand-ink)] text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            >
              {sending ? '…' : '↑'}
            </button>
          </div>
          <div className="text-[10.5px] text-[var(--ink-4)] mt-1.5 px-1">
            Enter envía · Shift+Enter salto de línea · máx 500 chars
          </div>
        </div>
      </div>
    </>
  )
}

function ToolPill({ tool }: { tool: UIToolEvent }) {
  const label = TOOL_LABELS[tool.name] ?? tool.name
  const isRunning = tool.status === 'running'
  const isError = tool.status === 'error'

  return (
    <div className={[
      'inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded w-fit',
      isError
        ? 'bg-red-50 text-red-800 border border-red-200'
        : 'bg-[var(--surface-2)] text-[var(--ink-3)] border border-[var(--border)]',
    ].join(' ')}>
      {isRunning ? (
        <span className="inline-block w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" />
      ) : isError ? (
        <span>⚠</span>
      ) : (
        <span className="text-[var(--brand)]">✓</span>
      )}
      <span>{label}</span>
      {isError && tool.error && <span className="opacity-70">— {truncate(tool.error, 40)}</span>}
    </div>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
