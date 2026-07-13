# Job Evaluation Framework

<!-- SETUP: Skill match areas and career goals are personalized by running /setup -->

## Scoring Dimensions

Evaluate each job posting against these five dimensions:

### 1. Technical Skills Match (0-100)
How well do the required/preferred skills align with the candidate's capabilities?

| Score | Meaning |
|-------|---------|
| 80-100 | Core requirements are primary skills |
| 60-79 | Most requirements match, 1-2 gaps that are learnable |
| 40-59 | Partial match, significant upskilling needed |
| 0-39 | Fundamental mismatch |

**Strong match areas:** React, React Native, TypeScript, JavaScript, Next.js, Tailwind CSS, mobile app migrations/performance, PWAs, biometric auth, payment integrations
**Moderate match areas:** Zustand/state management, TanStack Query, code review, informal tech leadership, App Store/Play Store release management
**Weak match areas:** No formal CS/engineering degree, no backend/full-stack depth evidenced yet, no automated testing frameworks mentioned in work history, no design-system/component-library ownership evidenced, no AI/ML experience

### 2. Experience Match (0-100)
Does work history align with what they're looking for?

| Score | Meaning |
|-------|---------|
| 80-100 | Direct experience in the same domain and role type |
| 60-79 | Related experience, transferable skills clear |
| 40-59 | Adjacent experience, would need to make the case |
| 0-39 | Unrelated experience |

**Strong:** Frontend Developer / React Developer / React Native Developer roles at startups, fintech and traveltech product companies
**Moderate:** Frontend Engineer / Product Engineer / UI Engineer roles at larger companies, roles requiring some backend/API integration work (he has consumed external provider APIs, not built backend services)
**Entry-level:** Roles requiring 3+ years, senior/staff-level titles, formal team-lead/EM roles (his lead experience is real but informal and short - 1 stint, not a track record)

### 3. Behavioral/Culture Fit (0-100)
Does the role and company culture match the behavioral profile?

| Score | Meaning |
|-------|---------|
| 80-100 | Culture strongly matches behavioral preferences |
| 60-79 | Mixed signals but mostly compatible |
| 40-59 | Some friction areas |
| 0-39 | Significant culture mismatch |

**Red flags to research:** Department disorganization, work dominated by maintenance over development, poor chemistry with leadership, culture mismatches. Check reviews, media coverage, LinkedIn connections, and network contacts for insider perspective.

### 4. Location & Logistics (Pass/Fail + Notes)
- Fully remote (any country/timezone): PASS
- Hybrid, based in Córdoba, Argentina: PASS (only accepted exception to remote-only)
- On-site anywhere else, or hybrid outside Córdoba: FAIL (deal-breaker)
- Requires relocation: FAIL (deal-breaker)
- Frequent international travel: FLAG (discuss with user)

### 5. Career Alignment & Motivation (0-100)
Does this role advance career goals and contain tasks that energize?

| Score | Meaning |
|-------|---------|
| 80-100 | Strongly aligned with career direction, clear growth path |
| 60-79 | Good role but only partially aligned with long-term goals |
| 40-59 | Decent job but doesn't build toward career goals |
| 0-39 | Dead end or backwards step |

**Career goals:**
- Land a fully remote Frontend/React(-Native) role at an international startup, ideally Series A-C, though open to larger companies
- Grow toward higher technical ownership over time (not an immediate priority, but a direction)
- Build a track record that supports eventually working for a US-based/"first-world"-based company at US-comparable compensation

