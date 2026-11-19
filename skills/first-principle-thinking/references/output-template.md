# Output template

Use this structure for the written analysis (solo mode, or the end of interactive mode). Keep tables, they make outputs comparable across runs.

```markdown
# <Problem in a few words>: first principles

Date: YYYY-MM-DD. Mode: solo | interactive.

## 1. The problem, restated
<one sentence, no solution words>
Decision this informs: <one line>

## 2. Evidence
| Source | What it shows |
|---|---|
Unread or unavailable: <list, or "none">

## 3. Assumptions
| # | Assumption | Tag | Reason or source |
|---|---|---|---|
Tag count: physics n, data n, convention n, habit n.

## 4. Question ladder
| # | Rung reached | Grounded or released | What it was protecting / what is true |
|---|---|---|---|

## 5. Root cause
<two or three sentences: why the problem exists, stated as the released assumptions that produce it>

## 6. Fundamental constraints
C1 ...
C2 ...

## 7. Rebuild
### Answer A: <name>
| Part | Serves |
|---|---|
### Answer B ...
### Answer C (the one convention rejects) ...
Pick: <answer> because <reason>.

## 8. Hypotheses, cheapest test first
| # | Hypothesis | Cheapest test | Cost | Kill if |
|---|---|---|---|---|

## 9. What this analysis did not check
<honest list>
```

Rules for the write-up:
- Every claim that is not physics cites a row in section 2.
- The root cause names released assumptions, not people.
- Section 9 is never empty unless you truly checked everything.
