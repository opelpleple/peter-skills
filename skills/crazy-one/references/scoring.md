# Kill pass and scoring

## Kill list (run before scoring, at every dial)

Kill an idea, and write the reason, if it would:

1. **Harm people**: physical, financial, psychological, or privacy harm to users, staff, or third parties.
2. **Deceive**: impersonate a real person or organisation, fake reviews, records or endorsements, hide that something is AI made or unofficial when that matters, dark patterns.
3. **Break law or rights**: trademark or copyright misuse, defamation, scraping or reusing data without rights, personal data collected without consent, regulated advice given without a licence.
4. **Invent facts**: present a forecast, guess or generated claim about a real person or company as fact.
5. **Violate a hard constraint** the document owner wrote (the "never" rules found in step 1).
6. **Win by exploiting someone**: attention tricks on vulnerable people, unpaid labour presented as fun when it is really extraction.

An idea that is only *risky* (legal grey zone, reputation exposure) is not killed; it stays alive with a low Reversibility and a named risk. Only certainty of harm kills.

## The four axes (1 to 5)

| Axis | 1 | 3 | 5 |
|---|---|---|---|
| **Impact** (on the real goal from the frame, not the stated goal) | cosmetic | clearly better result | changes what the work proves or who it reaches |
| **Feasibility** (with the team, tools and rules in the document) | needs new money, people or permission | a few days of work with what exists | a first version in a day with what exists |
| **Reversibility** | public and permanent once done | can be rolled back with some cost | fully local, deletable, nobody notices |
| **Crazy** (distance from the sacred assumptions) | a tweak the author might already plan | breaks one soft constraint | breaks a sacred assumption the document never questioned |

Write one line of reasoning for Impact on every idea. Other axes may stay bare numbers unless they are 1 or 5.

## Ranking

- Rank by `Impact x Feasibility`. Ties: higher Crazy first, then higher Reversibility.
- Gates for the top 3: Crazy at or above the dial minimum (`sane` 2, `bold` 3, `unhinged` 4), Reversibility 3 or more.
- Wildcard eligibility: a live idea not in the top 3 is eligible if any of these hold:
  - it failed the Crazy gate (Crazy below the dial minimum);
  - it failed the Reversibility gate (Reversibility below 3);
  - it is too big (Feasibility 2 or less).
  Killed ideas are never eligible.
- Wildcard: the highest Impact eligible idea. Ties: higher Crazy first, then higher Reversibility. Name the condition that made it eligible.

## First step test

A first step passes only if all are true:

- It takes one person under one day.
- It costs no money and spends no credits.
- It publishes nothing, sends nothing to anyone, deploys nothing.
- Its result is something you can look at (a prototype, a file, a mock, a three person test) and judge.
