---
name: getonbrd-search
version: 1.0.0
description: >
  Use this skill to search live tech job listings on Get on Board (getonbrd.com),
  the Latin American tech job board (Chile, Argentina, Mexico, Colombia, Peru and
  remote roles open to LatAm residents), or to look up a specific Get on Board
  posting and its remote-work eligibility rules. Postings are in Spanish, English
  and some Portuguese. Trigger phrases: find tech jobs in Latin America, LatAm
  remote developer jobs, remote jobs open to Argentina, Get on Board jobs,
  getonbrd, look up this Get on Board posting; empleos, ofertas de trabajo,
  trabajo remoto, búsqueda de empleo, empleos tech en Latinoamérica, trabajo de
  programador, desarrollador remoto; vagas, vagas remotas, vagas de
  desenvolvedor.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/getonbrd-search/cli/src/cli.ts *)
---

# Get on Board Search Skill

Search live tech job listings from **[Get on Board](https://www.getonbrd.com)**, the
Latin American tech job board (programming, data, design, DevOps/QA, product, and
some sales/ops roles at tech companies). Covers on-site and hybrid roles across
LatAm, roles that are remote but restricted to a country/region, and fully-remote
roles. No authentication, no API key, and **zero runtime dependencies** — it runs
with just `bun`.

Search uses Get on Board's **official public API**, which its OpenAPI spec describes
as "open to anyone ... no authentication required". Detail reads the public job page
(the per-job API endpoint is private).

## ℹ️ Courtesy note (best-effort, no SLA)

The public API publishes no rate limit or SLA. Keep volume low: a handful of
searches per run, `detail` only for shortlisted jobs, no bulk crawling. The CLI
retries 429/5xx with backoff and exits non-zero with a clear error if the site is
unreachable, so an outage degrades this source instead of breaking a workflow.

## When to use this skill

- Search LatAm tech jobs by keyword, optionally fully-remote only or by country
- Find remote roles a LatAm resident is actually eligible for (`--country <ISO2>`)
- Read one posting's full description and **remote-work policy** (who may apply)

## Commands

### Search job listings

```bash
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search [-q "<keywords>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keywords (title, skill, role). Optional.
- `--remote` — **fully-remote jobs only** (`remote_modality: fully_remote`). A
  switch: it takes no value. It **excludes** "locally remote" jobs (remote, but
  residence restricted to a country/region) — use `--country` for those.
- `--country <ISO2>` — jobs whose location includes that country (`AR`, `CL`, `MX`,
  `CO`, `PE`, `UY`, ...): locally-remote jobs whose eligible zone covers it, plus
  hybrid/on-site jobs located there. It **excludes** fully-remote jobs. There is no
  city parameter (`--location` is not supported).
- `--jobage <days>` — posted within N days. **Client-side filter**: the API has no
  posting-age parameter, so the CLI fetches the page and drops older rows.
- `--page <n>` — 1-indexed API page, 50 results per page. Default 1.
- `--limit <n>` / `-n <n>` — cap results emitted (client-side, after `--jobage`).
- `--lang en|es|pt` — response locale (category names, etc.). **Not** a filter.
- `--format json|table|plain` — default `json`.

> **Covering everything a LatAm resident can apply to takes two searches:**
> `--remote` (fully remote, anywhere) **and** `--country <your ISO2>` (locally
> remote zones that include your country, plus local hybrid/on-site roles).
> A plain search without either flag returns all modalities in all countries.

### Fetch full job detail

```bash
bun run .agents/skills/getonbrd-search/cli/src/cli.ts detail <slug|url> [--format json|plain]
```

`slug` is the `id` from a `search` result (e.g. `senior-full-stack-engineer-worthy-remote`).
A full `https://www.getonbrd.com/jobs/...` URL also works. Returns title, company,
date, **`remote_policy`** (e.g. "Locally remote only: Position is 100% remote, but
candidates must reside in South America and Central America."), `remote_modality`,
seniority, employment type, category, salary, skills, application count, required
application language, apply URL, and the full description as readable text.

**`remote_policy` is the real eligibility rule** — check it before applying to any
`remote_local` job. Search results cannot tell you which countries a locally-remote
job accepts.

## Usage examples

```bash
# Fully-remote React roles posted in the last 14 days
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search -q "react" --remote --jobage 14 --format table

# React Native roles open to residents of Argentina (remote-local + AR hybrid/on-site)
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search -q "react native" --country AR --format table

# Frontend roles open to Argentina, last 7 days, machine-readable
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search -q "frontend" --country AR --jobage 7 --format json

# Full-stack roles in Chile (mostly hybrid in Santiago)
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search -q "fullstack" --country CL --format table

# TypeScript roles in Mexico, category names in Spanish
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search -q "typescript" --country MX --lang es --format plain

# Full details + remote-work policy for a specific job
bun run .agents/skills/getonbrd-search/cli/src/cli.ts detail senior-full-stack-engineer-worthy-remote --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning (date, title, company, location, USD/month, id) |
| `plain` | Reading a single job's full detail (`detail` command) |

Search JSON is `{ "meta": { "count", "page", "total_pages", "per_page", "fetched" }, "results": [...] }`.
Each result has `id` (the job slug), `title`, `company`, `location`, `date`
(`YYYY-MM-DD`), `url`, plus `remote_modality`, `countries`, `salary_min`,
`salary_max` (USD/month), `seniority`, `employment_type`, `category`, `lang`,
`company_country`, and `applications`. Missing values are `null`, never omitted.
`meta.fetched` is the number of rows the API returned for the page before
`--jobage`/`--limit`.

`location` is derived from `remote_modality` + `countries`:

| `remote_modality` | `location` |
|-------------------|------------|
| `fully_remote` | `Remote (fully)` |
| `remote_local` | `Remote (local)` — zone in detail's `remote_policy` |
| `hybrid` | `Hybrid - Chile` (`Hybrid` if no country is listed) |
| `no_remote` | `On-site - Chile` (`On-site` if no country is listed) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the
process exits with code `1` (unknown flags included — nothing is silently ignored).

## Notes

- **Ordering:** plain and `--remote` searches come back newest-first. `--country`
  results are only roughly newest-first (observed as interleaved recency-sorted
  runs), so the `--jobage` filter checks every row and never stops early. When
  paging for a date window, continue while `meta.page < meta.total_pages`.
- **Keyword matching is broad:** `-q "react"` also returns sales/ops roles at
  companies whose posting mentions React. Pre-filter on `title` before reading
  details.
- **`countries`** is empty for remote jobs (the API's `"Remote"` placeholder is
  dropped); for hybrid/on-site jobs it lists the office countries.
- **Salaries** are gross USD/month as published by the company, often `null`.
- **`lang`** is the posting's declared language (observed: `en`, `es`), `null` when
  the poster did not specify one (common). Detail's `application_language` ("Requires applying
  in English") is shown only when the page states it.
- **`company_country`** is the ISO2 country of the company profile (e.g. `CL`, `US`)
  — useful for judging which market a company's compensation is benchmarked to.
- There is **no category filter** on search (a `category` param is silently ignored
  by the API), so this CLI does not offer one.
- `detail`'s `location` is the header label the site shows (e.g. "Remote (Mexico)");
  it can be narrower or broader than the policy section. Trust `remote_policy`.
- Endpoint, field and HTML-anchor details live in `url-reference.md`.
