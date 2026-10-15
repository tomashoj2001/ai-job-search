// Data source: Get on Board (getonbrd.com), the Latin American tech job board.
//
// - Search uses the official PUBLIC API (`/api/v0/search/jobs`): JSON, no
//   authentication, documented at https://www.getonbrd.com/doc/openapi.yaml as
//   "Open to anyone ... no authentication required".
// - Detail cannot use the API: `/api/v0/jobs/{id}` belongs to the private
//   (company-subscription) API and answers 401. So `detail` reads the public job
//   page (`/jobs/<slug>`) and parses it with regex anchored on its schema.org
//   microdata (`itemprop=...`) and the `id="job-body"` container - the same
//   zero-dependency approach as linkedin-search.
//
// Courtesy: the public API has no published rate limit or SLA. Keep volume low.

export const BASE_URL = "https://www.getonbrd.com"
export const SEARCH_URL = `${BASE_URL}/api/v0/search/jobs`

/** Fixed API page size. Kept constant so `--page N` always means the same rows. */
export const PER_PAGE = 50

// Honest UA naming the tool (portal-skill contract); verified accepted by both
// the API and the HTML job pages.
const UA = "Mozilla/5.0 (compatible; getonbrd-cli/1.0)"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/**
 * Thrown by `parseJobDetail` when a fetched page does not parse as a job posting
 * (e.g. a 200 redirect to the jobs index, a login wall, or a markup change).
 * `code` is the CLI error code the command reports via `writeError`.
 */
export class JobParseError extends Error {
  readonly code = "PARSE_ERROR"
  constructor(message: string) {
    super(message)
    this.name = "JobParseError"
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * GET with exponential backoff + jitter on 429/5xx (max 6 retries). Returns
 * `null` on a 404 so callers can report NOT_FOUND cleanly instead of crashing.
 * Redirects are followed (a bare `/jobs/<slug>` 301s to `/jobs/<category>/<slug>`).
 */
async function getWithBackoff(url: string, accept: string): Promise<Response | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: accept,
          // English page chrome keeps the HTML anchors (e.g. "applications",
          // "Requires applying in") stable; posting text stays in its own language.
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      })
    } catch (e) {
      // DNS failure / connection refused / timeout: fail fast with a clear message
      // so an outage degrades this source instead of hanging the caller.
      throw new Error(`could not reach getonbrd.com (${e instanceof Error ? e.message : String(e)})`)
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed after ${maxRetries} retries: ${response.status} ${response.statusText}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response
  }
  throw new Error("Request failed after max retries")
}

/** GET a JSON document from the public API. `null` on 404. */
export async function apiGet<T>(url: string): Promise<T | null> {
  const response = await getWithBackoff(url, "application/json")
  if (!response) return null
  const body = (await response.json().catch(() => null)) as T | null
  if (body === null) throw new Error("getonbrd API returned an unparseable response body")
  return body
}

/** GET an HTML page. `null` on 404; otherwise the body and the final (post-redirect) URL. */
export async function htmlGet(url: string): Promise<{ html: string; url: string } | null> {
  const response = await getWithBackoff(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
  if (!response) return null
  return { html: await response.text(), url: response.url || url }
}

// ---------------------------------------------------------------------------
// API shapes (only the fields this skill reads; the wire shape carries more).
// ---------------------------------------------------------------------------

/** A JSON:API-style relationship. With `expand`, `data.attributes` is populated. */
interface GobRef {
  data?: {
    id?: string | number
    type?: string
    attributes?: { name?: string; country?: string }
  } | null
}

export interface GobJob {
  id: string // the job slug, e.g. "desarrollador-a-frontend-senior-xintec-santiago"
  type?: string
  links?: { public_url?: string }
  attributes: {
    title?: string
    published_at?: number | null // epoch SECONDS
    remote?: boolean
    remote_modality?: string | null // fully_remote | remote_local | hybrid | no_remote
    countries?: string[] | null
    min_salary?: number | null // USD/month
    max_salary?: number | null
    category_name?: string | null
    lang?: string | null // en | es | pt | lang_not_specified
    applications_count?: number | null
    seniority?: GobRef
    modality?: GobRef
    company?: GobRef
  }
}

export interface SearchEnvelope {
  data?: GobJob[]
  meta?: { page?: number; per_page?: number; total_pages?: number }
}

/** Search result in the portal-skill contract shape (+ permitted extras). */
export interface JobResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null // YYYY-MM-DD (UTC) from published_at
  url: string
  remote_modality: string | null
  countries: string[]
  salary_min: number | null // USD/month
  salary_max: number | null // USD/month
  seniority: string | null
  employment_type: string | null
  category: string | null
  lang: string | null
  company_country: string | null // ISO2 of the company profile, e.g. "CL", "US"
  applications: number | null
}

