// Minimal Zod → JSON Schema converter para tool input_schema.
// Cubre solo los tipos que usamos en tools: object, string, number, boolean,
// array, enum, optional. NO tries to be general — si necesitas algo exótico,
// agregalo aquí.

import { z, ZodTypeAny } from 'zod'

type JsonSchema = Record<string, unknown>

export function zodToJsonSchema(schema: ZodTypeAny): JsonSchema {
  const def = (schema as any)._def
  const typeName = def?.typeName ?? def?.type

  // Zod v4 usa `type`, v3 usa `typeName`
  const t = typeName as string

  if (t === 'ZodObject' || t === 'object') {
    const shape: Record<string, ZodTypeAny> = typeof def.shape === 'function' ? def.shape() : def.shape
    const properties: Record<string, JsonSchema> = {}
    const required: string[] = []
    for (const [key, sub] of Object.entries(shape)) {
      const subDef = (sub as any)._def
      const subType = subDef?.typeName ?? subDef?.type
      const isOptional = subType === 'ZodOptional' || subType === 'optional' || subType === 'ZodDefault' || subType === 'default'
      properties[key] = zodToJsonSchema(sub as ZodTypeAny)
      if (!isOptional) required.push(key)
    }
    const out: JsonSchema = { type: 'object', properties }
    if (required.length) out.required = required
    return out
  }

  if (t === 'ZodOptional' || t === 'optional') {
    return zodToJsonSchema(def.innerType)
  }

  if (t === 'ZodDefault' || t === 'default') {
    return zodToJsonSchema(def.innerType)
  }

  if (t === 'ZodString' || t === 'string') {
    const out: JsonSchema = { type: 'string' }
    if (def.description) out.description = def.description
    return out
  }

  if (t === 'ZodNumber' || t === 'number') {
    return { type: 'number' }
  }

  if (t === 'ZodBoolean' || t === 'boolean') {
    return { type: 'boolean' }
  }

  if (t === 'ZodArray' || t === 'array') {
    return { type: 'array', items: zodToJsonSchema(def.type ?? def.element) }
  }

  if (t === 'ZodEnum' || t === 'enum') {
    const values = def.values ?? def.entries
    return { type: 'string', enum: Array.isArray(values) ? values : Object.values(values) }
  }

  if (t === 'ZodUnion' || t === 'union') {
    // Usamos anyOf — Gemini lo tolera, Anthropic también
    const options = def.options ?? def.types
    return { anyOf: options.map((o: ZodTypeAny) => zodToJsonSchema(o)) }
  }

  if (t === 'ZodLiteral' || t === 'literal') {
    const val = def.value
    return { type: typeof val, enum: [val] }
  }

  // Fallback: unknown → plain object permisivo
  return { type: 'object' }
}
