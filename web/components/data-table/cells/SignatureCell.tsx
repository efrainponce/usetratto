'use client'

import { useState } from 'react'
import type { CellProps } from '../types'

type SignatureValue = {
  doc_id: string
  signed_by: string
  phone: string | null
  signed_at: string
  user_id: string
}

export function SignatureCell({
  value,
  column,
  rowId,
  onCommit,
}: CellProps) {
  const sigValue = (value as unknown as SignatureValue | null) ?? null
  const [localSig, setLocalSig] = useState(sigValue)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSign() {
    setLoading(true)
    setError(null)
    try {
      const columnId = (column as any).id ?? column.settings?.column_id ?? column.key
      const res = await fetch(`/api/items/${rowId}/signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: columnId }),
      })

      const result = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setError('Este campo ya fue firmado anteriormente')
        } else if (res.status === 403) {
          setError('No tienes permiso para firmar este campo')
        } else {
          setError(result.error ?? 'Error al firmar')
        }
        return
      }

      const signed = result.value_json as SignatureValue
      setLocalSig(signed)
      setShowModal(false)
      onCommit(signed)
    } catch (err) {
      setError('Error de conexión. Intenta nuevamente.')
      console.error('Signature error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Unsigned state
  if (localSig === null) {
    return (
      <div className="flex items-center justify-center w-full h-full px-2 py-1">
        <button
          onClick={() => setShowModal(true)}
          className="text-[12px] px-2 py-0.5 border border-gray-300 rounded text-gray-600 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer flex items-center gap-1 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M1 10.5h10M8.5 1.5l1.414-1.414a2 2 0 012.828 2.828L11.328 4.328M3 8.5l5.5-5.5"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Firmar
        </button>

        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-80 shadow-xl">
              <h2 className="text-[14px] font-semibold text-gray-900 mb-3">Confirmar firma</h2>
              <p className="text-[12px] text-gray-700 leading-5 mb-4">
                Esta acción es irreversible. Al firmar, confirmas que has revisado y aprobado este documento.
              </p>
              <p className="text-[11px] text-gray-500 mb-4">
                Tu firma será registrada con tu cuenta.
              </p>

              {error && (
                <p className="text-[12px] text-red-600 mb-4">{error}</p>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowModal(false)
                    setError(null)
                  }}
                  disabled={loading}
                  className="text-[12px] px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSign}
                  disabled={loading}
                  className="text-[12px] px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M1 10.5h10M8.5 1.5l1.414-1.414a2 2 0 012.828 2.828L11.328 4.328M3 8.5l5.5-5.5"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {loading ? 'Firmando...' : 'Firmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Signed state
  return (
    <div className="flex items-center justify-center w-full h-full px-2 py-1">
      <div className="text-[11px] px-2 py-0.5 bg-green-50 border border-green-200 rounded text-green-700 flex items-center gap-1 cursor-default">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6l2.5 2.5L10 3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          Firmado por {localSig.signed_by} · {new Date(localSig.signed_at).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>
    </div>
  )
}
