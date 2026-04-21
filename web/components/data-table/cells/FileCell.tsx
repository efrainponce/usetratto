'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CellProps } from '../types'

type FileEntry = {
  name: string
  path?: string
  url?: string
  size: number
  mime?: string
  type?: string
  uploaded_at?: string
}

function entryMime(e: FileEntry): string {
  return e.mime ?? e.type ?? ''
}

function entryKey(e: FileEntry): string {
  return e.path ?? e.url ?? e.name
}

function isExternalUrl(u: string | undefined): boolean {
  return !!u && (u.startsWith('http://') || u.startsWith('https://'))
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function pickFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
    document.body.appendChild(input)
    input.onchange = () => { document.body.removeChild(input); resolve(input.files?.[0] ?? null) }
    input.oncancel = () => { document.body.removeChild(input); resolve(null) }
    input.click()
  })
}

function fileIcon(mime: string | undefined): string {
  if (!mime) return '📄'
  if (mime.startsWith('image/'))       return '🖼'
  if (mime === 'application/pdf')      return '📕'
  if (mime.startsWith('video/'))       return '🎬'
  if (mime.startsWith('audio/'))       return '🎵'
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return '📊'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return '📦'
  return '📄'
}

function isImage(mime: string | undefined) { return !!mime && mime.startsWith('image/') }
function isPdf(mime: string | undefined)   { return mime === 'application/pdf' }
function isVideo(mime: string | undefined) { return !!mime && mime.startsWith('video/') }

// ── Preview modal ────────────────────────────────────────────────────────────

type PreviewProps = {
  entry:   FileEntry
  rowId:   string
  colKey:  string
  onClose: () => void
}

