'use client'

import { useState, useEffect } from 'react'
import { SignatureDrawModal } from '@/components/templates/SignatureDrawModal'

type DocumentItem = {
  id: string
  sid: number
  name: string
  folio: string | null
  status: string | null
  pdf_url: string | null
  signatures: unknown[] | null
  template_id: string | null
  created_at: string
  generated_by_name: string | null
}

type Props = {
  itemId: string
  workspaceSid: number
}

export function DocumentsTab({ itemId, workspaceSid }: Props) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signingDocId, setSigningDocId] = useState<string | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  const fetchDocuments = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/documents?source_item_id=${encodeURIComponent(itemId)}`
      )
      if (!res.ok) throw new Error('Error al cargar documentos')
      const data = await res.json()
      setDocuments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchDocuments()
  }, [itemId])

  // Listen for document-generated and document-signed events
  useEffect(() => {
    const handleDocumentGenerated = () => fetchDocuments()
    const handleDocumentSigned = () => fetchDocuments()

    window.addEventListener('document-generated', handleDocumentGenerated)
    window.addEventListener('document-signed', handleDocumentSigned)

    return () => {
      window.removeEventListener('document-generated', handleDocumentGenerated)
      window.removeEventListener('document-signed', handleDocumentSigned)
    }
  }, [])

  const handleDelete = async (docId: string) => {
    if (!window.confirm('¿Eliminar este documento?')) return

    setDeletingDocId(docId)
    try {
      const res = await fetch(`/api/items/${docId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error al eliminar')
      setDocuments(prev => prev.filter(d => d.id !== docId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setDeletingDocId(null)
    }
  }

  const getStatusLabel = (status: string | null): string => {
    switch (status) {
      case 'pending_signature':
        return 'Pendiente firma'
      case 'signed':
        return 'Firmado'
      case 'draft':
        return 'Borrador'
      default:
        return status ?? 'Desconocido'
    }
  }

  const getStatusColor = (status: string | null): string => {
    switch (status) {
      case 'signed':
        return 'bg-green-50 border-green-200 text-green-700'
      case 'pending_signature':
        return 'bg-amber-50 border-amber-200 text-amber-700'
      case 'draft':
        return 'bg-gray-50 border-gray-200 text-gray-700'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700'
    }
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `hace ${diffMins}m`
    if (diffHours < 24) return `hace ${diffHours}h`
    if (diffDays < 7) return `hace ${diffDays}d`
    return date.toLocaleDateString('es-ES')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[13px] text-gray-500">
        Cargando documentos...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[13px] text-red-600">
        {error}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[13px] text-gray-500">
        No hay documentos generados aún
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-3">
        {documents.map(doc => (
          <div
            key={doc.id}
            className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] leading-none">📄</span>
                  <h3 className="text-[13px] font-medium text-gray-900 truncate">
                    {doc.folio && (
                      <span className="text-gray-500">{doc.folio} · </span>
                    )}
                    {doc.name}
                  </h3>
                </div>
              </div>
              <span
                className={`flex-none text-[11px] px-2 py-1 rounded border ${getStatusColor(
                  doc.status
                )}`}
              >
                {getStatusLabel(doc.status)}
              </span>
            </div>

            {/* Metadata */}
            <p className="text-[12px] text-gray-500 mb-3">
              {doc.generated_by_name && (
                <>Generado por {doc.generated_by_name} · {formatDate(doc.created_at)}</>
              )}
              {!doc.generated_by_name && (
                <>{formatDate(doc.created_at)}</>
              )}
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              {doc.pdf_url && (
                <button
                  onClick={() => window.open(doc.pdf_url as string, '_blank')}
                  className="text-[12px] px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Ver PDF
                </button>
              )}
              <button
                onClick={() => setSigningDocId(doc.id)}
                className="text-[12px] px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Firmar
              </button>
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deletingDocId === doc.id}
                className="text-[12px] px-2 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors disabled:opacity-50"
              >
                {deletingDocId === doc.id ? '…' : '×'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Signature modal */}
      {signingDocId && (
        <SignatureDrawModal
          documentItemId={signingDocId}
          availableRoles={['cliente']}
          onClose={() => setSigningDocId(null)}
          onSigned={() => {
            setSigningDocId(null)
            fetchDocuments()
          }}
        />
      )}
    </div>
  )
}
