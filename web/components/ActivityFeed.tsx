'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityEntry = {
  id: string
  action: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  metadata: Record<string, unknown>
  created_at: string
  sub_item_id: string | null
  users: { id: string; name: string; phone: string } | null
}

type Props = {
  itemId: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function describeAction(entry: ActivityEntry): string {
  const actor = entry.users?.name ?? 'Sistema'
  switch (entry.action) {
    case 'created':
      return `${actor} creó este elemento`
    case 'updated':
      return `${actor} actualizó el nombre`
    case 'stage_changed':
      return `${actor} cambió la etapa`
    case 'owner_changed':
      return `${actor} cambió el responsable`
    case 'deleted':
      return `${actor} eliminó este elemento`
    default:
      return `${actor} realizó un cambio`
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityFeed({ itemId }: Props) {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/items/${itemId}/activity`)
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const data = (await res.json()) as { activity: ActivityEntry[] }
        setActivities(data.activity ?? [])
      } catch (e) {
        console.error('Failed to load activity:', e)
        setActivities([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [itemId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[13px] text-gray-500">
        Cargando actividad...
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-[13px] italic text-gray-400">
        Sin actividad registrada
      </div>
    )
  }

  // Sort newest first
  const sorted = [...activities].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="space-y-0 overflow-y-auto">
      {sorted.map((entry, idx) => {
        const isLast = idx === sorted.length - 1
        const actor = entry.users?.name ?? 'Sistema'
        const initials = getInitials(actor)

        return (
          <div key={entry.id} className="flex gap-3 pb-4 text-[13px]">
            {/* Vertical timeline: dot + line */}
            <div className="relative flex flex-col items-center pt-1">
              {/* Dot */}
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              {/* Line (unless last) */}
              {!isLast && (
                <div className="absolute top-3 h-12 w-px bg-gray-200" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5">
              <div className="flex items-baseline gap-2">
                {/* Initials circle */}
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-600">
                  {initials}
                </div>
                {/* Description */}
                <span className="text-gray-900">{describeAction(entry)}</span>
              </div>
              {/* Timestamp */}
              <div className="mt-1 pl-7 text-gray-400">{relativeTime(entry.created_at)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