// Fallback names when `expand` does not resolve a relationship. Values are the
// API's own names (GET /api/v0/seniorities, /api/v0/modalities, verified 2026-10-15).
const SENIORITY_NAMES: Record<string, string> = {
  "1": "Sin experiencia",
  "2": "Junior",
  "3": "Semi Senior",
  "4": "Senior",
  "5": "Expert",
}
const MODALITY_NAMES: Record<string, string> = {
  "1": "Full time",
  "2": "Part time",
  "3": "Freelance",
  "4": "Práctica/Internship",
}

function refName(ref: GobRef | undefined, fallback: Record<string, string>): string | null {
  const data = ref?.data
  if (!data) return null
  if (data.attributes?.name) return data.attributes.name
  return data.id !== undefined ? fallback[String(data.id)] ?? null : null
}

/**
 * `countries` holds a localized pseudo-country ("Remote" / "Remoto") for remote
 * jobs - it carries no information, so it is dropped and an empty array returned.
 */
export function realCountries(countries: string[] | null | undefined): string[] {
  return (countries ?? []).filter((c) => c && !/^remot[eo]$/i.test(c.trim()))
}

/**
 * Readable location derived from remote_modality + countries:
 *   fully_remote -> "Remote (fully)"
 *   remote_local -> "Remote (local)"  (residence restricted to a zone; see detail's remote_policy)
 *   hybrid       -> "Hybrid - Chile, Peru"   ("Hybrid" when no country is listed)
 *   no_remote    -> "On-site - Chile"        ("On-site" when no country is listed)
 *   other/null   -> countries joined, or "Remote" if the `remote` flag is set, else null
 */
export function deriveLocation(
  modality: string | null | undefined,
  countries: string[],
  remote?: boolean,
): string | null {
  const list = countries.join(", ")
  switch (modality) {
    case "fully_remote":
      return "Remote (fully)"
    case "remote_local":
      return "Remote (local)"
    case "hybrid":
      return list ? `Hybrid - ${list}` : "Hybrid"
    case "no_remote":
      return list ? `On-site - ${list}` : "On-site"
    default:
      if (list) return list
      return remote ? "Remote" : null
  }
}

/** Epoch seconds -> "YYYY-MM-DD" (UTC), or null. */
export function epochToDate(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

/** Reshape one API job into the contract result. Missing values are null, never omitted. */
export function toResult(job: GobJob): JobResult {
  const a = job.attributes ?? {}
  const countries = realCountries(a.countries)
  const modality = a.remote_modality ?? null
  const lang = a.lang && a.lang !== "lang_not_specified" ? a.lang : null
  return {
    id: job.id,
    title: (a.title ?? "").trim() || "(untitled)",
    company: a.company?.data?.attributes?.name?.trim() || null,
    location: deriveLocation(modality, countries, a.remote),
    date: epochToDate(a.published_at),
    url: job.links?.public_url || `${BASE_URL}/jobs/${job.id}`,
    remote_modality: modality,
    countries,
    salary_min: typeof a.min_salary === "number" ? a.min_salary : null,
    salary_max: typeof a.max_salary === "number" ? a.max_salary : null,
    seniority: refName(a.seniority, SENIORITY_NAMES),
    employment_type: refName(a.modality, MODALITY_NAMES),
    category: a.category_name || null,
    lang,
    company_country: a.company?.data?.attributes?.country || null,
    applications: typeof a.applications_count === "number" ? a.applications_count : null,
  }
}

/** "2200-3000", "2200+", "≤3000" or null - USD/month range for compact display. */
export function salaryRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return min === max ? `${min}` : `${min}-${max}`
  if (min !== null) return `${min}+`
  if (max !== null) return `up to ${max}`
  return null
}

