'use client'

import { useState } from 'react'
import type { CellProps } from '../types'

export function ButtonCell({ column, rowId }: CellProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const label = column.settings.label ?? 'Acción'
  const action = (column.settings as any).action as string | undefined
  const stageId = (column.settings as any).stage_id as string | undefined
  const confirm = (column.settings as any).confirm as boolean | undefined
  const confirmMessage = (column.settings as any).confirm_message as string | undefined

  const handleClick = async () => {
    // Check confirmation dialog
    if (confirm) {
      const userConfirmed = window.confirm(confirmMessage ?? '¿Confirmar acción?')
      if (!userConfirmed) return
    }

    // Execute action
    try {
      setLoading(true)

      if (action === 'change_stage') {
        if (!stageId) {
          alert('Error: stage_id no configurado')
          return
        }

        const response = await fetch(`/api/items/${rowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage_id: stageId }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const message = errorData.message || response.statusText || 'Error desconocido'
          alert(`Error al cambiar etapa: ${message}`)
          return
        }

        // Success: show flash effect
        setSuccess(true)
        setTimeout(() => setSuccess(false), 300)
        // Realtime will update the table
      } else if (action === 'create_quote') {
        alert('Quote Engine disponible en Fase 15')
      } else if (action === 'run_automation') {
        alert('Automation Engine disponible en Fase 14')
      } else {
        alert('Acción no reconocida')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al ejecutar acción: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center w-full h-full px-2 py-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`text-[12px] px-3 py-1 rounded font-medium transition-colors duration-200 ${
          success
            ? 'bg-green-600 text-white'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? '...' : label}
      </button>
    </div>
  )
}
