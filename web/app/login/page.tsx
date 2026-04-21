'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Step = 'input' | 'otp' | 'email_sent'
type Method = 'email' | 'phone'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('input')
  const [method, setMethod] = useState<Method>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = method === 'email'
      ? await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
      : await supabase.auth.signInWithOtp({ phone })

    if (error) {
      setError(error.message)
    } else {
      setStep(method === 'email' ? 'email_sent' : 'otp')
    }
    setLoading(false)
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = method === 'email'
      ? await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
      : await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })

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
          <p className="text-sm text-gray-500">
            {method === 'email' ? 'Ingresa con tu correo electrónico' : 'Ingresa con tu número de teléfono'}
          </p>
        </div>

        {step === 'input' && (
          <div className="flex bg-gray-100 rounded-lg p-0.5 mb-6">
            <button type="button"
              onClick={() => { setMethod('email'); setError(null) }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${method === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Correo electrónico
            </button>
            <button type="button"
              onClick={() => { setMethod('phone'); setError(null) }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${method === 'phone' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Teléfono
            </button>
          </div>
        )}

        {step === 'email_sent' ? (
          <div className="space-y-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
              ✉️
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 mb-1">Revisa tu correo</p>
              <p className="text-sm text-gray-500">
                Enviamos un enlace a <span className="font-medium text-gray-700">{email}</span>.
                Haz click para ingresar.
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Puede tardar hasta 1 minuto. Revisa spam si no lo ves.
            </p>
            <button
              type="button"
              onClick={() => { setStep('input'); setError(null) }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Cambiar correo
            </button>
          </div>
        ) : step === 'input' ? (
          <form onSubmit={sendOtp} className="space-y-4">
            {method === 'email' ? (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            ) : (
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
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || (method === 'email' ? !email : !phone)}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Enviando...' : method === 'email' ? 'Enviar enlace' : 'Enviar código'}
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
              <p className="mt-1 text-xs text-gray-400">
                Código enviado a {method === 'email' ? email : phone}
              </p>
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
              onClick={() => { setStep('input'); setOtp(''); setError(null) }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              {method === 'email' ? 'Cambiar correo' : 'Cambiar número'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