// ---------------------------------------------------------------------------
// HTML helpers (detail page).
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", bull: "•", middot: "·",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
  iexcl: "¡", iquest: "¿", deg: "°", euro: "€", copy: "©", reg: "®", trade: "™",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ccedil: "ç", Ccedil: "Ç",
  atilde: "ã", otilde: "õ", Atilde: "Ã", Otilde: "Õ",
  acirc: "â", ecirc: "ê", ocirc: "ô", agrave: "à",
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

/** Decode named (common set), decimal and hex character references in one pass. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X"
      return numericEntity(parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10))
    }
    return NAMED_ENTITIES[body] ?? whole
  })
}

/** Strip tags, decode entities, collapse whitespace to single spaces. */
export function cleanInline(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
}

/**
 * Convert rich-text HTML into readable text: list items become "- " bullets,
 * block-level closers become line breaks, paragraphs are separated by a blank
 * line, entities are decoded and tags stripped.
 */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|ul|ol|h[1-6])>/gi, "\n\n")
    .replace(/<\/(li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
  return decodeHtmlEntities(text)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // `<li><p>..</p></li>` leaves a blank line between bullets; keep lists tight.
    .replace(/(?<=(?:^|\n)- [^\n]*)\n\n(?=- )/g, "\n")
    .trim()
}

/**
 * Inner HTML of the first element whose opening tag matches `openTag`, tracking
 * nesting depth of the same tag name so nested children do not end it early.
 */
export function extractElement(html: string, openTag: RegExp, tagName = "div"): string | null {
  const open = openTag.exec(html)
  if (!open) return null
  const openToken = `<${tagName}`
  const closeToken = `</${tagName}>`
  let i = open.index + open[0].length
  let depth = 1
  while (depth > 0 && i < html.length) {
    const nextOpen = html.indexOf(openToken, i)
    const nextClose = html.indexOf(closeToken, i)
    if (nextClose === -1) return null
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + openToken.length
    } else {
      depth--
      i = nextClose + closeToken.length
    }
  }
  return html.slice(open.index + open[0].length, i - closeToken.length)
}

/**
 * Get on Board injects hidden anti-copy watermark paragraphs into the job body
 * (e.g. `<p class="u8c81c00d">GETONBRD Job ID: 64054</p>`, "This job is published
 * by getonbrd.com."). Their class names are random per request and an inline
 * `<style>` hides them (`position: fixed; top: 100%`). We read the hidden class
 * names from that style rule and drop those paragraphs; if the rule is missing we
 * fall back to the observed class shape (one letter + 8 hex digits).
 */
export function removeWatermarks(bodyHtml: string, pageHtml: string): string {
  const hidden = new Set<string>()
  const ruleRe = /((?:\.[A-Za-z][\w-]*\s*,?\s*)+)\{[^}]*position:\s*fixed[^}]*top:\s*100%[^}]*\}/g
  let m: RegExpExecArray | null
  while ((m = ruleRe.exec(pageHtml)) !== null) {
    for (const cls of m[1].match(/\.[A-Za-z][\w-]*/g) ?? []) hidden.add(cls.slice(1))
  }
  return bodyHtml.replace(/<p class="([^"]+)"[^>]*>[\s\S]*?<\/p>/g, (whole, cls: string) => {
    const name = cls.trim()
    if (hidden.has(name)) return ""
    if (hidden.size === 0 && /^[a-z][0-9a-f]{8}$/.test(name)) return ""
    return whole
  })
}

/** Detail-page result. */
export interface JobDetail {
  id: string
  title: string
  company: string | null
  location: string | null // header location as the portal shows it, e.g. "Remote (Mexico)", "Santiago (Hybrid)"
  date: string | null // YYYY-MM-DD from itemprop="datePosted"
  url: string
  remote_modality: string | null // fully_remote | remote_local | hybrid | no_remote (from the policy label)
  remote_policy: string | null // "<label>: <sentence>" from the "Remote work policy" section
  seniority: string | null
  employment_type: string | null
  category: string | null
  salary_min: number | null
  salary_max: number | null
  salary: string | null // e.g. "USD 6000-8000/month"
  skills: string[]
  applications: number | null
  application_language: string | null // "Requires applying in <Language>"
  apply_url: string | null
  description: string | null
}

