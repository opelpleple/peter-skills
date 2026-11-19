# Voice rubric

Write `VOICE.md` as numbered sections, each a few bullet rules. Every rule carries a number from `stats.json` or a short pattern seen in the samples. A rule with neither is a guess; cut it.

| Section | What to measure | Where in stats.json |
|---|---|---|
| Shape | median length, share under 20 chars, multi-line rate, punctuation at line end, bullets/emoji outside announcements | `length_chars`, `format`, `emoji_rate` |
| Particles | per-100 rate of each particle, which end a line, cute spellings present or absent | `particles_per_100_msgs`, `endings` |
| Laughter | form (555, ha, lol) and rate | `laugh_rate`, `top_tokens` |
| Language mix | Thai only, English only, mixed; which English words stay in Latin script | `language`, `top_tokens` |
| Dialect | which regional words, with whom | `dialect_rate`, `dialect_words`, per contact |
| Self and address | self-reference per audience, address prefix + nickname | `self_reference`, `address_forms`, per contact |
| Asking | status ask phrasing, yes/no tags, question vs directive ratio | `acts`, samples via `--grep` |
| Agreeing and closing | ack words, thanks form, sign-off or none | `first_tokens`, `acts.thanks` |
| Pushing back | how a no is phrased, is the reason given, is authority handed back | `acts.pushback`, `--grep "ไม่ต้อง|no "` |
| Praising | rate, words, does it name specifics | `acts.praise`, `--grep` |
| Timing | active hours | `hours_local` |

## Reading the numbers
- Rates are per message, particles per 100 messages. A particle can appear twice in one message.
- `self_reference` counts the word พี่ even when it is an address ("พี่เอ"). Check samples before claiming the user calls themself พี่.
- `address_forms` is a candidate list; "พี่ขอ" is self-reference plus a verb, not a name.
- `endings: (none)` high means the user leaves lines bare. That is a rule, write it.
- Watch for contamination: messages written by bots or AI agents under the user's name (long, structured, perfect spelling). Note them and exclude them from the shape rules.

## Writing style for the rules
- State the target behaviour ("End on a particle or a word, no period") rather than a list of bans.
- Back every rate word ("freely", "always", "every line") with a measured share from the samples; "Isan on about 1 in 10 lines" beats "Isan freely".
- Record what is absent too: no greeting, no name, no self-reference with a formal contact are rules.
- Quote at most a few words per pattern. Paraphrase anything that names a client, a number, a project, a person outside the team or a credential.
