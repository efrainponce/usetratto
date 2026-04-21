'use client'

import { useState } from 'react'
import type { CellProps } from '../types'
import { evaluateCondition, type FormulaCondition } from '@/lib/formula-engine'

export function ButtonCell({ column, rowId, row, allColumns }: CellProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [failedMessages, setFailedMessages] = useState<string[]>([])

  const label         = column.settings.label ?? column.label ?? 'Acción'
  const action        = column.settings.action
  const targetStageId = column.settings.target_stage_id ?? column.settings.stage_id
  const confirm       = column.settings.confirm
  const confirmMsg    = column.settings.confirm_message

  /** Evaluate gate validations for the target stage. Returns failed messages. */
  function runValidations(): string[] {
    if (!allColumns || !row || !targetStageId) return []

    // Find stage column and read its stage_gates for the target stage
    const stageCol = allColumns.find(c => c.key === 'stage_id')
    const gateKeys: string[] | undefined = stageCol?.settings?.stage_gates?.[targetStageId]

    // No gates configured → no blocking
    if (!gateKeys || gateKeys.length === 0) return []

    const failed: string[] = []
    for (const col of allColumns) {
      if (!gateKeys.includes(col.key)) continue

      // Required field check: if settings.required is true, the value must be non-empty
      if (col.settings?.required === true) {
        const v = row?.[col.key] ?? null
        const isEmpty = v == null || v === '' || (Array.isArray(v) && v.length === 0)
        if (isEmpty) {
          failed.push(`❌ ${col.label ?? col.key}: es requerido`)
          continue
        }
      }

      // Existing validation condition check
      const validation = col.settings?.validation
      if (!validation?.condition) continue
      try {
        const ok = evaluateCondition(
          validation.condition as FormulaCondition,
          row as Record<string, unknown>
        )
        if (!ok) failed.push(`❌ ${col.label}: ${validation.message}`)
      } catch {
        // ignore eval errors — don't block
      }
    }
    return failed
  }

  const handleClick = async () => {
    if (confirm) {
      if (!window.confirm(confirmMsg ?? '¿Confirmar acción?')) return
    }

    try {
      setLoading(true)
      setFailedMessages([])

      if (action === 'change_stage') {
        if (!targetStageId) {
          alert('Error: target_stage_id no configurado en este botón')
          return
        }

        // Gate check — evaluate all column validations
        const failed = runValidations()
        if (failed.length > 0) {
          setFailedMessages(failed)
          return
        }

        const response = await fetch(`/api/items/${rowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage_id: targetStageId }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          alert(`Error al cambiar etapa: ${errorData.message ?? response.statusText}`)
          return
        }

        setSuccess(true)
        setTimeout(() => setSuccess(false), 600)
        // Realtime will sync the table
      } else if (action === 'generate_document') {
        const templateId = column.settings.template_id
        if (!templateId) {
          alert('Error: template_id no configurado en este botón')
          return
        }

        const response = await fetch('/api/documents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_id: templateId, source_item_id: rowId }),
        })

        const data = await response.json()

        if (!response.ok) {
          if (response.status === 400 && data.errors) {
            setFailedMessages(data.errors.map((err: string) => `❌ ${err}`))
            return
          }
          alert(`Error al generar documento: ${data.error ?? response.statusText}`)
          return
        }

        // Success — open PDF in new tab
        window.open(data.pdf_url, '_blank')
        setSuccess(true)
        setTimeout(() => setSuccess(false), 600)

        // Dispatch custom event for DocumentsTab to refetch
        window.dispatchEvent(new CustomEvent('document-generated'))
      } else if (action === 'create_quote') {
        alert('Quote Engine disponible en Fase 17')
      } else if (action === 'run_automation') {
        alert('Automation Engine disponible en Fase 16')
      } else {
        alert('Acción no reconocida')
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'desconocido'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-1 py-0.5 gap-0.5">
      <button
        onClick={handleClick}
        disabled={loading}
        className={[
          'text-[11px] px-2.5 py-1 rounded font-medium transition-colors duration-150 w-full',
          success
            ? 'bg-green-600 text-white'
            : failedMessages.length > 0
            ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
            : 'bg-indigo-600 text-white hover:bg-indigo-700',
          loading ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {loading ? '…' : label}
      </button>

      {/* Validation failure list — shown inline below the button */}
      {failedMessages.length > 0 && (
        <div className="w-full text-[10px] text-red-600 leading-tight space-y-0.5 max-h-20 overflow-y-auto">
          {failedMessages.map((msg, i) => (
            <div key={i} className="truncate" title={msg}>{msg}</div>
          ))}
        </div>
      )}
    </div>
  )
}
