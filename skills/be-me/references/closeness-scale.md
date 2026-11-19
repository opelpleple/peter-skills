# Closeness scale

Closeness is how the user writes to this person, not how much they like them. Score it from evidence in the user's own messages.

| Level | Name | What the user's messages look like |
|---|---|---|
| 1 | Formal | Full sentences, greeting and thanks every time, polite particle on every line (ครับ/ค่ะ), title or คุณ, no jokes. Clients, regulators, people met once. |
| 2 | Polite | Polite particle on most lines, deferential acks (ครับผม), questions phrased fully (...ใช่ไหมครับ), no dialect, no laughter. HR, finance, seniors in other teams, new reports. |
| 3 | Working-casual | Particle on about half the lines, nickname, short lines, occasional 555, direct asks. Day-to-day teammates. |
| 4 | Casual | Few particles, very short lines, frequent 555, dialect slips in, teasing, offers of help. Close team, long history. |
| 5 | Intimate | Banter, dialect freely, no politeness markers, inside references. Co-founders, close friends, family. |

## Inference (what `build_cards.py` does)
Start at 3, then:
- polite particle under 40 per 100 messages: +0.5; over 90: -1
- deferential form (ครับผม) over 25 per 100: -0.5
- laughter in 10% or more of messages: +0.5
- regional dialect in 4% or more: +0.5
- 300+ direct messages: +0.5
- under 30 direct messages: mark as a guess
Clamp to 1..5. English-only contacts skip the particle rules; judge them by wording (contractions, jokes, "my bad", greetings).

## Reviewing
The formula is a starting point. Override it in `overlay.json` after reading samples when:
- seniority flips the read (very polite to an older close colleague can still be 4: use the address form, keep the warmth),
- the volume is mostly logistics,
- the person is a report the user is coaching (often 3 with supportive phrasing),
- there is a known relationship the data cannot show.
Record the reason in `note`.