**Motivation filter:** Evaluate not just whether you *can* do the tasks, but whether the tasks will *energize* you. Consider:
- Tasks that energize: Web-first React development (primary preference; React Native is welcome but secondary), building/owning features end-to-end, fintech/crypto/gaming/e-commerce/automotive/music-industry/hardware-tech domains, software factories/consultancies
- Tasks that drain: Frequent requirement churn - tolerated as a normal part of startup work, not a hard blocker, but worth noting if a posting signals chronic scope instability
- Non-task factors: Startup-stage culture (prefers Series A-C but open to bigger companies), degree of autonomy (wants high ownership, but it's a nice-to-have not a must-have)

**Life situation alignment:** Consider personal constraints:
- **Security**: Baseline compensation of $3,000 USD/month for companies based in a "first-world" country; $2,500 USD/month for LatAm-based companies. Treat postings below these as a flag, not an automatic disqualifier - discuss with the user.
- **Flexibility**: Remote-only is a hard requirement, with one exception: hybrid roles based in Córdoba, Argentina are acceptable. Any other on-site requirement is a deal-breaker (see Location & Logistics below).
- **Professional development**: Recently completed a self-directed career break to raise English fluency and DS&A skills specifically to be competitive for higher-bar (e.g. US-style) interview processes - values roles/companies that reward continued growth.

### 6. Salary Benchmark (Optional)

If the salary lookup tool is configured (`salary_data.json` exists), look up the company:
```
python salary_lookup.py "<Company Name>" --json
```

If a city is known from the posting, add `--city "<City>"` to narrow results.

Present findings as:
```
### Salary Benchmark
| Metric | Value |
|--------|-------|
| [Category] index | XX.X (+/-X.X% vs baseline) |
| Overall index | XX.X (+/-X.X% vs baseline) |
```

Interpret results relative to the baseline defined in the data file's metadata. For index-based data, higher typically means above-market compensation.

If the salary tool is not configured, skip this section.

## Output Format

Present the evaluation as:

```
## Job Fit Evaluation: [Role] at [Company]

| Dimension | Score | Notes |
|-----------|-------|-------|
| Technical Skills | XX/100 | [brief note] |
| Experience Match | XX/100 | [brief note] |
| Behavioral Fit | XX/100 | [brief note] |
| Location | PASS/FAIL | [brief note] |
| Career Alignment | XX/100 | [brief note] |

**Overall Score: XX/100** (weighted average of scored dimensions)

### Verdict: [Strong Fit / Good Fit / Moderate Fit / Weak Fit / Poor Fit]

### Key Strengths for This Role
- [bullet points]

### Gaps to Address
- [bullet points]

### Recommendation
[1-2 sentences: apply/skip/apply with caveats]

### Company Research Checklist
- [ ] Checked company website (mission, values, recent news)
- [ ] Checked review sites (Glassdoor, Jobindex, etc.)
- [ ] Checked LinkedIn for team size, recent hires, connections
- [ ] Checked media for restructuring, growth, or workplace issues
- [ ] Identified network contacts who may know the team/manager
```

## Weighting
- Technical Skills: 30%
- Experience Match: 25%
- Behavioral Fit: 15%
- Career Alignment: 30%

(Location is pass/fail, not weighted)

## Thresholds
- **Strong Fit** (75+): Definitely apply, tailor everything
- **Good Fit** (60-74): Apply, address gaps in cover letter
- **Moderate Fit** (45-59): Consider carefully, discuss with user
- **Weak Fit** (30-44): Probably skip unless strategic reasons
- **Poor Fit** (<30): Skip

## Pre-Application: Call the Employer (Best Practice)

Before writing the application, consider whether the candidate should call the contact person listed in the posting. **Only call if there are substantive questions** - never call just to "be remembered."

### When to Suggest Calling
- The posting has unclear or ambiguous requirements
- It's unclear which competencies are essential vs. nice-to-have
- The role description is vague about day-to-day tasks
- There's a named contact person who invites questions

### Good Questions to Ask
- "What are the primary challenges in this role?"
- "How is time typically divided across the listed responsibilities?"
- "Which competencies are most critical for success in this position?"
- "What does success look like in the first 6-12 months?"

### Rules for the Call
- Prepare a 30-second "elevator pitch" about your background in case they ask
- The call's purpose is **gathering information**, not delivering a pitch
- Take notes - use what you learn to tailor the application
- Reference the conversation naturally in the cover letter ("After speaking with [name], I was especially drawn to...")
