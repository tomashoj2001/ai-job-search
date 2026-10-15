#!/usr/bin/env bun
// Self-contained CLI for searching Get on Board (getonbrd.com), the Latin
// American tech job board. No external CLI framework and zero runtime
// dependencies, so it runs anywhere `bun` is available.
//
// Search uses Get on Board's official public API (no authentication); detail
// reads the public job page because the per-job API endpoint is private.
// Courtesy: no published rate limit or SLA - keep volume low.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { writeError } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

const ALIAS: Record<string, string> = { q: "query", n: "limit" }

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("-")) {
      const name = a.replace(/^-+/, "")
      const key = ALIAS[name] ?? name
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `getonbrd-cli — search tech jobs on Get on Board (getonbrd.com, Latin America)

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [flags]
  bun run src/cli.ts detail <slug|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (title, skill, role). Optional.
  --remote                Fully-remote jobs only (remote_modality = fully_remote).
                          Note: excludes "locally remote" jobs (remote but restricted
                          to a country/region) - use --country for those.
  --country <ISO2>        Jobs whose location includes this country, e.g. AR, CL, MX:
                          locally-remote jobs whose eligible zone covers it, plus
                          hybrid/on-site jobs located there. Excludes fully-remote jobs.
  --jobage <days>         Posted within N days. CLIENT-SIDE filter on the fetched
                          page (the API has no posting-age parameter).
  --page <n>              1-indexed API page (50 results/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side, after --jobage).
  --lang <en|es|pt>       Response locale (category names etc.). Not a filter.
  --format <fmt>          json (default) | table | plain.

DETAIL
  <slug|url>              A job slug (search result "id") or a getonbrd.com job URL.
                          Includes remote_policy: who may apply (residence rules).

EXAMPLES
  bun run src/cli.ts search -q "react" --limit 5 --format table
  bun run src/cli.ts search -q "react" --remote --jobage 14 --format table
  bun run src/cli.ts search -q "react native" --country AR --format table
  bun run src/cli.ts detail senior-full-stack-engineer-worthy-remote --format plain

Public API, no authentication. Best-effort source with no SLA - keep volume low.
`

// Long-form flag names each command accepts (parseFlags resolves q/n first).
// "help"/"h" pass so `search --help` still prints usage.
const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "jobage", "page", "limit", "format", "remote", "country", "lang", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

function badArg(message: string): number {
  writeError(message, "BAD_ARG")
  return 1
}

/** Whole number >= 1 (Number(), not parseInt(): "1.5" must fail, not truncate). */
function intFlag(name: string, raw: string | boolean | string[]): number | null {
  const val = typeof raw === "string" ? Number(raw.trim()) : NaN
  if (!Number.isInteger(val) || val < 1) {
    writeError(`--${name} must be a whole number of at least 1, got "${raw}"`, "BAD_ARG")
    return null
  }
  return val
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  // Reject unknown flags instead of silently discarding them: a discarded filter
  // changes what the search returns with no error. add-portal.md's contract
  // requires a bogus flag to exit 1 with a JSON error on stderr.
  const known = KNOWN_FLAGS[cmd]
  if (known) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || known.has(key)) continue
      writeError(
        `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
        "UNKNOWN_FLAG",
      )
      return 1
    }
  }

  if (cmd === "search") {
    if ((flags._ as string[]).length > 1) {
      return badArg(`unexpected argument "${(flags._ as string[])[1]}" - pass keywords with --query/-q`)
    }

    let query: string | undefined
    if (flags.query !== undefined) {
      if (typeof flags.query !== "string" || !flags.query.trim()) return badArg("--query/-q requires a value")
      query = flags.query.trim()
    }

    const ints: Partial<Record<"jobage" | "page" | "limit", number>> = {}
    for (const name of ["jobage", "page", "limit"] as const) {
      if (flags[name] === undefined) continue
      const v = intFlag(name, flags[name])
      if (v === null) return 1
      ints[name] = v
    }

    // --remote is a switch. Accept an explicit true/false too, but never let a
    // stray value (e.g. linkedin-search's "--remote remote") pass silently.
    let remote = false
    if (flags.remote !== undefined) {
      const r = flags.remote
      if (r === true || r === "true") remote = true
      else if (r === "false") remote = false
      else return badArg(`--remote is a switch (fully-remote jobs only) and takes no value, got "${r}"`)
    }

    let country: string | undefined
    if (flags.country !== undefined) {
      const c = typeof flags.country === "string" ? flags.country.trim() : ""
      if (!/^[A-Za-z]{2}$/.test(c)) return badArg(`--country must be an ISO-3166 alpha-2 code like AR, CL, MX, got "${flags.country}"`)
      country = c.toUpperCase()
    }

    let lang: SearchOpts["lang"]
    if (flags.lang !== undefined) {
      const l = typeof flags.lang === "string" ? flags.lang.trim().toLowerCase() : ""
      if (l !== "en" && l !== "es" && l !== "pt") return badArg(`--lang must be one of en|es|pt, got "${flags.lang}"`)
      lang = l
    }

    const fmt = flags.format === undefined ? "json" : flags.format
    if (fmt !== "json" && fmt !== "table" && fmt !== "plain") {
      return badArg(`--format must be one of json|table|plain, got "${fmt}"`)
    }

    const opts: SearchOpts = {
      query,
      jobage: ints.jobage,
      page: ints.page ?? 1,
      limit: ints.limit,
      format: fmt,
      remote,
      country,
      lang,
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      writeError("detail requires a <slug|url>", "NO_ID")
      return 1
    }
    const fmt = flags.format === undefined ? "json" : flags.format
    if (fmt !== "json" && fmt !== "plain") return badArg(`--format for detail must be json|plain, got "${fmt}"`)
    const opts: DetailOpts = { id, format: fmt }
    return runDetail(opts)
  }

  writeError(`Unknown command "${cmd}"`, "BAD_CMD")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), code: "INTERNAL_ERROR" }) + "\n",
    )
    process.exit(1)
  })
