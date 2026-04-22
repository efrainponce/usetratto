'use client'

type Props = {
  name:         string
  role?:        string | null
  institution?: string | null
  phone?:       string | null
  email?:       string | null
  whatsapp?:    string | null
  variant?:     'contact' | 'institution'
  header?:      string
  extras?:      { label: string; value: string | number }[]
  subtitle?:    string | null
}

export function ContactCard({
  name, role, institution, phone, email, whatsapp,
  variant = 'contact', header, extras, subtitle,
}: Props) {
  const isInstitution = variant === 'institution'
  const defaultHeader = isInstitution ? 'Institución' : 'Contacto principal'
  const subLine = subtitle ?? [role, institution].filter(Boolean).join(' · ')

  const telHref = phone ? `tel:${phone.replace(/\s+/g, '')}` : null
  const mailHref = email ? `mailto:${email}` : null
  const waHref = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : null

  return (
    <div className="rounded-sm border border-[var(--border)] bg-[var(--surface-2)] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-4)]">
        {isInstitution ? <BuildingIcon /> : <UsersIcon />}
        <span>{header ?? defaultHeader}</span>
      </div>

      <div>
        <div className="text-[17px] font-semibold text-[var(--ink)] leading-tight">{name}</div>
        {subLine && (
          <div className="mt-1 text-[13px] text-[var(--ink-3)] leading-snug">{subLine}</div>
        )}
      </div>

      {(phone || email || (extras && extras.length > 0)) && (
        <div className="flex flex-col gap-1.5">
          {phone && (
            <Line icon={<PhoneIcon />}>
              <span className="font-[family-name:var(--font-geist-mono)] text-[12.5px] text-[var(--ink-2)]">{phone}</span>
            </Line>
          )}
          {email && (
            <Line icon={<MailIcon />}>
              <span className="font-[family-name:var(--font-geist-mono)] text-[12.5px] text-[var(--ink-2)]">{email}</span>
            </Line>
          )}
          {extras?.map((e, i) => (
            <div key={i} className="text-[12.5px] text-[var(--ink-3)] flex items-center gap-2">
              <span>{e.label}:</span>
              <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--ink-2)]">{e.value}</span>
            </div>
          ))}
        </div>
      )}

      {!isInstitution && (phone || email || whatsapp) && (
        <div className="flex items-center gap-1.5">
          {telHref && <ActionButton href={telHref} title="Llamar"><PhoneIcon /></ActionButton>}
          {mailHref && <ActionButton href={mailHref} title="Correo"><MailIcon /></ActionButton>}
          {waHref && <ActionButton href={waHref} title="WhatsApp" external><WhatsAppIcon /></ActionButton>}
        </div>
      )}
    </div>
  )
}

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[var(--ink-3)]">
      <span className="shrink-0 text-[var(--ink-4)]">{icon}</span>
      {children}
    </div>
  )
}

function ActionButton({
  href, title, external, children,
}: { href: string; title: string; external?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      title={title}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="w-8 h-8 rounded-sm border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--ink-3)] hover:text-[var(--brand)] hover:border-[var(--brand-soft)] transition-colors"
    >
      {children}
    </a>
  )
}

function UsersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      <path d="M10.5 3a2 2 0 0 1 0 4" />
      <path d="M14 13c0-1.7-1-3.1-2.5-3.7" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="11" height="11" rx="0.5" />
      <path d="M5 5h1M5 8h1M5 11h1M10 5h1M10 8h1M10 11h1" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4c0-.6.4-1 1-1h2l1 3-1.5 1a8 8 0 0 0 3.5 3.5L10 9l3 1v2c0 .6-.4 1-1 1C6.5 13 3 9.5 3 4z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3.5" width="11" height="9" rx="0.5" />
      <path d="M3 5l5 3.5L13 5" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.5a5.5 5.5 0 0 0-4.7 8.4L2.5 13.5l2.7-.7A5.5 5.5 0 1 0 8 2.5z" />
      <path d="M6 6.5c.2 1.5 1.5 2.8 3 3l.8-.7 1.2.5v1c-.5.5-1.3.5-2.3 0A5 5 0 0 1 6 7.3c-.4-1-.4-1.8 0-2.3h1l.5 1.2-.5.3z" />
    </svg>
  )
}
