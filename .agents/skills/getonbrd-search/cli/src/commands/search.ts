import {
  PER_PAGE,
  SEARCH_URL,
  apiGet,
  salaryRange,
  toResult,
  writeError,
  type GobJob,
  type JobResult,
  type SearchEnvelope,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  jobage?: number // days; applied CLIENT-SIDE (the API has no posting-age parameter)
  page: number
  limit?: number
  format: "json" | "table" | "plain"
  remote?: boolean // remote=true -> fully_remote jobs only
  country?: string // ISO-3166 alpha-2 -> country_code
  lang?: "en" | "es" | "pt" // response locale only, not a posting-language filter
  now?: number // epoch ms; injectable for tests
}

export function buildUrl(opts: SearchOpts): string {
  const p = new URLSearchParams()
  if (opts.query) p.set("query", opts.query)
  p.set("page", String(opts.page))
  p.set("per_page", String(PER_PAGE))
  if (opts.remote) p.set("remote", "true")
  if (opts.country) p.set("country_code", opts.country)
  if (opts.lang) p.set("lang", opts.lang)
  // Resolve company/seniority/modality refs to names in the same request.
  p.set("expand", JSON.stringify(["company", "seniority", "modality"]))
  return `${SEARCH_URL}?${p.toString()}`
}

/** Keep jobs published within the last `days` days (client-side; checks every row). */
export function filterByAge(jobs: GobJob[], days: number | undefined, nowMs: number): GobJob[] {
  if (days === undefined) return jobs
  const cutoff = nowMs / 1000 - days * 86400
  return jobs.filter((j) => {
    const t = j.attributes?.published_at
    return typeof t === "number" && t >= cutoff
  })
}

interface Column {
  header: string
  width: number
  cell: (r: JobResult) => string
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  // ID goes last and untruncated: a cut slug cannot be passed to `detail`.
  const columns: Column[] = [
    { header: "DATE", width: 10, cell: (r) => r.date ?? "—" },
    { header: "TITLE", width: 40, cell: (r) => r.title },
    { header: "COMPANY", width: 22, cell: (r) => r.company ?? "—" },
    { header: "LOCATION", width: 22, cell: (r) => r.location ?? "—" },
    { header: "USD/MONTH", width: 11, cell: (r) => salaryRange(r.salary_min, r.salary_max) ?? "—" },
    { header: "ID", width: Math.max(2, ...rows.map((r) => r.id.length)), cell: (r) => r.id },
  ]
  const row = (cells: string[]) =>
    cells.map((c, i) => c.slice(0, columns[i].width).padEnd(columns[i].width)).join("  ").trimEnd()
  const header = row(columns.map((c) => c.header))
  const fullWidth = columns.reduce((sum, c) => sum + c.width, 0) + 2 * (columns.length - 1)
  return [header, "-".repeat(fullWidth), ...rows.map((r) => row(columns.map((c) => c.cell(r))))].join("\n")
}

function renderPlain(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  return rows
    .map((r) => {
      const salary = salaryRange(r.salary_min, r.salary_max)
      const facts = [r.company ?? "—", r.location ?? "—", r.date ?? "—"]
      if (r.seniority) facts.push(r.seniority)
      if (salary) facts.push(`USD ${salary}/month`)
      return [r.title, `  ${facts.join(" · ")}`, `  id: ${r.id}`, `  ${r.url}`].join("\n")
    })
    .join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const env = await apiGet<SearchEnvelope>(buildUrl(opts))
    if (!env) {
      // A 404 here means the search endpoint itself moved, not "no jobs" -
      // reporting it as an empty result set would hide the breakage.
      writeError(`${SEARCH_URL} returned 404 - the public search endpoint may have moved`, "SEARCH_FAILED")
      return 1
    }
    const fetched = env.data ?? []
    const fresh = filterByAge(fetched, opts.jobage, opts.now ?? Date.now())
    let rows = fresh.map(toResult)
    if (opts.limit !== undefined) rows = rows.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(rows) + "\n")
    } else {
      const meta = {
        count: rows.length,
        page: env.meta?.page ?? opts.page,
        total_pages: env.meta?.total_pages ?? null,
        per_page: env.meta?.per_page ?? PER_PAGE,
        // Rows the API returned for this page before the client-side --jobage
        // filter and --limit cap; lets a caller tell "page exhausted" from "filtered".
        fetched: fetched.length,
      }
      process.stdout.write(JSON.stringify({ meta, results: rows }, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
