# Output template

Write the run as one Markdown file. Keep the order; readers skip to "The bets".

```markdown
# crazy-one: <document title>

Dial: <sane | bold | unhinged>. Source: <path or name>. Date: <YYYY-MM-DD>.
Generated <n> ideas with 8 operators. Killed <k>. Merged <m>. Scored <s>.

## The bets

### 1. <Bet name> (<idea ids>)
- **The move**: one or two sentences.
- **Why it serves the real goal**:
- **Assumption it breaks**:
- **First step (under one day)**:
- **Keep going if**:
- **Main risk**:
- **Undo**:
- Scores: Impact <n>, Feasibility <n>, Reversibility <n>, Crazy <n>.

### 2. ...
### 3. ...

### Wildcard: <name> (<id>)
Same eight fields (seven text fields plus Scores), plus the eligibility condition it met (failed the Crazy gate, failed the Reversibility gate, or too big at Feasibility 2 or less) and why it is still worth a look.

Runner-up: <id> <name>, one line.

## Frame

- Real goal:
- Audience:
- Hard constraints:
- Soft constraints:
- Sacred assumptions: A1 ... A5+

## All ideas

| id | operator | idea | breaks | I | F | R | C | status |
|---|---|---|---|---|---|---|---|---|

## Killed

| id | idea | reason |
|---|---|---|
```

Chat hand back: the dial used, the three bet names, the wildcard, the file path, and one sentence on which bet to start first.
