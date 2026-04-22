'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDisclosure } from '../hooks/useDisclosure'

// ─── Types ────────────────────────────────────────────────────────────────────

type Visibility = 'public' | 'private'

type Channel = {
  id: string
  name: string
  type: 'internal' | 'system'
  visibility: Visibility
  members?: string[]
}

type Attachment = {
  id: string
  file_name: string
  mime_type: string
  size_bytes: number
  url: string | null
}

type Message = {
  id: string
  channel_id: string
  user_id: string | null
  body: string
  type: 'text' | 'system' | 'whatsapp'
  metadata: Record<string, unknown>
  created_at: string
  users: { id: string; name: string | null; phone: string | null } | null
  attachments?: Attachment[]
}

type WorkspaceUser = {
  id: string
  sid: number
  name: string | null
  phone: string | null
}

type Props = {
  itemId: string
  workspaceUsers: WorkspaceUser[]
}

type PendingAttachment = {
  file: File
  localId: string
  status: 'uploading' | 'ready' | 'error'
  errorMsg?: string
  uploaded?: { file_path: string; file_name: string; mime_type: string; size_bytes: number }
}

const MAX_FILE_SIZE = 25 * 1024 * 1024

// ─── Component ────────────────────────────────────────────────────────────────

export function ItemChannels({ itemId, workspaceUsers }: Props) {
  // Channel state
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [channelsError, setChannelsError] = useState<string | null>(null)

  // Channel editing state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelVisibility, setNewChannelVisibility] = useState<Visibility>('public')

  // Message state
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Message input state
  const [inputValue, setInputValue] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mention picker state
  const { isOpen: showMentionPicker, open: openMentionPicker, close: closeMentionPicker } = useDisclosure(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStartPos, setMentionStartPos] = useState(0)
  const mentionPickerRef = useRef<HTMLDivElement>(null)

  // Members modal state
  const { isOpen: showMembersModal, open: openMembersModal, close: closeMembersModal } = useDisclosure(false)
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)

  // ── Load channels on mount ──────────────────────────────────────────────────

  const reloadChannels = useCallback(async () => {
    const res = await fetch(`/api/channels?itemId=${itemId}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { channels: Channel[] }
    setChannels(data.channels ?? [])
    return data.channels ?? []
  }, [itemId])

  useEffect(() => {
    const loadChannels = async () => {
      setLoadingChannels(true)
      setChannelsError(null)
      try {
        const list = await reloadChannels()
        if (list.length > 0) setSelectedChannelId(prev => prev ?? list[0].id)
      } catch (e) {
        setChannelsError(e instanceof Error ? e.message : 'Error loading channels')
      } finally {
        setLoadingChannels(false)
      }
    }
    loadChannels()
  }, [reloadChannels])

  // ── Load messages when channel changes ──────────────────────────────────────

  useEffect(() => {
    if (!selectedChannelId) return

    const fetchMessages = async (initial: boolean) => {
      if (initial) { setLoadingMessages(true); setMessagesError(null) }
      try {
        const res = await fetch(`/api/channels/${selectedChannelId}/messages`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { messages: Message[] }
        const sorted = (data.messages ?? []).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        // Only update state if something actually changed (avoids rerender flash on poll)
        setMessages(prev => {
          const lastPrev = prev[prev.length - 1]?.id
          const lastNew  = sorted[sorted.length - 1]?.id
          return lastPrev === lastNew && prev.length === sorted.length ? prev : sorted
        })
      } catch (e) {
        if (initial) setMessagesError(e instanceof Error ? e.message : 'Error loading messages')
      } finally {
        if (initial) setLoadingMessages(false)
      }
    }

    fetchMessages(true)

    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    pollIntervalRef.current = setInterval(() => fetchMessages(false), 8000)

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [selectedChannelId])

  // Reset pending attachments when switching channels
  useEffect(() => {
    setPendingAttachments([])
    setSendError(null)
  }, [selectedChannelId])

  // ── Auto-scroll to bottom ──────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Handle message input ───────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputValue(value)

    const cursorPos = e.target.selectionStart
    const lastAtIndex = value.lastIndexOf('@', cursorPos - 1)

    if (lastAtIndex !== -1) {
      const afterAt = value.substring(lastAtIndex + 1, cursorPos)
      if (/^[a-zA-Z0-9\s]*$/.test(afterAt) && !afterAt.includes('\n')) {
        setMentionQuery(afterAt)
        setMentionStartPos(lastAtIndex)
        openMentionPicker()
      } else {
        closeMentionPicker()
      }
    } else {
      closeMentionPicker()
    }

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 72)}px`
      }
    })
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && (inputValue.trim() || pendingAttachments.some(a => a.status === 'ready'))) {
      e.preventDefault()
      handleSendMessage()
    }
    if (e.key === 'Escape' && showMentionPicker) {
      e.preventDefault()
      closeMentionPicker()
    }
  }

  const handleMentionClick = (user: WorkspaceUser) => {
    const mention = `@[${user.name ?? user.phone}](${user.sid})`
    const before = inputValue.substring(0, mentionStartPos)
    const after = inputValue.substring(mentionStartPos + mentionQuery.length + 1)
    setInputValue(before + mention + after)
    closeMentionPicker()
    setMentionQuery('')
  }

  // ── File upload ────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (channelId: string, localId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/api/channels/${channelId}/attachments`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { file_path: string; file_name: string; mime_type: string; size_bytes: number }
      setPendingAttachments(prev =>
        prev.map(a => a.localId === localId ? { ...a, status: 'ready', uploaded: data } : a)
      )
    } catch (e) {
      setPendingAttachments(prev =>
        prev.map(a => a.localId === localId
          ? { ...a, status: 'error', errorMsg: e instanceof Error ? e.message : 'Error al subir' }
          : a
        )
      )
    }
  }, [])

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files || !selectedChannelId) return

    const accepted: PendingAttachment[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setSendError(`"${file.name}" excede 25MB`)
        continue
      }
      accepted.push({
        file,
        localId: crypto.randomUUID(),
        status: 'uploading',
      })
    }

    if (accepted.length === 0) return
    setPendingAttachments(prev => [...prev, ...accepted])
    setSendError(null)
    accepted.forEach(a => uploadFile(selectedChannelId, a.localId, a.file))
  }, [selectedChannelId, uploadFile])

  const handleRemoveAttachment = (localId: string) => {
    setPendingAttachments(prev => prev.filter(a => a.localId !== localId))
  }

  const handleSendMessage = useCallback(async () => {
    if (!selectedChannelId) return
    const trimmed = inputValue.trim()
    const readyUploads = pendingAttachments.filter(a => a.status === 'ready' && a.uploaded)
    if (!trimmed && readyUploads.length === 0) return
    if (pendingAttachments.some(a => a.status === 'uploading')) {
      setSendError('Espera a que terminen de subir los archivos')
      return
    }

    const savedBody = trimmed
    const savedAttachments = readyUploads

    setInputValue('')
    setPendingAttachments([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setSendError(null)

    try {
      const res = await fetch(`/api/channels/${selectedChannelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: savedBody,
          attachments: savedAttachments.map(a => a.uploaded!),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).error ?? `HTTP ${res.status}`)
      }

      const messagesRes = await fetch(`/api/channels/${selectedChannelId}/messages`)
      if (messagesRes.ok) {
        const data = (await messagesRes.json()) as { messages: Message[] }
        setMessages((data.messages ?? []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Error al enviar')
      setInputValue(savedBody)
      setPendingAttachments(savedAttachments)
    }
  }, [selectedChannelId, inputValue, pendingAttachments])

  // ── Channel management ─────────────────────────────────────────────────────

  const handleCreateChannel = useCallback(async () => {
    if (!newChannelName.trim()) return
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          name: newChannelName.trim(),
          visibility: newChannelVisibility,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const newChannel = (await res.json()) as Channel
      setChannels(c => [...c, newChannel])
      setSelectedChannelId(newChannel.id)
      setNewChannelName('')
      setNewChannelVisibility('public')
      setCreatingNew(false)
    } catch (e) {
      console.error('Error creating channel:', e)
    }
  }, [itemId, newChannelName, newChannelVisibility])

  const handleRenameChannel = useCallback(async (channelId: string) => {
    if (!renameValue.trim()) return
    try {
      const res = await fetch(`/api/channels/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setChannels(c => c.map(ch => ch.id === channelId ? { ...ch, name: renameValue.trim() } : ch))
      setRenamingId(null)
      setRenameValue('')
    } catch (e) {
      console.error('Error renaming channel:', e)
    }
  }, [renameValue])

  const handleToggleVisibility = useCallback(async (channelId: string, next: Visibility) => {
    try {
      const res = await fetch(`/api/channels/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reloadChannels()
    } catch (e) {
      console.error('Error toggling visibility:', e)
    }
  }, [reloadChannels])

  const handleDeleteChannel = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`/api/channels/${channelId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setChannels(c => c.filter(ch => ch.id !== channelId))
      setSelectedChannelId(prev => prev === channelId ? null : prev)
    } catch (e) {
      console.error('Error deleting channel:', e)
    }
  }, [])

  const handleAddMember = useCallback(async (channelId: string, userId: string) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reloadChannels()
    } catch (e) {
      console.error('Error adding member:', e)
    }
  }, [reloadChannels])

  const handleRemoveMember = useCallback(async (channelId: string, userId: string) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reloadChannels()
    } catch (e) {
      console.error('Error removing member:', e)
    }
  }, [reloadChannels])

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedChannel = channels.find(c => c.id === selectedChannelId)
  const isSystemChannel = selectedChannel?.type === 'system'
  const hasReadyAttachments = pendingAttachments.some(a => a.status === 'ready')
  const hasUploadingAttachments = pendingAttachments.some(a => a.status === 'uploading')
  const canSend = !isSystemChannel && (inputValue.trim().length > 0 || hasReadyAttachments) && !hasUploadingAttachments

  const filteredMentions = mentionQuery.trim()
    ? workspaceUsers.filter(u => (u.name ?? '').toLowerCase().includes(mentionQuery.toLowerCase()))
    : workspaceUsers

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* ── Left panel: Channel list ──────────────────────────────────────── */}
      <div className="w-48 flex-none border-r border-gray-100 bg-gray-50 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loadingChannels ? (
            <div className="text-[13px] text-gray-400 py-2">Cargando...</div>
          ) : channelsError ? (
            <div className="text-[13px] text-red-500 py-2">{channelsError}</div>
          ) : (
            <div className="space-y-1">
              {channels.map(channel => (
                <div
                  key={channel.id}
                  className="group relative"
                  onMouseLeave={() => setContextMenuId(null)}
                >
                  <button
                    onClick={() => {
                      setSelectedChannelId(channel.id)
                      setContextMenuId(null)
                    }}
                    onContextMenu={e => {
                      e.preventDefault()
                      setContextMenuId(channel.id)
                    }}
                    className={`w-full text-left text-[13px] px-2 py-1.5 rounded truncate transition-colors ${
                      selectedChannelId === channel.id
                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {renamingId === channel.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => { handleRenameChannel(channel.id) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameChannel(channel.id)
                          if (e.key === 'Escape') {
                            setRenamingId(null)
                            setRenameValue('')
                          }
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-transparent outline-none border-b border-indigo-400"
                      />
                    ) : (
                      <>
                        <span className="mr-1">
                          {channel.type === 'system' ? '⊙' : channel.visibility === 'private' ? '🔒' : '#'}
                        </span>
                        <span>{channel.name}</span>
                      </>
                    )}
                  </button>

                  {/* Context menu */}
                  {contextMenuId === channel.id && channel.type !== 'system' && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-md z-50 min-w-max">
                      <button
                        onClick={() => {
                          setRenamingId(channel.id)
                          setRenameValue(channel.name)
                          setContextMenuId(null)
                        }}
                        className="block w-full text-left px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-100"
                      >
                        Renombrar
                      </button>
                      <button
                        onClick={() => {
                          handleToggleVisibility(channel.id, channel.visibility === 'private' ? 'public' : 'private')
                          setContextMenuId(null)
                        }}
                        className="block w-full text-left px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-100"
                      >
                        {channel.visibility === 'private' ? 'Hacer público' : 'Hacer privado'}
                      </button>
                      <button
                        onClick={() => {
                          openMembersModal()
                          setContextMenuId(null)
                        }}
                        className="block w-full text-left px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-100"
                      >
                        Miembros
                      </button>
                      <button
                        onClick={() => {
                          handleDeleteChannel(channel.id)
                          setContextMenuId(null)
                        }}
                        className="block w-full text-left px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New channel button */}
        {!creatingNew ? (
          <button
            onClick={() => setCreatingNew(true)}
            className="mx-2 mb-2 text-[12px] px-2 py-1.5 rounded border border-dashed border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors flex-none"
          >
            + Canal
          </button>
        ) : (
          <div className="mx-2 mb-2 flex-none space-y-1.5">
            <input
              autoFocus
              type="text"
              value={newChannelName}
              onChange={e => setNewChannelName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateChannel()
                if (e.key === 'Escape') {
                  setCreatingNew(false)
                  setNewChannelName('')
                  setNewChannelVisibility('public')
                }
              }}
              placeholder="Nombre del canal"
              className="w-full text-[12px] px-2 py-1.5 rounded border border-indigo-300 outline-none"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setNewChannelVisibility('public')}
                className={`flex-1 text-[11px] px-2 py-1 rounded border transition-colors ${
                  newChannelVisibility === 'public'
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                # Público
              </button>
              <button
                type="button"
                onClick={() => setNewChannelVisibility('private')}
                className={`flex-1 text-[11px] px-2 py-1 rounded border transition-colors ${
                  newChannelVisibility === 'private'
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                🔒 Privado
              </button>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim()}
                className="flex-1 text-[11px] px-2 py-1 rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:bg-gray-300"
              >
                Crear
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingNew(false)
                  setNewChannelName('')
                  setNewChannelVisibility('public')
                }}
                className="flex-1 text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Main: Message thread ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with channel name + privacy indicator */}
        {selectedChannel && (
          <div className="flex-none border-b border-gray-100 px-4 py-2 flex items-center gap-2">
            <span className="text-[13px] font-semibold text-gray-900">
              {selectedChannel.type === 'system' ? '⊙' : selectedChannel.visibility === 'private' ? '🔒' : '#'} {selectedChannel.name}
            </span>
            {selectedChannel.type !== 'system' && (
              <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                selectedChannel.visibility === 'private'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {selectedChannel.visibility === 'private' ? 'Privado' : 'Público'}
              </span>
            )}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loadingMessages ? (
            <div className="text-[13px] text-gray-400 py-2">Cargando mensajes...</div>
          ) : messagesError ? (
            <div className="text-[13px] text-red-500 py-2">{messagesError}</div>
          ) : messages.length === 0 ? (
            <div className="text-[13px] text-gray-400 py-2">Sin mensajes</div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`text-[13px] ${msg.type === 'system' ? 'text-gray-500 italic' : ''}`}>
                <div className="flex gap-2">
                  {msg.type !== 'system' && (
                    <div className="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center flex-none text-[11px] font-semibold text-indigo-700">
                      {(msg.users?.name ?? msg.users?.phone ?? '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {msg.type !== 'system' && (
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-gray-900">{msg.users?.name ?? msg.users?.phone ?? 'Usuario'}</span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    {msg.body && (
                      <div className="text-gray-700 break-words whitespace-pre-wrap">
                        {renderBody(msg.body)}
                      </div>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {msg.attachments.map(att => <AttachmentView key={att.id} attachment={att} />)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="flex-none border-t border-gray-100 px-4 py-3 bg-white relative">
          {sendError && (
            <div className="text-[12px] text-red-500 mb-1.5">{sendError}</div>
          )}

          {/* Pending attachments */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pendingAttachments.map(att => (
                <div
                  key={att.localId}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] border ${
                    att.status === 'error'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : att.status === 'uploading'
                      ? 'bg-gray-50 border-gray-200 text-gray-500'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  }`}
                  title={att.errorMsg ?? att.file.name}
                >
                  <span>
                    {att.status === 'uploading' ? '⏳' : att.status === 'error' ? '⚠' : '📎'}
                  </span>
                  <span className="max-w-[140px] truncate">{att.file.name}</span>
                  <span className="text-gray-400">{formatSize(att.file.size)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.localId)}
                    className="ml-0.5 text-gray-400 hover:text-gray-700"
                    aria-label="Quitar"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={e => {
                handleFilesSelected(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSystemChannel}
              title="Adjuntar archivo"
              className="flex-none self-end w-9 h-9 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              📎
            </button>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder={isSystemChannel ? 'Canal de sistema — no se puede escribir' : 'Escribe un mensaje...'}
              disabled={isSystemChannel}
              className={`flex-1 text-[13px] px-2.5 py-1.5 border border-gray-200 rounded resize-none focus:outline-none focus:border-indigo-400 transition-colors ${
                isSystemChannel ? 'bg-gray-50 text-gray-400' : ''
              }`}
              style={{ minHeight: '36px', maxHeight: '72px', overflowY: 'auto' }}
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!canSend}
              className="flex-none self-end px-3 py-1.5 text-[13px] font-medium rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:bg-gray-300 transition-colors"
            >
              Enviar
            </button>
          </div>

          {/* Mention picker */}
          {showMentionPicker && filteredMentions.length > 0 && (
            <div
              ref={mentionPickerRef}
              className="absolute bottom-full left-4 mb-2 bg-white border border-gray-200 rounded shadow-lg z-50 max-w-xs max-h-40 overflow-y-auto"
            >
              {filteredMentions.map(user => (
                <button
                  key={user.id}
                  onClick={() => handleMentionClick(user)}
                  className="block w-full text-left px-3 py-1.5 text-[12px] text-gray-700 hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <span className="font-medium">{user.name ?? 'Usuario'}</span>
                  {user.phone && <span className="text-gray-400 ml-2">{user.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Members modal ──────────────────────────────────────────────────── */}
      {showMembersModal && selectedChannel && (
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={() => closeMembersModal()}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-4 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-semibold text-gray-900">Miembros de {selectedChannel.name}</h3>
              <button
                onClick={() => closeMembersModal()}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
              {selectedChannel.members?.map(memberId => {
                const user = workspaceUsers.find(u => u.id === memberId)
                if (!user) return null
                return (
                  <div key={memberId} className="flex items-center justify-between text-[13px] p-2 bg-gray-50 rounded">
                    <span className="text-gray-700">{user.name ?? 'Usuario'}</span>
                    <button
                      onClick={() => handleRemoveMember(selectedChannelId!, memberId)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
              {(!selectedChannel.members || selectedChannel.members.length === 0) && (
                <div className="text-[12px] text-gray-400 italic">Sin miembros explícitos</div>
              )}
            </div>

            <div className="flex gap-2">
              <select
                onChange={e => {
                  if (e.target.value) {
                    handleAddMember(selectedChannelId!, e.target.value)
                    e.target.value = ''
                  }
                }}
                defaultValue=""
                className="flex-1 text-[12px] px-2 py-1.5 border border-gray-200 rounded outline-none"
              >
                <option value="">Agregar miembro...</option>
                {workspaceUsers
                  .filter(u => !selectedChannel.members?.includes(u.id))
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderBody(body: string): React.ReactNode {
  const parts = body.split(/(\@\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    const m = part.match(/\@\[([^\]]+)\]\([^)]+\)/)
    if (m) {
      return (
        <span key={i} className="bg-indigo-100 text-indigo-700 rounded px-1 text-[13px]">
          @{m[1]}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function AttachmentView({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mime_type.startsWith('image/')
  if (isImage && attachment.url) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block max-w-xs">
        <img
          src={attachment.url}
          alt={attachment.file_name}
          className="rounded border border-gray-200 max-h-56 object-cover"
        />
        <div className="text-[11px] text-gray-500 mt-0.5 truncate">{attachment.file_name}</div>
      </a>
    )
  }

  return (
    <a
      href={attachment.url ?? '#'}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 px-2.5 py-1.5 border border-gray-200 rounded hover:bg-gray-50 transition-colors max-w-xs"
    >
      <span className="text-[16px]">📄</span>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-gray-900 truncate">{attachment.file_name}</div>
        <div className="text-[10px] text-gray-500">{formatSize(attachment.size_bytes)}</div>
      </div>
    </a>
  )
}
