# Get on Board URL Reference

Endpoints and parsing anchors used by this skill (verified live 2026-10-15). This is
the file to update when Get on Board changes its API or job-page markup.

## Access

- `robots.txt` has **no** `Disallow` rules.
- The public API is documented in the official OpenAPI spec,
  `https://www.getonbrd.com/doc/openapi.yaml`, whose intro reads: "Public API — Open
  to anyone. Access the same data visible on the platform without logging in: job
  categories, company profiles, published jobs, and a job search endpoint. No
  authentication required." The private API needs a company subscription.
- User-Agent `Mozilla/5.0 (compatible; getonbrd-cli/1.0)` is accepted by both the API
  and the HTML pages.
- No published rate limit or SLA: keep volume low.

## Search (public API, JSON)

```
GET https://www.getonbrd.com/api/v0/search/jobs
```

| Param | Meaning | CLI flag | Notes |
|-------|---------|----------|-------|
| `query` | Free-text keywords | `--query` / `-q` | Broad match: also hits postings that only mention the term (e.g. sales roles for "react"). |
| `page` | Page number, starts at 1 | `--page` | Past the last page: `data: []`, `meta.total_pages` still reported. |
| `per_page` | Page size, max 120 | (fixed 50) | Fixed so `--page N` always means the same rows. ~7 KB per job with `expand`. |
| `remote` | `true` = **fully_remote only** | `--remote` | Verified: 35/35 results were `fully_remote`; `remote_local` jobs are excluded. |
| `country_code` | ISO-3166 alpha-2 | `--country` | See semantics below. Uppercase verified (`AR`); the spec example is lowercase (`pe`). |
| `lang` | Response locale `en`/`es`/`pt` | `--lang` | Localizes `category_name` and the pseudo-country (`"Remoto"`). Same result set (verified: 80 pages with and without). |
| `expand` | JSON array of relations | (always `["company","seniority","modality"]`) | URL-encoded, e.g. `%5B%22company%22%5D`. Resolves each to `data.attributes.name`. |
| `companies`, `featured`, `board_host` | Other documented filters | — | Not exposed by the CLI. |

Not supported:
- **No posting-age / date parameter** → `--jobage` is a client-side filter on
  `published_at`.
- **No category parameter** → `category=programming` is silently ignored (verified:
  identical `total_pages` and category mix). A separate
  `/api/v0/categories/{category_id}/jobs` endpoint exists but is not used.
- No city parameter.

### `country_code` semantics (observed, `query=react`, `country_code=AR`)

- 35 results across 2 pages: 33 `remote_local` + 2 `hybrid` jobs in Buenos Aires.
  **Zero `fully_remote`** jobs, although the unfiltered search contains several.
- The `remote_local` hits are jobs whose eligible zone includes Argentina. Two were
  checked on their detail pages: one allows "South America, Central America or
  Mexico", the other lists "Chile, Argentina, Colombia, Mexico, Uruguay, Costa Rica,
  El Salvador or Honduras". (Not every hit was checked; always confirm with
  `detail`'s `remote_policy`.)
- So: `--remote` and `--country` are complementary; a LatAm resident needs both
  searches to see everything they can apply to.

### Ordering

- Unfiltered and `remote=true`: strictly newest-first by `published_at` (verified on
  page 1, 20 and 35 rows).
- `country_code`: **not** strictly sorted — observed as two interleaved
  recency-sorted runs (e.g. 10-14 … 10-01, then 10-12 … 09-14). The client-side
  `--jobage` filter therefore checks every row rather than stopping at the first old one.

### Response structure

```
{ "data": [ <job> ... ], "meta": { "page", "per_page", "total_pages" } }
```

