'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useChat, type UIToolEvent } from '@/hooks/useChat'

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

const SUGGESTED_PROMPTS = [
  'oportunidades en costeo',
  'crea contacto María García, 5512345678',
  'resumen del pipeline',
]

export default function ChatRail() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [width, setWidth] = useState(380)
  const [mounted, setMounted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  const boardSid = pathname.match(/\/b\/(\d+)/) ? parseInt(pathname.match(/\/b\/(\d+)/)![1], 10) : undefined
  const { messages, sendMessage, sending, error, reset } = useChat(boardSid)
  const [input, setInput] = useState('')

  useEffect(() => {
    setMounted(true)
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('chat_collapsed') : null
    const storedWidth = typeof window !== 'undefined' ? window.localStorage.getItem('chat_width') : null

    if (!stored && typeof window !== 'undefined' && window.innerWidth < 1280) {
      setCollapsed(true)
    } else if (stored === '1') {
      setCollapsed(true)
    } else if (stored === '0') {
      setCollapsed(false)
    }

    if (storedWidth) {
      const parsed = parseInt(storedWidth, 10)
      if (!isNaN(parsed)) {
        const clamped = Math.max(320, Math.min(560, parsed))
        setWidth(clamped)
      }
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!collapsed) textareaRef.current?.focus()
  }, [collapsed])

  const toggleCollapse = () => {
    setCollapsed(!collapsed)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('chat_collapsed', collapsed ? '0' : '1')
    }
  }

  const handleSubmit = () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    sendMessage(text)
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      const newWidth = window.innerWidth - moveEvent.clientX
      const clamped = Math.max(320, Math.min(560, newWidth))
      setWidth(clamped)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('chat_width', width.toString())
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleChipClick = (prompt: string) => {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  if (!mounted) return null

  return (
    <aside
      className="border-l border-[var(--border)] bg-[var(--surface)] h-screen flex-none flex flex-col relative"
      style={{ width: collapsed ? '36px' : `${width}px` }}
    >
      {!collapsed && (
        <div className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--brand)]/40 transition-colors" onMouseDown={handleResizeStart} ref={resizeRef} />
      )}

      {collapsed ? (
        <div className="h-full flex flex-col items-center gap-2 py-3 cursor-pointer" onClick={toggleCollapse}>
          <button
            className="w-7 h-7 flex items-center justify-center text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
            title="Expandir asistente"
          >
            &lt;
          </button>
        </div>
      ) : (
        <>
          <div className="h-[56px] flex-none flex items-center justify-between px-4 border-b border-[var(--border)]">
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
                onClick={toggleCollapse}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--surface-2)] text-[var(--ink-3)] transition-colors"
                title="Colapsar"
              >
                &gt;
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="text-[13px] text-[var(--ink-3)] text-center">
                  Pregunta lo que necesites:
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChipClick(prompt)}
                      className="text-[12px] px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--ink-3)] transition-colors whitespace-nowrap"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
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
              ))
            )}

            {error && (
              <div className="px-3 py-2 rounded border border-red-300 bg-red-50 text-[12px] text-red-800">
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)] p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  const el = e.target
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 144) + 'px'
                }}
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
                style={{ maxHeight: 144 }}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || sending}
                className="px-3 py-2 rounded-[var(--radius)] bg-[var(--brand)] text-[var(--brand-ink)] text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex-none"
              >
                {sending ? '…' : '↑'}
              </button>
            </div>
            <div className="text-[10.5px] text-[var(--ink-4)] mt-1.5 px-1">
              Enter envía · Shift+Enter salto de línea · máx 500 chars
            </div>
          </div>
        </>
      )}
    </aside>
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
