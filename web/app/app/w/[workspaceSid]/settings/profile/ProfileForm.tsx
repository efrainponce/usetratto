'use client'

import { useEffect, useState } from 'react'

type Props = { initialName: string; initialJobTitle: string }

export function ProfileForm({ initialName, initialJobTitle }: Props) {
  const [name, setName] = useState(initialName)
  const [jobTitle, setJobTitle] = useState(initialJobTitle)
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
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, job_title: jobTitle }),
      })
      if (res.ok) setSaveSuccess(true)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-start justify-between py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">Nombre completo</p>
          <p className="text-xs text-gray-500 mt-0.5">Tu nombre aparecerá en la aplicación</p>
        </div>
        <div className="flex-1 flex justify-end">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-64 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="Ej. Juan Pérez"
          />
        </div>
      </div>

      <div className="border-t border-gray-100 my-6" />

      <div className="flex items-start justify-between py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">Cargo</p>
          <p className="text-xs text-gray-500 mt-0.5">Tu posición en la organización</p>
        </div>
        <div className="flex-1 flex justify-end">
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="w-64 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="Ej. Director Comercial"
          />
        </div>
      </div>

      <div className="border-t border-gray-100 my-6" />

      <div className="flex items-center justify-between pt-2">
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
