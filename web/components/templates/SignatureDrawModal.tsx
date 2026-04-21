'use client'

import { useState, useRef, useEffect } from 'react'

type Props = {
  documentItemId: string
  availableRoles: string[]
  onClose: () => void
  onSigned: (result: { signatures: unknown[]; pdf_url: string; status: string }) => void
}

export function SignatureDrawModal({
  documentItemId,
  availableRoles,
  onClose,
  onSigned,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedRole, setSelectedRole] = useState(availableRoles[0] ?? 'cliente')
  const [userName, setUserName] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch current user name on mount
  useEffect(() => {
    async function fetchUserName() {
      try {
        const res = await fetch('/api/users/me')
        if (res.ok) {
          const user = await res.json()
          setUserName(user.name ?? '')
        }
      } catch {
        // Ignore error — userName will be empty
      }
    }
    fetchUserName()
  }, [])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    if (!hasDrawn) setHasDrawn(true)

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = ('clientX' in e ? e.clientX : e.touches[0].clientX) - rect.left
    const y = ('clientY' in e ? e.clientY : e.touches[0].clientY) - rect.top

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = ('clientX' in e ? e.clientX : e.touches[0].clientX) - rect.left
    const y = ('clientY' in e ? e.clientY : e.touches[0].clientY) - rect.top

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const handleSign = async () => {
    setLoading(true)
    setError(null)

    try {
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas not found')

      const signatureImageBase64 = canvas.toDataURL('image/png')

      const res = await fetch(`/api/documents/${documentItemId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          signature_image_base64: signatureImageBase64,
          user_name: userName || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al firmar')
        return
      }

      // Success
      onSigned(data)
      onClose()

      // Dispatch custom event for DocumentsTab to refetch
      window.dispatchEvent(new CustomEvent('document-signed'))
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'desconocido'}`)
    } finally {
      setLoading(false)
    }
  }

  const roles = availableRoles.length > 0 ? availableRoles : ['cliente']

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-96 shadow-xl max-h-screen overflow-y-auto">
        <h2 className="text-[16px] font-semibold text-gray-900 mb-4">
          ✍ Firmar Documento
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* Role selector */}
        <div className="mb-4">
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
            Rol
          </label>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] bg-white text-gray-900 disabled:opacity-50"
          >
            {roles.map(role => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {/* Name input */}
        <div className="mb-4">
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
            Tu nombre
          </label>
          <input
            type="text"
            value={userName}
            onChange={e => setUserName(e.target.value)}
            disabled={loading}
            placeholder="Nombre completo"
            className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] text-gray-900 placeholder-gray-400 disabled:opacity-50"
          />
        </div>

        {/* Canvas for signature */}
        <div className="mb-4">
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
            Dibuja tu firma
          </label>
          <canvas
            ref={canvasRef}
            width={400}
            height={150}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full border border-gray-300 rounded bg-white cursor-crosshair"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={clearCanvas}
            disabled={!hasDrawn || loading}
            className="text-[12px] px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Limpiar
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[12px] px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSign}
            disabled={!hasDrawn || loading}
            className="text-[12px] px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Firmando...' : 'Firmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
