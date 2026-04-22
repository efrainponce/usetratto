const MOCK_DATA = {
  plan: 'Tratto Pro',
  price: 49,
  currency: 'USD',
  renewalDate: '15 de mayo de 2026',
  aiCredits: {
    used: 8400,
    total: 20000,
    renewalDate: '15 de mayo de 2026',
    breakdown: [
      { feature: 'Análisis de items', credits: 4200, percentage: 50 },
      { feature: 'WhatsApp bot', credits: 3100, percentage: 37 },
      { feature: 'Resúmenes diarios', credits: 1100, percentage: 13 },
    ],
  },
  storage: {
    used: 1.2,
    total: 10,
    percentage: 12,
    breakdown: [
      { name: 'Archivos adjuntos', size: '890 MB' },
      { name: 'Exports CSV/PDF', size: '310 MB' },
    ],
  },
  invoices: [
    { month: 'Abr 2026', amount: 49, status: 'Pagado' },
    { month: 'Mar 2026', amount: 49, status: 'Pagado' },
    { month: 'Feb 2026', amount: 49, status: 'Pagado' },
  ],
}

export default function BillingSettingsPage() {
  const aiCreditsPercentage = Math.round(
    (MOCK_DATA.aiCredits.used / MOCK_DATA.aiCredits.total) * 100
  )

  return (
    <div className="w-full max-w-2xl">
      {/* Demo Banner */}
      <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm text-amber-600 font-medium">
          ⚠ Datos de demostración — integración de pagos próximamente
        </p>
      </div>

      <h1 className="text-xl font-semibold text-gray-900 mb-1">Facturación</h1>
      <p className="text-sm text-gray-500 mb-8">
        Administra tu plan, créditos y datos de facturación
      </p>

      {/* Section 1: Current Plan */}
      <div className="rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800 mb-3">Plan actual</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Plan</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-900 text-white">
                  {MOCK_DATA.plan}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Precio</span>
                <span className="text-sm font-medium text-gray-900">
                  ${MOCK_DATA.price} {MOCK_DATA.currency}/mes
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Próxima renovación</span>
                <span className="text-sm font-medium text-gray-900">
                  {MOCK_DATA.renewalDate}
                </span>
              </div>
            </div>
          </div>
          <button
            disabled
            title="No disponible en demo"
            className="px-4 py-2 text-sm font-medium text-gray-500 rounded-lg border border-gray-200 cursor-not-allowed"
          >
            Gestionar →
          </button>
        </div>
      </div>

      {/* Section 2: AI Credits */}
      <div className="rounded-xl border border-gray-200 p-6 mb-4">
        <p className="text-sm font-medium text-gray-800 mb-4">Créditos AI este mes</p>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gray-900 rounded-full transition-all"
              style={{ width: `${aiCreditsPercentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {MOCK_DATA.aiCredits.used.toLocaleString()} /{' '}
            {MOCK_DATA.aiCredits.total.toLocaleString()} créditos usados ({aiCreditsPercentage}%)
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Se renuevan el {MOCK_DATA.aiCredits.renewalDate}
          </p>
        </div>

        {/* Breakdown Table */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-700 mb-3">Desglose por feature</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs font-medium text-gray-700">Feature</th>
                <th className="text-right py-2 text-xs font-medium text-gray-700">Créditos</th>
                <th className="text-right py-2 text-xs font-medium text-gray-700">% total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_DATA.aiCredits.breakdown.map((item) => (
                <tr key={item.feature}>
                  <td className="py-2 text-sm text-gray-600">{item.feature}</td>
                  <td className="text-right py-2 text-sm text-gray-900">
                    {item.credits.toLocaleString()}
                  </td>
                  <td className="text-right py-2 text-sm text-gray-900">{item.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Storage */}
      <div className="rounded-xl border border-gray-200 p-6 mb-4">
        <p className="text-sm font-medium text-gray-800 mb-4">Archivos y adjuntos</p>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gray-900 rounded-full transition-all"
              style={{ width: `${MOCK_DATA.storage.percentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {MOCK_DATA.storage.used} GB / {MOCK_DATA.storage.total} GB usado (
            {MOCK_DATA.storage.percentage}%)
          </p>
        </div>

        {/* Storage Breakdown */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-700 mb-3">Desglose</p>
          <div className="space-y-2">
            {MOCK_DATA.storage.breakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.name}</span>
                <span className="text-sm font-medium text-gray-900">{item.size}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 4: Invoice History */}
      <div className="rounded-xl border border-gray-200 p-6 mb-4">
        <p className="text-sm font-medium text-gray-800 mb-4">Últimas facturas</p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left py-3 px-3 text-xs font-medium text-gray-700">Fecha</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-gray-700">Monto</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-gray-700">Estado</th>
              <th className="text-center py-3 px-3 text-xs font-medium text-gray-700">
                Descargar
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {MOCK_DATA.invoices.map((invoice) => (
              <tr key={invoice.month}>
                <td className="py-3 px-3 text-sm text-gray-600">{invoice.month}</td>
                <td className="text-right py-3 px-3 text-sm font-medium text-gray-900">
                  ${invoice.amount}
                </td>
                <td className="py-3 px-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    {invoice.status}
                  </span>
                </td>
                <td className="text-center py-3 px-3">
                  <button
                    disabled
                    title="No disponible en demo"
                    className="text-gray-400 cursor-not-allowed text-sm hover:text-gray-400"
                  >
                    PDF ↓
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
