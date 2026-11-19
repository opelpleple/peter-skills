# Privacy rules

## What the scanner may read
Directory names, file names, file extensions, sizes and modified times; `git log` author, email and timestamp; manifests (`package.json`, `pyproject.toml`, `requirements.txt` and similar) for dependency names; the first meaningful line of a README; YAML frontmatter of `SKILL.md` and memory notes; bold headings in memory files passed with `--memory-file`.

It skips, without opening: any file whose name looks like `.env*`, `*token*`, `*secret*`, `*credential*`, `*password*`, `*apikey*`, `*.pem`, `*.key`, `id_rsa*`, `*.db`, `*.sqlite`; dot-directories; `secrets`, `.ssh`, `.gnupg`, `.aws`, `.config`; build and dependency folders.

## Private profile (`$ME_DIR/expertise/`)
May name the user's own projects and businesses. Never contains credentials, tokens, hostnames of private servers, other people's salaries or ratings, client revenue, or anything copied from a file body.

## Shared summary (portfolio, bio, intro)
Allowed: domain names, evidence counts (projects, commits, files, renders, skills), project categories ("B2B dashboards", "vertical drama series"), the user's own public brand names, tool and framework names.
Not allowed: other people's names (use Contact A, Contact B), client company names, revenue or prices, salary or level data, incident details, internal URLs and hostnames, IDs, folder paths under the home directory.
Replace a path with its category: `~/repo/acme-admin` becomes "an admin web app".
Show the summary to the user before it is saved outside `$ME_DIR`.
