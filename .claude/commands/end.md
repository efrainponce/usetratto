Activate caveman mode (full intensity).

Do these steps in order:

**1. Log**
Read @log.md. Add a new entry for today (date: use current date).
Format:
```
**~hora N** (increment from last entry of today, or start at hora 1 if new day)
- [bullet: qué se hizo]
- [bullet: qué funciona ahora]
- [bullet: qué queda pendiente si aplica]
```
Max 5 bullets. Concrete, no fluff. Write to @log.md.

**2. Commit**
Run: git status --short && git diff --stat
Stage all changed files: git add -A
Write a commit message following Conventional Commits (imperative, ≤50 chars subject).
Run the commit.

**3. Push**
Run: git push
Report result.

Output summary — 3 lines max:
**Log:** [entry added]
**Commit:** [message used]
**Push:** ok | [error]