/** Map the policy label shown on the page to the API's remote_modality enum. */
export function labelToModality(label: string | null): string | null {
  if (!label) return null
  if (/fully remote|100% remot/i.test(label)) return "fully_remote"
  if (/locally remote|remote local|remoto local/i.test(label)) return "remote_local"
  if (/hybrid|h[ií]brido/i.test(label)) return "hybrid"
  if (/on-?site|in[- ]office|presencial|no remote/i.test(label)) return "no_remote"
  return null
}

/** Parse the remote-work policy (label + eligibility sentence) out of the job body. */
export function parseRemotePolicy(bodyHtml: string): { label: string | null; text: string | null } {
  // The job body has exactly one <h2>: the "Remote work policy" heading. It is
  // followed by <p><strong>LABEL</strong></p> and <p ...>SENTENCE</p>.
  const h2 = bodyHtml.search(/<h2[^>]*>/i)
  if (h2 === -1) return { label: null, text: null }
  const tail = bodyHtml.slice(h2)
  const label = tail.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)
  const sentence = tail.match(/<\/strong>\s*<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/i)
  return {
    label: label ? cleanInline(label[1]) || null : null,
    text: sentence ? cleanInline(sentence[1]) || null : null,
  }
}

/**
 * Parse a public job page into a JobDetail. `slug` is the requested job id.
 * Throws `JobParseError` when the page is not a job posting (see the check below).
 */
