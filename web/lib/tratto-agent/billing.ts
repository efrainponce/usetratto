import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public details: {
      scope:     'daily' | 'monthly'
      used_usd:  number
      limit_usd: number
    },
  ) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

type PricingRow = { input_per_mtok: number; output_per_mtok: number }
const pricingCache = new Map<string, PricingRow | null>()

export async function computeCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): Promise<number> {
  const key = `${provider}:${model}`
  let pricing = pricingCache.get(key)

  if (pricing === undefined) {
    const service = createServiceClient()
    const { data } = await service
      .from('llm_pricing')
      .select('input_per_mtok, output_per_mtok')
      .eq('provider', provider)
      .eq('model', model)
      .maybeSingle()
    pricing = ((data as unknown) as PricingRow | null) ?? null
    pricingCache.set(key, pricing)
  }
  if (pricing === undefined) pricing = null

  if (!pricing) return 0
  const inputCost  = (inputTokens  / 1_000_000) * Number(pricing.input_per_mtok)
  const outputCost = (outputTokens / 1_000_000) * Number(pricing.output_per_mtok)
  return Math.max(0, inputCost + outputCost)
}

type BudgetRow = { daily_limit_usd: number; monthly_limit_usd: number }

async function getBudget(workspaceId: string): Promise<BudgetRow> {
  const service = createServiceClient()
  // Intenta budget propio del workspace
  const { data: own } = await service
    .from('llm_budgets')
    .select('daily_limit_usd, monthly_limit_usd')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (own) return own as any

  // Fallback al global (workspace_id IS NULL)
  const { data: global } = await service
    .from('llm_budgets')
    .select('daily_limit_usd, monthly_limit_usd')
    .is('workspace_id', null)
    .maybeSingle()
  if (global) return global as any

  // Si no hay ni global, default hardcoded paranoico: $0 (bloquea todo)
  return { daily_limit_usd: 0, monthly_limit_usd: 0 }
}

type UsageTotals = { day_usd: number; month_usd: number }

export async function getCurrentUsage(workspaceId: string): Promise<UsageTotals> {
  const service = createServiceClient()
  const now = new Date()
  const startDay = new Date(now); startDay.setUTCHours(0, 0, 0, 0)
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [dayRes, monthRes] = await Promise.all([
    service.rpc('llm_usage_sum', { p_workspace_id: workspaceId, p_from: startDay.toISOString() }),
    service.rpc('llm_usage_sum', { p_workspace_id: workspaceId, p_from: startMonth.toISOString() }),
  ])

  return {
    day_usd:   Number(dayRes.data ?? 0),
    month_usd: Number(monthRes.data ?? 0),
  }
}

// Pre-flight. Llama esto ANTES de invocar al LLM.
export async function assertBudget(workspaceId: string): Promise<void> {
  const [budget, usage] = await Promise.all([
    getBudget(workspaceId),
    getCurrentUsage(workspaceId),
  ])

  if (usage.day_usd >= Number(budget.daily_limit_usd)) {
    throw new BudgetExceededError(
      `Límite diario alcanzado ($${Number(budget.daily_limit_usd).toFixed(2)} USD). Intenta mañana o sube el tope.`,
      { scope: 'daily', used_usd: usage.day_usd, limit_usd: Number(budget.daily_limit_usd) },
    )
  }
  if (usage.month_usd >= Number(budget.monthly_limit_usd)) {
    throw new BudgetExceededError(
      `Límite mensual alcanzado ($${Number(budget.monthly_limit_usd).toFixed(2)} USD). Sube el tope en configuración.`,
      { scope: 'monthly', used_usd: usage.month_usd, limit_usd: Number(budget.monthly_limit_usd) },
    )
  }
}

export type RecordUsageInput = {
  workspaceId:   string
  userId?:       string | null
  sessionId?:    string | null
  provider:      string
  model:         string
  inputTokens:   number
  outputTokens:  number
}

export async function recordUsage(input: RecordUsageInput): Promise<{ cost_usd: number }> {
  const cost = await computeCost(input.provider, input.model, input.inputTokens, input.outputTokens)
  const service = createServiceClient()
  await service.from('llm_usage').insert({
    workspace_id:  input.workspaceId,
    user_id:       input.userId ?? null,
    session_id:    input.sessionId ?? null,
    provider:      input.provider,
    model:         input.model,
    input_tokens:  input.inputTokens,
    output_tokens: input.outputTokens,
    cost_usd:      cost,
  })
  return { cost_usd: cost }
}

export async function getUsageReport(workspaceId: string) {
  const [budget, usage] = await Promise.all([
    getBudget(workspaceId),
    getCurrentUsage(workspaceId),
  ])
  return {
    budget: {
      daily_limit_usd:   Number(budget.daily_limit_usd),
      monthly_limit_usd: Number(budget.monthly_limit_usd),
    },
    usage: {
      day_usd:   usage.day_usd,
      month_usd: usage.month_usd,
    },
    remaining: {
      day_usd:   Math.max(0, Number(budget.daily_limit_usd) - usage.day_usd),
      month_usd: Math.max(0, Number(budget.monthly_limit_usd) - usage.month_usd),
    },
  }
}
