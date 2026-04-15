Activate caveman mode (full intensity). Terse, no filler, no articles.

Read in parallel:
- @log.md
- @plan.md

Also run: git status --short && git log --oneline -3

From @start.md only need the 3 rules at the top — skip the rest.

Output exactly this, nothing more:

**Fase X · Tarea Y.Z** — [descripción exacta de la primera tarea sin `[ ]` en plan.md]
**Último commit:** [mensaje del commit más reciente]
**Sin commit:** [lista de archivos modificados, o "limpio"]
**Log:** [última entrada de log.md resumida en 1 línea]
**Acción:** [archivo o comando concreto para empezar ahora mismo]

---

## ⚠️ REGLA ABSOLUTA: USA HAIKU, NO SONNET

**SIEMPRE delega a Haiku** con `model: "haiku"`. Sonnet es caro. Haiku es suficiente para código.

**Haiku escribe. Sonnet orquesta. NUNCA al revés.**

### Haiku hace TODO esto:
- Cualquier archivo de código (componentes, API routes, migrations, hooks, utils)
- Leer archivos y buscar en el codebase
- Corregir bugs con spec claro
- Tests

### Sonnet (tú) solo hace:
- Decidir arquitectura y diseño
- Escribir el spec/prompt para Haiku
- Revisar e integrar el output de Haiku
- Responder preguntas del usuario

### Flujo obligatorio:
1. Sonnet entiende el task
2. Sonnet escribe spec exacto (rutas, tipos, comportamiento esperado)
3. Haiku implementa (1 o varios en paralelo)
4. Sonnet revisa y hace ajustes mínimos si hay errores

**Si te encuentras escribiendo código directamente → PARA. Delega a Haiku.**