export function parseJobDetail(html: string, slug: string, finalUrl?: string): JobDetail {
  const microdataTitle = html.match(/itemprop="title"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? null
  const title =
    microdataTitle ??
    html.match(/<title>([\s\S]*?)(?: at [^<]*)?\| Get on Board/i)?.[1] ??
    null

  // Company: the hiringOrganization block's itemprop="name".
  const orgStart = html.search(/itemprop="hiringOrganization"/i)
  const orgChunk = orgStart === -1 ? "" : html.slice(orgStart, orgStart + 4000)
  const company = orgChunk.match(/itemprop="name"[^>]*>([\s\S]*?)<\//i)?.[1] ?? null

  const datePosted = html.match(/<time[^>]*datetime="([^"]+)"[^>]*itemprop="datePosted"/i)?.[1] ??
    html.match(/itemprop="datePosted"[^>]*datetime="([^"]+)"/i)?.[1] ??
    null

  // Header line: <h2> with location | seniority | employment type | category,
  // separated by <span class="mx-3">|</span>.
  const headerH2 = extractElement(html, /<h2 class="size1[^"]*"[^>]*>/i, "h2") ?? ""
  const parts = headerH2.split(/<span class="mx-3">\s*\|\s*<\/span>/i)
  let location: string | null = null
  let seniority: string | null = null
  let employmentType: string | null = null
  let category: string | null = null
  for (const [idx, part] of parts.entries()) {
    if (idx === 0 && /itemprop="jobLocation"/i.test(part)) {
      // Drop the hidden hybrid tooltip so only the visible label remains.
      const visible = part.replace(/<div class="location-tooltip-content[\s\S]*?<\/div>/i, "")
      location = cleanInline(visible) || null
    } else if (/itemprop="qualifications"/i.test(part)) {
      seniority = cleanInline(part) || null
    } else if (/<a [^>]*href="\/jobs\/[^"]+"/i.test(part)) {
      category = cleanInline(part) || null
    } else if (idx > 0) {
      employmentType = cleanInline(part) || employmentType
    }
  }

  // Salary (schema.org MonetaryAmount microdata).
  const num = (prop: string): number | null => {
    const v = html.match(new RegExp(`content="([\\d.]+)"[^>]*itemprop="${prop}"`, "i"))?.[1]
    return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null
  }
  const salaryMin = num("minValue")
  const salaryMax = num("maxValue")
  const currency = html.match(/content="([A-Z]{3})"[^>]*itemprop="currency"/i)?.[1] ?? null
  const unit = html.match(/content="([A-Z]+)"[^>]*itemprop="unitText"/i)?.[1] ?? null
  const range = salaryRange(salaryMin, salaryMax)
  const salary = range
    ? `${currency ? currency + " " : ""}${range}${unit ? "/" + unit.toLowerCase() : ""}`
    : null

  // Skills: the gb-tags block (itemprop="skills").
  const tagsHtml = extractElement(html, /<div class="gb-tags"[^>]*itemprop="skills"[^>]*>/i) ?? ""
  const skills = [...tagsHtml.matchAll(/<a [^>]*class="gb-tags__item"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => cleanInline(m[1]))
    .filter(Boolean)

  const applications = html.match(/<\/i>\s*(\d[\d,.]*)\s*applications?\b/i)?.[1]
  const applicationLanguage = html.match(/Requires applying in ([A-Z][a-zA-Z]+)/)?.[1] ?? null
  const applyUrl = html.match(/id="apply_bottom"[^>]*href="([^"]+)"/i)?.[1] ??
    html.match(/href="([^"]+)"[^>]*id="apply_bottom"/i)?.[1] ??
    null

  // Body: description sections + perks, then the Remote work policy section.
  let description: string | null = null
  let policy: { label: string | null; text: string | null } = { label: null, text: null }
  const bodyRaw = extractElement(html, /<div id="job-body"[^>]*>/i)
  if (bodyRaw) {
    const body = removeWatermarks(bodyRaw, html)
    policy = parseRemotePolicy(body)
    const h2 = body.search(/<h2[^>]*>/i)
    const descHtml = h2 === -1 ? body : body.slice(0, h2)
    description = htmlToText(descHtml) || null
  }

  // Every field is optional, so without this check a page that is not a job
  // posting would come back as an empty record that callers treat as a real job.
  // Require at least one posting-specific anchor: the microdata title or a
  // non-empty job body. The <title> fallback does not count - every getonbrd page
  // has one (the jobs index reads "Curated tech jobs in Latin America | Get on Board").
  const hasPostingTitle = microdataTitle !== null && cleanInline(microdataTitle) !== ""
  if (!hasPostingTitle && !description) {
    throw new JobParseError(
      `${finalUrl || `${BASE_URL}/jobs/${slug}`} did not parse as a Get on Board job posting ` +
        `(no itemprop="title" and no job body) - it may have redirected elsewhere or the page markup changed`,
    )
  }

  // Fallback: the header location tooltip carries the same eligibility sentence
  // (though sometimes less specific than the policy section).
  if (!policy.text) {
    policy.text = html.match(/title="(Position is 100% remote[^"]*)"/i)?.[1] ?? null
    if (policy.text) policy.text = decodeHtmlEntities(policy.text)
  }
  const remotePolicy = policy.label && policy.text
    ? `${policy.label}: ${policy.text}`
    : policy.text ?? policy.label

  return {
    id: slug,
    title: title ? cleanInline(title) || "(untitled)" : "(untitled)",
    company: company ? cleanInline(company) || null : null,
    location,
    date: datePosted ? datePosted.slice(0, 10) : null,
    url: finalUrl || `${BASE_URL}/jobs/${slug}`,
    remote_modality: labelToModality(policy.label),
    remote_policy: remotePolicy,
    seniority,
    employment_type: employmentType,
    category,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary,
    skills,
    applications: applications ? Number(applications.replace(/[,.]/g, "")) : null,
    application_language: applicationLanguage,
    apply_url: applyUrl ? decodeHtmlEntities(applyUrl) : null,
    description,
  }
}

/**
 * Extract a job slug from a bare slug or any getonbrd.com job URL:
 *   senior-full-stack-engineer-worthy-remote
 *   https://www.getonbrd.com/jobs/senior-full-stack-engineer-worthy-remote
 *   https://www.getonbrd.com/jobs/programming/senior-full-stack-engineer-worthy-remote
 *   https://www.getonbrd.com/jobs/<slug>/applications/new
 */
export function normalizeSlug(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) return trimmed.toLowerCase()
  if (!/getonbrd\.com|^\/?jobs\//i.test(trimmed)) return null
  const path = trimmed.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0]
  const segments = path.split("/").filter(Boolean)
  const jobsIdx = segments.indexOf("jobs")
  if (jobsIdx === -1) return null
  let rest = segments.slice(jobsIdx + 1)
  const appIdx = rest.indexOf("applications")
  if (appIdx !== -1) rest = rest.slice(0, appIdx)
  const slug = rest[rest.length - 1]
  return slug && /^[a-z0-9][a-z0-9-]*$/i.test(slug) ? slug.toLowerCase() : null
}
