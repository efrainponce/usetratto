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

## Modo de trabajo

- Usa **subagentes Haiku** (`model: "haiku"`) para implementación concreta: migrations SQL, API routes, componentes con spec claro.
- Tú eres el **orquestador**: diseñas, delegas con specs exactos, revisas, integras.
- Lanza subagentes **en paralelo** cuando las tareas son independientes.
- Nunca delegues decisiones arquitectónicas a Haiku — solo ejecución.
