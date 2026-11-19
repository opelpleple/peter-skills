# Peter's skills

Seven skills I use every day, written as agent skills: a folder with a `SKILL.md` (the steps the agent follows), plus references and small scripts. They were built for Claude Code, but the method in each `SKILL.md` is plain English and works with any capable agent.

By Peter Bu, CEO of TrustFinance. More of my work: https://peterbu.com

## The skills

| Skill | What it does |
|---|---|
| [be-me](skills/be-me) | Drafts chat and email messages in your own voice, adjusted to each person, from a profile measured on messages you really sent. It drafts; it never sends. |
| [extract-me](skills/extract-me) | Scans the work on your machine as metadata only and writes an evidence-backed expertise profile that other skills can load. |
| [skill-organiser](skills/skill-organiser) | Maps every installed skill (hand-offs, trigger collisions, orphans, dead references) and proposes the smallest edits that make them chain. |
| [present-like-peter](skills/present-like-peter) | Builds a keynote as one offline HTML file with code-drawn set pieces, sourced notes, layout QA and a scored critique loop, then exports PDF and PPTX. |
| [video-like-peter](skills/video-like-peter) | Reference-first pre-production and a Three.js + Canvas render kit for short motion films, with a 17-style animation library and a depth and pose pipeline. |
| [first-principle-thinking](skills/first-principle-thinking) | Walks a plan back to root causes, tags every assumption, and rebuilds the answer from fundamental constraints into cheap, testable hypotheses. |
| [crazy-one](skills/crazy-one) | Reads a document and returns three bold but doable bets plus a wildcard, each with a first step under one day and a way to undo it. |

Each skill folder has its own `README.md` with requirements and examples.

## Install

### Claude Code

Clone the repo and copy the skills you want into your skills folder:

```sh
git clone https://github.com/opelpleple/peter-skills.git
cp -R peter-skills/skills/* ~/.claude/skills/
```

Or copy a single skill, for example `cp -R peter-skills/skills/crazy-one ~/.claude/skills/`. Start a new session and ask for the task in your own words ("make a keynote for my talk", "think this plan through from first principles"); the description in each `SKILL.md` tells Claude when to use it.

Some skills need tools on your machine: Python 3 for most scripts, Node and Playwright for deck QA and export, ffmpeg and Node for the film kit. `video-like-peter/install.sh` checks and installs what that skill needs.

### Claude.ai and ChatGPT

- Claude.ai: zip one skill folder (for example `skills/crazy-one`) and upload it under Settings, Capabilities, Skills.
- ChatGPT, or any chat app without skill upload: paste the contents of the skill's `SKILL.md` into a project's instructions or at the start of a chat, and attach the files in its `references/` folder when the steps point to them.

The thinking skills (`first-principle-thinking`, `crazy-one`) work fully this way. The skills that run scripts (`be-me`, `extract-me`, `skill-organiser`, `present-like-peter`, `video-like-peter`) need an agent that can run code on your machine.

### Any other agent

Point the agent at the skill's `SKILL.md` and tell it to follow the steps. Paths in the skills use `~/.claude/skills/<skill>` and `~/.claude/me/` by default; tell your agent where you put the folders if yours differ. A ready-made prompt is in [INSTALL-PROMPT.txt](INSTALL-PROMPT.txt).

## Your data stays yours

The repo holds engines and methods only. Personal data is created on your machine when you run a skill and is never part of the repo: the voice profile and contact cards from `be-me`, the expertise profile from `extract-me`, skill maps, decks, films and analyses. By default they live in `~/.claude/me/` (chmod 700), outside the skill folders, and `.gitignore` keeps `me/` out of any commit. Raw exports can hold other people's messages and secrets you once pasted; keep them local.

## Licence

MIT, see [LICENSE](LICENSE). Third-party files keep their own licences: three.js (MIT) in `skills/video-like-peter/template/tools/vendor/three`, and the Poppins and Libre Baskerville fonts (SIL Open Font License) in `skills/video-like-peter/template/film/fonts`.