| Field path | Meaning | CLI field |
|------------|---------|-----------|
| `id` | Job slug, e.g. `desarrollador-a-frontend-senior-xintec-santiago` | `id` |
| `links.public_url` | `https://www.getonbrd.com/jobs/<slug>` | `url` |
| `attributes.title` | Title | `title` |
| `attributes.published_at` | Epoch **seconds** | `date` (UTC `YYYY-MM-DD`) |
| `attributes.remote` | Boolean | (used as location fallback) |
| `attributes.remote_modality` | `fully_remote` \| `remote_local` \| `hybrid` \| `no_remote` | `remote_modality`, `location` |
| `attributes.remote_zone` | Always `null` in observed data | — |
| `attributes.countries` | Office countries; `["Remote"]` / `["Remoto"]` for remote jobs (uninformative, dropped) | `countries`, `location` |
| `attributes.min_salary` / `max_salary` | Gross USD/month, often `null` | `salary_min` / `salary_max` |
| `attributes.category_name` | Localized category, e.g. `Programming` | `category` |
| `attributes.lang` | Posting language: `en`, `es`, or `lang_not_specified` | `lang` (`null` when unspecified) |
| `attributes.applications_count` | Applications so far | `applications` |
| `attributes.seniority.data.attributes.name` | With `expand`: `Sin experiencia`, `Junior`, `Semi Senior`, `Senior`, `Expert` (ids 1, 2, 3, 4, 5) | `seniority` |
| `attributes.modality.data.attributes.name` | With `expand`: `Full time`, `Part time`, `Freelance`, `Práctica/Internship` (ids 1–4) | `employment_type` |
| `attributes.company.data.attributes.name` | With `expand` | `company` |
| `attributes.company.data.attributes.country` | Company profile ISO2 | `company_country` |
| `attributes.location_regions` / `location_tenants` / `location_cities` | ID-only refs to the eligible zone | not resolved by the CLI |
| `attributes.description`, `functions`, `benefits`, `desirable`, `projects` | HTML bodies | not emitted by search (use `detail`) |

Seniority/modality fallbacks (when `expand` does not resolve) come from
`GET /api/v0/seniorities` and `GET /api/v0/modalities`.

## Detail (public HTML page)

`GET /api/v0/jobs/{id}` is part of the **private** API and answers **401**, so detail
reads the public page:

```
GET https://www.getonbrd.com/jobs/<slug>
```

It answers `301` to `https://www.getonbrd.com/jobs/<category>/<slug>` (followed);
an unknown slug answers **404** → `NOT_FOUND`. The CLI sends
`Accept-Language: en-US` so page chrome is English (`<html lang="en">`); posting
text stays in its own language. There is **no JSON-LD**; anchors are schema.org
microdata:

| Field | Anchor |
|-------|--------|
| title | `<span itemprop="title">` (fallback: `<title>… at … \| Get on Board`) |
| company | `itemprop="hiringOrganization"` block → `<strong itemprop="name">` |
| date | `<time datetime="…" itemprop="datePosted">` |
| header line | `<h2 class="size1 …">` split on `<span class="mx-3">\|</span>`: location \| seniority \| employment type \| category |
| location | `itemprop="jobLocation"` part; hybrid jobs embed a hidden `<div class="location-tooltip-content hide">` that is dropped |
| seniority | `<span itemprop="qualifications">` |
| category | `<a class="color-inherit" href="/jobs/<category>">` |
| salary | `itemprop="baseSalary"` → `content` of `minValue`, `maxValue`, `unitText` (`MONTH`), `currency` (`USD`) |
| skills | `<div class="gb-tags" itemprop="skills">` → `a.gb-tags__item` |
| applications | `<i …></i> N applications` |
| application language | `Requires applying in <Language>` (only when stated) |
| apply URL | `id="apply_bottom" href="…"` |
| description | `<div id="job-body" itemprop="description">`: sections of `<h3 class="font-black mb2">` (the posting's own, possibly Spanish, headings) + `<div class="gb-rich-txt …">`, then perks (`gb-fluid-boxes`) |
| remote policy | the **only `<h2>` inside `#job-body`** ("Remote work policy"), then `<p><strong>LABEL</strong></p>` and `<p …>SENTENCE</p>` |

Remote-policy labels seen: `Fully remote` ("Candidates can reside anywhere in the
world."), `Locally remote only` ("Position is 100% remote, but candidates must reside
in …"), `Hybrid` ("This job is performed partly from home and partly at the office in
Santiago (Chile)."). The CLI maps labels to `remote_modality`.

### Quirks

- **Hidden watermarks:** the job body contains paragraphs like
  `<p class="u8c81c00d">GETONBRD Job ID: 64054</p>`, "This job is published by
  getonbrd.com.", "Apply without intermediaries through Get on Board.". Their class
  names are random per request and an inline `<style>` hides them
  (`.u8c81c00d, .x37fd5835 { position: fixed; top: 100%; }`). The CLI reads that rule
  and drops those paragraphs (fallback: class shaped like one letter + 8 hex digits).
  The `gb-rich-txt` sibling class is also random per request — never anchor on it.
- **Header vs policy disagree:** the header location tooltip can differ from the
  policy section (one job: header "must reside in Mexico", policy "North America,
  South America or Central America"; another: header "South America, Central America
  or Mexico", policy an explicit country list). `remote_policy` comes from the policy
  section; the header tooltip is only a fallback when the section is missing.
- Closed/unpublished postings were not observed; an unknown slug is a plain 404.
