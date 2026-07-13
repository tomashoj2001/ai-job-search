# Search Queries for Job Scraper

<!-- Tomás is based in Argentina and searching remote-first/worldwide, not the Danish
market this framework was originally built around. The Danish portal CLI tools
(.agents/skills/jobindex-search, jobbank-search, jobdanmark-search, jobnet-search) do
not apply and should be skipped. linkedin-search (.agents/skills/linkedin-search) is
country-agnostic and works out of the box - use it as the primary tool. -->

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
location filter on every query except the Córdoba-hybrid exception.

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

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape gaming" -> Priority 4 gaming query + 2-3 custom gaming-specific queries
- "/scrape react native" -> Priority 2 queries + broaden with additional mobile-specific terms
