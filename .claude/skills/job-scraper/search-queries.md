# Search Queries for Job Scraper

<!-- Tomás is based in Argentina and searching remote-first/worldwide, not the Danish
market this framework was originally built around. The Danish portal CLI tools
(.agents/skills/jobindex-search, jobbank-search, jobdanmark-search, jobnet-search) do
not apply and should be skipped. linkedin-search (.agents/skills/linkedin-search) is
country-agnostic and works out of the box - use it as the primary tool. -->

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search` and `freehire-search`; Danish demos and any skill you add with `/add-portal` are included the same way. You do **not** need a matching `site:` line below for those CLIs to run.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** write every query category in every language listed in your CLAUDE.md Languages table (typically 1-2, sometimes more). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule. Translate each category's keywords rather than machine-translating word-for-word (e.g. "Frontend Developer" -> "Desarrollador Frontend", not a literal word-for-word translation) if you work in more than one language.

## Search Sites

Primary (usable out of the box):
- **linkedin-search skill** (`.agents/skills/linkedin-search`) - country-agnostic, pass `--location "Remote"` or a specific city. Most "Remote" results are actually remote-within-country - always check the result's location before treating it as a real match.
- **getonbrd-search skill** (`.agents/skills/getonbrd-search`) - LatAm-focused tech jobs. Search is tag-based (`--query react`, `--query react-native`, `--query javascript`, ...), not free text. **Always read each result's `location` field** - remote postings state exactly which countries are eligible (e.g. "must reside in Argentina, Chile or Mexico"), and that's the real filter, not the word "remote" itself. Personal-use only - see `.agents/skills/getonbrd-search/SKILL.md` for the robots.txt note before scaling up volume.

Secondary (not yet wired into the CLI tooling - use Google `site:` searches, or build a
custom scraper skill with `/add-portal` if volume justifies it):
- **wellfound.com** (formerly AngelList) - startup-focused remote/hybrid roles, strong fit for Series A-C targets. Note: WebSearch results for this site were stale/closed in practice - verify before presenting.
- **remoteok.com** - remote-first job board. Note: blocks WebFetch (403) - would need a dedicated CLI like getonbrd-search to use reliably.
- **weworkremotely.com** - remote-first job board. Note: blocks WebFetch (403) - same caveat as above.
- Direct Google searches with `site:` filters for known target companies' career pages

## Query Categories

Queries are grouped by priority. Combine with "Remote" or "Remote, Worldwide" as the
location filter on every query except the Córdoba-hybrid exception. Write **each
category in every language from your Languages table** (see Language scope above).

**Organize by function, not job title.** The same underlying work carries different titles across companies and markets (a "Data Scientist" role at one employer may be posted as "Insights Analyst" or "Data Consultant" at another). Name each priority category after the function it covers, and list several plausible job titles as query variants within that category rather than betting an entire priority tier on one exact title string.

### Priority 1: Frontend / React Roles

Tomás's strongest and most desired direction - web-first React development.

```
site:linkedin.com/jobs "React Developer" Remote
site:linkedin.com/jobs "Frontend Engineer" Remote
site:linkedin.com/jobs "React Engineer" Remote
site:wellfound.com "Frontend Developer" React
linkedin-search: --query "React Developer" --location "Remote" --remote remote
linkedin-search: --query "Frontend Engineer" --location "Remote" --remote remote
getonbrd-search: --query "react" --jobage 14
getonbrd-search: --query "javascript" --jobage 14
```

### Priority 2: React Native / Mobile Roles

Secondary but strong direction - mobile migrations, biometric auth, app store releases.

```
site:linkedin.com/jobs "React Native Developer" Remote
site:linkedin.com/jobs "React Native Engineer" Remote
linkedin-search: --query "React Native Developer" --location "Remote" --remote remote
linkedin-search: --query "React Native Engineer" --location "Remote" --remote remote
getonbrd-search: --query "react-native" --jobage 14
```

### Priority 3: Broader Software / Product Engineering

Wider net for adjacent titles that still match the skill set.

```
site:linkedin.com/jobs "Software Developer" React Remote
site:linkedin.com/jobs "Product Engineer" React Remote
linkedin-search: --query "Software Developer" --location "Remote" --remote remote
linkedin-search: --query "Product Engineer" --location "Remote" --remote remote
```

### Priority 4: Domain-Flavored Searches

Combine role + target sector. Rotate sectors across scrape runs rather than running all
of them every time.

```
site:linkedin.com/jobs "Frontend Developer" fintech Remote
site:linkedin.com/jobs "Frontend Developer" crypto Remote
site:linkedin.com/jobs "Frontend Developer" e-commerce Remote
site:linkedin.com/jobs "Frontend Developer" gaming Remote
site:linkedin.com/jobs "React Developer" automotive Remote
site:linkedin.com/jobs "React Developer" music Remote
```

## Location Filter

- **Ideal:** Fully remote, any country/timezone - PASS
- **Acceptable exception:** Hybrid, based in Córdoba, Argentina - PASS
- **Borderline:** None - there is no partial-commute tier for this candidate
- **Too far / excluded:** Any on-site requirement outside Córdoba, or any hybrid role based outside Córdoba - FAIL, exclude from results

## Compensation Filter

When salary is listed in a posting, compare against baseline:
- Company based in a "first-world" country: baseline $3,000 USD/month
- Company based in LatAm: baseline $2,500 USD/month

Below-baseline postings are a flag, not an automatic exclusion - surface them with a note rather than dropping them silently.

## Language Filter

Your working languages and levels are in CLAUDE.md's Languages table. When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language you haven't declared at all is excluded; a posting requiring a higher level than you declared in a language you do work in is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape gaming" -> Priority 4 gaming query + 2-3 custom gaming-specific queries
- "/scrape react native" -> Priority 2 queries + broaden with additional mobile-specific terms
