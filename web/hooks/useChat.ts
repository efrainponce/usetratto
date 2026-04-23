'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type UIToolEvent = {
  callId: string
  name:   string
  input:  unknown
  status: 'running' | 'done' | 'error'
  output?: unknown
  error?:  string
}

export type UIMessage =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; content: string; tools: UIToolEvent[]; streaming: boolean }

const SS_KEY = 'tratto_chat_session_id'

export function useChat(boardSid?: number) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionIdRef.current = sessionStorage.getItem(SS_KEY)
  }, [])

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
    sessionIdRef.current = null
    if (typeof window !== 'undefined') sessionStorage.removeItem(SS_KEY)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setError(null)
    setSending(true)

    const userId = crypto.randomUUID()
    const assistantId = crypto.randomUUID()

    setMessages(prev => [
      ...prev,
      { id: userId, role: 'user', content: trimmed },
      { id: assistantId, role: 'assistant', content: '', tools: [], streaming: true },
    ])

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:   trimmed,
          sessionId: sessionIdRef.current ?? undefined,
          boardSid,
        }),
      })

      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => 'Error del asistente')
        throw new Error(msg || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const json = line.slice(5).trim()
          if (!json) continue
          let ev: any
          try { ev = JSON.parse(json) } catch { continue }

          handleEvent(ev, assistantId)
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error del asistente')
      setMessages(prev => prev.map(m =>
        m.id === assistantId && m.role === 'assistant'
          ? { ...m, streaming: false, content: m.content || '[error]' }
          : m,
      ))
    } finally {
      setSending(false)
    }

    function handleEvent(ev: any, msgId: string) {
      if (ev.type === 'session' && ev.sessionId) {
        sessionIdRef.current = ev.sessionId
        if (typeof window !== 'undefined') sessionStorage.setItem(SS_KEY, ev.sessionId)
        return
      }
      if (ev.type === 'text_delta') {
        setMessages(prev => prev.map(m =>
          m.id === msgId && m.role === 'assistant'
            ? { ...m, content: m.content + ev.delta }
            : m,
        ))
        return
      }
      if (ev.type === 'tool_start') {
        setMessages(prev => prev.map(m =>
          m.id === msgId && m.role === 'assistant'
            ? { ...m, tools: [...m.tools, { callId: ev.callId, name: ev.name, input: ev.input, status: 'running' }] }
            : m,
        ))
        return
      }
      if (ev.type === 'tool_end') {
        setMessages(prev => prev.map(m =>
          m.id === msgId && m.role === 'assistant'
            ? {
                ...m,
                tools: m.tools.map(t =>
                  t.callId === ev.callId
                    ? { ...t, status: ev.error ? 'error' : 'done', output: ev.output, error: ev.error }
                    : t,
                ),
              }
            : m,
        ))
        return
      }
      if (ev.type === 'done') {
        setMessages(prev => prev.map(m =>
          m.id === msgId && m.role === 'assistant'
            ? { ...m, streaming: false, content: ev.text || m.content }
            : m,
        ))
        return
      }
      if (ev.type === 'error') {
        setError(ev.message)
        setMessages(prev => prev.map(m =>
          m.id === msgId && m.role === 'assistant'
            ? { ...m, streaming: false, content: m.content || '[error]' }
            : m,
        ))
      }
    }
  }, [sending, boardSid])

  return { messages, sendMessage, sending, error, reset }
}
