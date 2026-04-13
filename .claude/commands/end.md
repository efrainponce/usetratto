Activate caveman mode (full intensity).

Do these steps in order:

**1. Log**
Read @log.md. Add a new entry for today (date: use current date).
Format:
```
**~sesión N** (increment from last entry of today, or start at sesión 1 if new day)
- [bullet: qué se hizo]
- [bullet: qué funciona ahora]
- [bullet: qué queda pendiente si aplica]
```
Max 5 bullets. Concrete, no fluff. Write to @log.md.

**2. Plan**
Read @plan.md. Mark every task completed this session with `[x]` (was `[ ]`).
Only mark tasks that were actually finished and verified. Write to @plan.md.

**3. Commit**
Run: git status --short && git diff --stat
Stage all changed files: git add -A
Write a commit message following Conventional Commits (imperative, ≤50 chars subject).
Run the commit.

**4. Push**
Run: git push
Report result.

Output summary — 3 lines max:
**Log:** [entry added]
**Plan:** [tasks marked done, e.g. "2.1, 2.2" or "ninguna"]
**Commit:** [message used]
**Push:** ok | [error]