function PreviewModal({ entry, rowId, colKey, onClose }: PreviewProps) {
  const [url,     setUrl]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // If entry has external URL (seed data or external source), use directly. Else fetch signed URL from storage.
  useState(() => {
    if (isExternalUrl(entry.url)) {
      setUrl(entry.url!)
      setLoading(false)
      return
    }
    if (!entry.path) {
      setError('Sin ruta')
      setLoading(false)
      return
    }
    fetch(`/api/items/${rowId}/files?${new URLSearchParams({ path: entry.path, column_id: colKey })}`)
      .then(r => r.ok ? r.json() : Promise.reject('Error al cargar'))
      .then(({ url }: { url: string }) => setUrl(url))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  })

  const mime = entryMime(entry)
  const isImg = isImage(mime)
  const isPDF = isPdf(mime)
  const isVid = isVideo(mime)

  const wide = isImg || isPDF || isVid

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`bg-[var(--bg)] rounded-sm shadow-2xl flex flex-col overflow-hidden ${wide ? 'w-full max-w-4xl' : 'w-80'}`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <span className="text-lg">{fileIcon(entryMime(entry))}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--ink)] truncate">{entry.name}</p>
            <p className="text-[11px] text-[var(--ink-3)]">{formatFileSize(entry.size)}</p>
          </div>
          <div className="flex items-center gap-1">
            {url && (
              <a
                href={url}
                download={entry.name}
                onClick={e => e.stopPropagation()}
                className="text-[11px] px-2 py-1 border border-[var(--border)] rounded-sm text-[var(--ink-2)] hover:bg-[var(--surface-2)] transition-colors"
                title="Descargar"
              >↓ Descargar</a>
            )}
            <button
              onClick={onClose}
              className="ml-1 w-7 h-7 flex items-center justify-center rounded-sm text-[var(--ink-3)] hover:bg-[var(--surface-2)] text-[16px] leading-none"
            >×</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-[var(--surface)] flex items-center justify-center min-h-32">
          {loading && (
            <svg className="w-6 h-6 animate-spin text-[var(--ink-3)]" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          {error && <p className="text-[13px] text-[var(--stage-lost)] p-4">{error}</p>}
          {url && !loading && (
            <>
              {isImg && (
                <img
                  src={url}
                  alt={entry.name}
                  className="max-w-full max-h-[70vh] object-contain p-2"
                />
              )}
              {isPDF && (
                <iframe
                  src={url}
                  title={entry.name}
                  className="w-full h-[70vh] border-0"
                />
              )}
              {isVid && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={url} controls className="max-w-full max-h-[70vh] p-2" />
              )}
              {!isImg && !isPDF && !isVid && (
                <div className="flex flex-col items-center gap-3 p-8 text-center">
                  <span className="text-5xl">{fileIcon(entryMime(entry))}</span>
                  <p className="text-[13px] text-[var(--ink-3)]">Vista previa no disponible para este tipo de archivo.</p>
                  <a
                    href={url}
                    download={entry.name}
                    className="text-[12px] px-3 py-1.5 bg-[var(--brand)] text-[var(--brand-ink)] rounded-sm hover:bg-[var(--brand-deep)] transition-colors"
                  >↓ Descargar {entry.name}</a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── FileCell ─────────────────────────────────────────────────────────────────

export function FileCell({ column, value, rowId, onCommit }: CellProps) {
  const [files,    setFiles]    = useState<FileEntry[]>((value as unknown as FileEntry[] | null) ?? [])
  const [uploading, setUploading] = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [preview,   setPreview]   = useState<FileEntry | null>(null)

  const handleFileSelect = async (file: File) => {
    setUploading(true)
    try {
      const uploadRes = await fetch(`/api/items/${rowId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: column.key, filename: file.name, mime: file.type, size: file.size }),
      })
      if (!uploadRes.ok) { const e = await uploadRes.json(); throw new Error(e.error ?? 'Error') }
      const { signedUrl, path } = await uploadRes.json() as { signedUrl: string; path: string }

      const putRes = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!putRes.ok) throw new Error('Error al subir archivo')

      const entry: FileEntry = { name: file.name, path, size: file.size, mime: file.type, uploaded_at: new Date().toISOString() }
      const newFiles = [...files, entry]
      setFiles(newFiles)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(onCommit as (v: any) => void)(newFiles)
    } catch (err) {
      alert(`Error al subir: ${err instanceof Error ? err.message : 'Desconocido'}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, entry: FileEntry) => {
    e.stopPropagation()
    const key = entryKey(entry)
    setDeleting(key)
    try {
      // External entries (seed dummy data) — remove from list only, no storage roundtrip
      if (isExternalUrl(entry.url) || !entry.path) {
        const newFiles = files.filter(f => entryKey(f) !== key)
        setFiles(newFiles)
        ;(onCommit as (v: unknown) => void)(newFiles)
        return
      }
      const res = await fetch(`/api/items/${rowId}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: column.key, path: entry.path }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Error') }
      const newFiles = files.filter(f => entryKey(f) !== key)
      setFiles(newFiles)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(onCommit as (v: any) => void)(newFiles)
    } catch (err) {
      alert(`Error al eliminar: ${err instanceof Error ? err.message : 'Desconocido'}`)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="w-full px-2 py-1 text-[13px] overflow-hidden">
      <div className="flex flex-wrap gap-1 overflow-hidden">
        {files.length === 0 && !uploading && (
          <span className="text-gray-300 text-[12px]">—</span>
        )}

        {files.map(entry => (
          <div
            key={entryKey(entry)}
            onClick={e => { e.stopPropagation(); setPreview(entry) }}
            className="group/chip relative bg-gray-100 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded-md w-7 h-6 flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
            title={entry.name}
          >
            <span className="text-[14px] leading-none">{fileIcon(entryMime(entry))}</span>
            <button
              onClick={e => handleDelete(e, entry)}
              disabled={deleting === entryKey(entry)}
              className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white border border-gray-200 rounded-full flex items-center justify-center opacity-0 group-hover/chip:opacity-100 text-gray-400 hover:text-red-500 hover:border-red-300 disabled:opacity-30 transition-all text-[9px] leading-none"
              title="Eliminar"
            >
              {deleting === entry.path ? (
                <svg className="w-2 h-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : '×'}
            </button>
          </div>
        ))}

        {files.length < 10 && (
          <button
            onClick={async e => {
              e.stopPropagation()
              const file = await pickFile()
              if (file) handleFileSelect(file)
            }}
            disabled={uploading}
            className="text-[11px] text-indigo-500 hover:text-indigo-700 disabled:opacity-40 flex items-center gap-0.5 transition-colors px-1"
            title="Adjuntar archivo"
          >
            {uploading ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : '+'}
          </button>
        )}
      </div>

      {preview && (
        <PreviewModal
          entry={preview}
          rowId={rowId}
          colKey={column.key}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
