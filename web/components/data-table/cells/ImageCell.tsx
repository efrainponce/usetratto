'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { CellProps } from '../types'

type ImageEntry = {
  name: string
  path?: string
  thumb_path?: string
  url?: string
  size: number
  mime?: string
  uploaded_at?: string
}

const THUMB_SIZE = 48
const THUMB_MAX = 128 // canvas-generated thumbnail bound

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isExternalUrl(u: string | undefined): boolean {
  return !!u && (u.startsWith('http://') || u.startsWith('https://'))
}

function entryKey(e: ImageEntry): string {
  return e.path ?? e.url ?? e.name
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function pickImageFiles(): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
    document.body.appendChild(input)
    input.onchange = () => {
      document.body.removeChild(input)
      resolve(input.files ? Array.from(input.files) : [])
    }
    input.oncancel = () => { document.body.removeChild(input); resolve([]) }
    input.click()
  })
}

async function generateThumbnail(file: File, max = THUMB_MAX): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo leer la imagen'))
      i.src = url
    })
    const scale = Math.min(max / img.width, max / img.height, 1)
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    ctx.drawImage(img, 0, 0, w, h)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('No se pudo generar miniatura')),
        'image/webp',
        0.7
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ─── Preview modal ───────────────────────────────────────────────────────────

type PreviewProps = {
  entry:   ImageEntry
  base:    string
  colKey:  string
  onClose: () => void
}

