'use client'

import { useEffect, useState } from 'react'

export function WorkspaceNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (!saveSuccess) return
    const t = setTimeout(() => setSaveSuccess(false), 2000)
    return () => clearTimeout(t)
  }, [saveSuccess])

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) setSaveSuccess(true)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-start justify-between py-4 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">Nombre</p>
          <p className="text-xs text-gray-500 mt-0.5">El nombre de tu workspace</p>
        </div>
        <div className="flex-1 flex justify-end">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-64 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="Ej. Mi Workspace"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {saveSuccess && <p className="text-xs text-green-600 font-medium">Guardado ✓</p>}
      </div>
    </>
  )
}
