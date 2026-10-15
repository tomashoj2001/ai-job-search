import { BASE_URL, htmlGet, normalizeSlug, parseJobDetail, writeError, type JobDetail } from "../helpers.js"

export interface DetailOpts {
  id: string // a job slug (search result `id`) or a getonbrd.com job URL
  format: "json" | "plain"
}

function renderPlain(job: JobDetail): string {
  const lines = [job.title, `${job.company ?? "—"} · ${job.location ?? "—"}`]
  const field = (label: string, value: string | number | null) => {
    if (value !== null && value !== "") lines.push(`${label}: ${value}`)
  }
  field("Posted", job.date)
  field("Remote policy", job.remote_policy)
  field("Seniority", job.seniority)
  field("Employment", job.employment_type)
  field("Category", job.category)
  field("Salary", job.salary)
  field("Skills", job.skills.length ? job.skills.join(", ") : null)
  field("Applications", job.applications)
  field("Application language", job.application_language)
  lines.push("", job.description ?? "(no description)", "", `URL: ${job.url}`)
  if (job.apply_url) lines.push(`Apply: ${job.apply_url}`)
  lines.push(`id: ${job.id}`)
  return lines.join("\n")
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const slug = normalizeSlug(opts.id)
  if (!slug) {
    writeError(`could not parse a Get on Board job slug from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    // The API's /api/v0/jobs/{id} is private (401), so read the public page.
    const page = await htmlGet(`${BASE_URL}/jobs/${encodeURIComponent(slug)}`)
    if (!page) {
      writeError(`job "${slug}" not found (it may have been unpublished)`, "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(page.html, slug, page.url)
    process.stdout.write((opts.format === "plain" ? renderPlain(job) : JSON.stringify(job, null, 2)) + "\n")
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