function PreviewModal({ entry, base, colKey, onClose }: PreviewProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
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
      try {
        const res = await fetch(`${base}?${new URLSearchParams({ path: entry.path, column_id: colKey })}`)
        if (!res.ok) throw new Error('No se pudo cargar')
        const { url: signed } = await res.json() as { url: string }
        if (!cancelled) setUrl(signed)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [entry.path, entry.url, base, colKey])

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--bg)] rounded-sm shadow-2xl flex flex-col overflow-hidden w-full max-w-4xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <span className="text-lg">🖼</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--ink)] truncate">{entry.name}</p>
            <p className="text-[11px] text-[var(--ink-3)]">{formatFileSize(entry.size)}</p>
          </div>
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

        <div className="flex-1 overflow-auto bg-[var(--surface)] flex items-center justify-center min-h-32">
          {loading && (
            <svg className="w-6 h-6 animate-spin text-[var(--ink-3)]" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          {error && <p className="text-[13px] text-[var(--stage-lost)] p-4">{error}</p>}
          {url && !loading && (
            <img src={url} alt={entry.name} className="max-w-full max-h-[70vh] object-contain p-2" />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── ImageCell ───────────────────────────────────────────────────────────────

type ExtraProps = {
  /** Override the base URL for file upload/signed-URL endpoints. Defaults to `/api/items/{rowId}/files`. */
  filesBase?: string
  /** Size in px for the rendered thumbnails. Defaults to 48. */
  size?: number
}

export function ImageCell({ column, value, rowId, onCommit, filesBase, size }: CellProps & ExtraProps) {
  const base = filesBase ?? `/api/items/${rowId}/files`
  const tile = size ?? THUMB_SIZE
  const [entries, setEntries] = useState<ImageEntry[]>((value as unknown as ImageEntry[] | null) ?? [])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImageEntry | null>(null)
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({})
  const mountedRef = useRef(true)

  useEffect(() => () => { mountedRef.current = false }, [])

  // Keep local entries in sync if parent value changes (e.g., after row reload)
  useEffect(() => {
    setEntries((value as unknown as ImageEntry[] | null) ?? [])
  }, [value])

  // Batch-fetch signed URLs for thumbs + external full-size URLs for seed data
  useEffect(() => {
    const paths = entries
      .filter(e => e.thumb_path && !(e.thumb_path in thumbUrls))
      .map(e => e.thumb_path!)
    if (paths.length === 0) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${base}/signed-urls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths }),
        })
        if (!res.ok) return
        const { urls } = await res.json() as { urls: Record<string, string | null> }
        if (cancelled) return
        setThumbUrls(prev => {
          const next = { ...prev }
          for (const [p, u] of Object.entries(urls)) {
            if (u) next[p] = u
          }
          return next
        })
      } catch {
        // swallow — fallback to placeholder
      }
    })()
    return () => { cancelled = true }
  }, [entries, rowId, thumbUrls])

  const getThumbSrc = (entry: ImageEntry): string | null => {
    if (isExternalUrl(entry.url)) return entry.url!
    if (entry.thumb_path && thumbUrls[entry.thumb_path]) return thumbUrls[entry.thumb_path]
    return null
  }

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return
    setUploading(true)
    try {
      const newEntries: ImageEntry[] = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          alert(`"${file.name}" no es imagen — se ignora`)
          continue
        }

        // 1) Generate 128×128 webp thumbnail in-browser
        let thumbBlob: Blob | null = null
        try {
          thumbBlob = await generateThumbnail(file)
        } catch {
          // If thumb fails we still upload the original, just without thumb
          thumbBlob = null
        }

        // 2) Request signed upload URLs (original + thumb)
        const thumbFilename = thumbBlob ? `${file.name.replace(/\.[^.]+$/, '')}.webp` : undefined
        const reqRes = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            column_id: column.key,
            filename: file.name,
            mime: file.type,
            size: file.size,
            thumb_filename: thumbFilename,
          }),
        })
        if (!reqRes.ok) {
          const err = await reqRes.json().catch(() => ({}))
          throw new Error((err as any).error ?? 'No se pudo iniciar upload')
        }
        const { signedUrl, path, thumbSignedUrl, thumbPath } = await reqRes.json() as {
          signedUrl: string
          path: string
          thumbSignedUrl?: string
          thumbPath?: string
        }

        // 3) PUT original + thumb in parallel
        const puts: Promise<Response>[] = [
          fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
        ]
        if (thumbBlob && thumbSignedUrl) {
          puts.push(fetch(thumbSignedUrl, { method: 'PUT', body: thumbBlob, headers: { 'Content-Type': 'image/webp' } }))
        }
        const results = await Promise.all(puts)
        if (!results[0].ok) throw new Error('Falló el upload')
        // If thumb PUT fails, log and continue without thumb — non-fatal
        const thumbOk = results.length > 1 && results[1]?.ok
        if (results.length > 1 && !thumbOk) {
          console.warn('Thumbnail upload failed for', file.name)
        }

        newEntries.push({
          name: file.name,
          path,
          thumb_path: thumbOk ? thumbPath : undefined,
          size: file.size,
          mime: file.type,
          uploaded_at: new Date().toISOString(),
        })
      }

      if (newEntries.length === 0) return
      const merged = [...entries, ...newEntries]
      setEntries(merged)
      ;(onCommit as (v: unknown) => void)(merged)
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Desconocido'}`)
    } finally {
      if (mountedRef.current) setUploading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, entry: ImageEntry) => {
    e.stopPropagation()
    const key = entryKey(entry)
    setDeleting(key)
    try {
      if (isExternalUrl(entry.url) || !entry.path) {
        const next = entries.filter(f => entryKey(f) !== key)
        setEntries(next)
        ;(onCommit as (v: unknown) => void)(next)
        return
      }
      const res = await fetch(base, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: column.key, path: entry.path, thumb_path: entry.thumb_path }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).error ?? 'Error')
      }
      const next = entries.filter(f => entryKey(f) !== key)
      setEntries(next)
      ;(onCommit as (v: unknown) => void)(next)
    } catch (err) {
      alert(`Error al eliminar: ${err instanceof Error ? err.message : 'Desconocido'}`)
    } finally {
      if (mountedRef.current) setDeleting(null)
    }
  }

  return (
    <div className="w-full px-2 py-1 overflow-hidden">
      <div className="flex flex-wrap gap-1 items-center">
        {entries.length === 0 && !uploading && (
          <span className="text-gray-300 text-[12px]">—</span>
        )}

        {entries.map((entry, idx) => {
          const src = getThumbSrc(entry)
          const isCover = idx === 0
          return (
            <div
              key={entryKey(entry)}
              onClick={e => { e.stopPropagation(); setPreview(entry) }}
              className={`group/chip relative bg-gray-100 border rounded overflow-hidden cursor-pointer transition-all flex-shrink-0 ${
                isCover ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200 hover:border-indigo-300'
              }`}
              style={{ width: tile, height: tile }}
              title={`${entry.name}${isCover ? ' (cover)' : ''}`}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={entry.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-[18px]">
                  🖼
                </div>
              )}
              <button
                onClick={e => handleDelete(e, entry)}
                disabled={deleting === entryKey(entry)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-white/90 border border-gray-200 rounded-full flex items-center justify-center opacity-0 group-hover/chip:opacity-100 text-gray-500 hover:text-red-600 hover:border-red-300 disabled:opacity-30 transition-all text-[10px] leading-none"
                title="Eliminar"
              >
                {deleting === entryKey(entry) ? '…' : '×'}
              </button>
            </div>
          )
        })}

        <button
          onClick={async e => {
            e.stopPropagation()
            const files = await pickImageFiles()
            if (files.length > 0) handleUpload(files)
          }}
          disabled={uploading}
          className="flex-shrink-0 flex items-center justify-center border border-dashed border-gray-300 rounded text-gray-400 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-40 transition-colors"
          style={{ width: tile, height: tile }}
          title="Agregar imagen"
        >
          {uploading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : '+'}
        </button>
      </div>

      {preview && (
        <PreviewModal
          entry={preview}
          base={base}
          colKey={column.key}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
