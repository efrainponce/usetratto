'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Step = 'phone' | 'otp'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({ phone })

    if (error) {
      setError(error.message)
    } else {
      setStep('otp')
    }
    setLoading(false)
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    })

    if (error) {
      setError(error.message)
    } else {
      window.location.href = '/app'
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold text-gray-900 mb-1">Tratto</div>
          <p className="text-sm text-gray-500">Ingresa con tu número de teléfono</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+521234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-400">Formato E.164 (ej: +521234567890)</p>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                Código de verificación
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent tracking-widest text-center text-lg"
              />
              <p className="mt-1 text-xs text-gray-400">Código enviado a {phone}</p>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp(''); setError(null) }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Cambiar número
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
