# Drafting with the profile

## Order of authority
1. The user's instructions for this message.
2. The contact card (`contacts/<slug>.md`).
3. `VOICE.md`.
4. Your defaults, last.

## Line checklist
For each line of the draft:
- **Length** close to the card median. Above it only if the content truly needs it; then split into short lines rather than one paragraph.
- **Opener** as the card says (name + particle, "Hello <name>", or nothing for close contacts).
- **Address and self-reference** exactly as the card (พี่/น้อง/nickname, ผม/พี่/I).
- **Particle rate** near the card. If the card shows the polite particle on half the lines, leave some lines bare.
- **Language** matches: English-only contacts get English (with their romanized tags if the card lists them); Thai contacts get Thai with English work nouns left in Latin script.
- **Dialect** only if the card shows it.
- **Laughter/emoji** only at the card's rate, and never on bad news.
- **No sign-off** unless the voice uses one.
- **Facts** trace to the request. Unknowns stay as `[placeholder]`.

## Unknown recipient
Polite level 2: name + polite particle opener, self as the neutral first person (ผม / ฉัน / I as the voice uses), full question form, no dialect, no laughter. Tell the user the card is missing and offer to build one.

## Uncertain closeness
If the card says "inferred" or "guess", give two drafts, one a level warmer and one a level cooler, and let the user pick. Record the pick in `overlay.json` so the card learns.

## Presenting
```
To: <name> (closeness N, <register>)
<draft>

Shaped by: <2 to 3 card rules used>
```
Stop there. Sending is a separate action the user approves and performs.

## Learning from edits
When the user edits a draft, diff it against yours. A repeated edit (always removes ครับ, always adds the name) belongs in the card's Do/Avoid via `overlay.json`, then rebuild cards.
