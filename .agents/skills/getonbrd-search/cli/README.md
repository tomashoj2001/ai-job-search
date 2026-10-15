# getonbrd-cli

CLI for searching tech jobs on **[Get on Board](https://www.getonbrd.com)**, the Latin
American tech job board (on-site, hybrid, locally-remote and fully-remote roles;
postings in Spanish, English and some Portuguese).

**Data source**: Get on Board's official public API (`/api/v0/search/jobs`) for search;
the public job page (`/jobs/<slug>`) for detail, because the per-job API endpoint is
private (401).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch` + regex). `bun install` is optional and
only pulls dev type defs.

> **Courtesy note.** The public API is open to anyone but publishes no rate limit or
> SLA. Keep volume low (a handful of searches, `detail` only for shortlisted jobs).

## Installation

```bash
cd .agents/skills/getonbrd-search/cli
bun install   # optional — only installs TypeScript dev types
```

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search job listings (keywords optional) |
| `detail` | Fetch one job's full detail, including its remote-work policy |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts
`--format json|plain`. All errors are written to **stderr** as
`{ "error": "...", "code": "..." }` with exit code `1`; unknown flags are rejected.

## Quick examples

```bash
# Fully-remote React roles, last 14 days
bun run src/cli.ts search -q "react" --remote --jobage 14 --format table

# React Native roles open to residents of Argentina
bun run src/cli.ts search -q "react native" --country AR --format table

# Full detail (description + who may apply) for one job
bun run src/cli.ts detail senior-full-stack-engineer-worthy-remote --format plain
```

See `../SKILL.md` for semantics and `../url-reference.md` for endpoints and anchors.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). Optional. |
| `--remote` | | Switch: fully-remote jobs only (excludes locally-remote jobs). |
| `--country` | | ISO-3166 alpha-2 (`AR`, `CL`, `MX`, ...): locally-remote jobs open to that country + hybrid/on-site jobs there. Excludes fully-remote jobs. |
| `--jobage` | | Posted within N days — client-side filter (the API has no date param). |
| `--page` | | 1-indexed API page, 50 results/page. |
| `--limit` | `-n` | Cap results emitted (after `--jobage`). |
| `--lang` | | `en` \| `es` \| `pt` — response locale only. |
| `--format` | | `json` \| `table` \| `plain`. |

## Tests

```bash
bun run typecheck
bun run test   # offline parsing/validation suites + a 3-request live smoke test
```
