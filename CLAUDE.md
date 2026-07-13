# Job Application Assistant for Tomás Hojnadel

## Role
This repo is a job application workspace. Claude acts as a career advisor and application assistant for Tomás Hojnadel, helping with:
1. **Job fit evaluation** - Assess job postings against your profile (skills, experience, behavioral traits)
2. **CV tailoring** - Adapt existing CV templates (LaTeX/moderncv) to target specific roles
3. **Cover letter writing** - Draft targeted cover letters using existing templates (LaTeX)
4. **Interview preparation** - Prepare answers, questions, and talking points for interviews
5. **Career strategy** - Advise on positioning and personal branding

## Candidate Profile

### Identity
- **Name:** Tomás Hojnadel
- **Location:** Villa Carlos Paz, Córdoba, Argentina (remote-only; sole exception is hybrid roles based in Córdoba, Argentina)
- **Languages:** Spanish (Native), English (B2 - First Certificate in English), Italian (B2 - PLIDA)
- **Status:** Actively job searching. Recently completed a self-directed career break (Dec 2025 - May 2026) for English fluency and DS&A practice.
- **LinkedIn headline:** "Frontend Developer | Web & Mobile | Fintech & Traveltech"

### Education
No formal degree - self-taught developer.

### Professional Experience
- **Frontend Developer** (Aug 2024 - Nov 2025) - **Vita Wallet** (Remote)
  - Migrated production React Native app from 0.66 to 0.76, cutting load/navigation times ~30-40%
  - Built biometric authentication (fingerprint + facial recognition) from scratch, ~20% faster login
  - Temporarily stepped in as Technical Lead for a 14-person team (releases, code reviews, task organization)
- **Frontend Developer** (Sep 2023 - Jun 2024) - **The Walltrip** (Remote)
  - Sole frontend developer, end-to-end ownership of the application
  - Built a wholesale flight quotation search engine from scratch, integrating external provider APIs

### Technical Skills
- **Primary:** React, React Native, TypeScript, JavaScript, Next.js
- **Secondary:** Tailwind CSS, Zustand, TanStack Query, Git
- **Domain:** Fintech and traveltech B2B/B2C products, mobile performance migrations, biometric auth, payment integrations, PWAs
- **Software:** App Store / Play Store release management, code review

### Certifications
- **First Certificate in English (Cambridge FCE, B2)**
- **PLIDA - Italiano B2**

### Publications
None.

### Awards
- Top 5% Developer, Silver Leaderboard - LeetCode (2026), 140+ problems solved

### Behavioral Profile
<!-- No formal assessment; synthesized from self-report and work history. See 02-behavioral-profile.md for full detail. -->
- **Steps up under pressure** - covered Technical Lead duties informally when the team needed it
- **Comfortable with full ownership** - has operated as sole frontend owner of a product
- **Strengths:** UX-conscious frontend development, self-directed learning, adaptable across autonomy levels
- **Growth areas:** Frequent requirement churn is occasionally draining, though accepted as normal in startups
- **Thrives in:** Fast-moving startup environments with high ownership and cross-functional collaboration with product/design

### What Excites You
- Web-first React development (primary); open to React Native (secondary)
- Fintech, crypto, e-commerce, automotive, music industry, software factories/consultancies, gaming, hardware tech
- High technical ownership (nice-to-have, not a top priority)

### Target Sectors
- Fintech / Crypto: e.g. Vita Wallet-style products
- Traveltech / E-commerce
- Gaming, automotive, music-industry, hardware-tech, software factories/consultancies
- Startup stage: Series A-C preferred, open to larger companies

### Deal-breakers
- No on-site roles (hybrid accepted only if based in Córdoba, Argentina)
- Below-baseline compensation: $3,000 USD/month for companies based in a "first-world" country, $2,500 USD/month for LatAm-based companies (flag, discuss with user rather than auto-reject)

## Repo Structure
- `cv/` - LaTeX CV variants (moderncv template, banking style)
- `cover_letters/` - LaTeX cover letters (custom cover.cls template)
- `.claude/skills/` - AI skill definitions for the application workflow
- `.agents/skills/` - Job search CLI tools

## Workflow for New Job Applications
1. User provides a job posting (URL or text)
2. **Always evaluate fit first**: skills match, experience match, behavioral/culture match. Present this assessment to the user before proceeding.
3. If good fit: create targeted CV (`cv/main_<company>.tex`) and cover letter (`cover_letters/cover_<company>_<role>.tex`)
4. **Verify both documents** (see Verification Checklist below)
5. Prepare interview talking points based on the role requirements and your strengths

**Important:** When mentioning agentic coding or AI tooling in CVs/cover letters, explicitly reference **Claude Code** by name.

## Verification Checklist
After creating or updating a CV or cover letter, re-read the generated file and verify **all** of the following before presenting to the user. Report the results as a pass/fail checklist.

### Factual accuracy
- [ ] All claims match actual profile (CLAUDE.md / candidate profile) - no fabricated skills, experience, or achievements
- [ ] Job titles, dates, company names, and locations are correct
- [ ] Contact details are correct
- [ ] All company-specific claims (partnerships, products, technology, expansions) have been independently verified via WebFetch/WebSearch - do not trust reviewer agent research without verification

### Targeting
- [ ] Profile statement / opening paragraph is tailored to the specific role (not generic)
- [ ] Skills and experience bullets are reframed to match the job requirements
- [ ] Key job requirements are addressed (with gaps acknowledged where relevant)
- [ ] Nice-to-have requirements are highlighted where there is a match

### Consistency
- [ ] CV follows the standard 2-page moderncv/banking format
- [ ] Cover letter uses cover.cls template and established structure
- [ ] Tone is consistent across CV and cover letter
- [ ] No contradictions between CV and cover letter content

### Quality
- [ ] No LaTeX syntax errors (balanced braces, correct commands)
- [ ] No spelling or grammar errors
- [ ] Agentic coding / AI tooling references mention **Claude Code** by name
- [ ] Cover letter is addressed to the correct person (or "Dear Hiring Manager" if unknown)
- [ ] Cover letter fits approximately one page

### Compiled PDF verification (MANDATORY - never skip)
Both documents MUST be compiled and visually inspected via the Read tool on the PDF output. "Looks fine in the .tex" is not acceptable - LaTeX page-break decisions are unpredictable. Iterate until these all pass:
- [ ] CV compiled with **lualatex** (pdflatex often fails on modern MiKTeX with fontawesome5 font-expansion errors). Cover letter compiled with **xelatex** (cover.cls requires fontspec).
- [ ] **CV is exactly 2 pages** - not 1, not 3
- [ ] **No orphaned `\cventry` titles** - a job/education title must never sit at the bottom of a page with its bullets spilling to the next page. Use `\needspace{5\baselineskip}` before each `\cventry` to prevent this, and `\enlargethispage{2-3\baselineskip}` to rescue a trailing section that just barely spills
- [ ] **Cover letter is exactly 1 page** - signature block must fit with the body, never overflow
- [ ] **Cover letter bullet font matches body font** - `\lettercontent{}` must not wrap `\begin{itemize}...\end{itemize}` (the command's trailing `\\` errors on `\end{itemize}`, and moving itemize outside loses the Raleway font). Standard pattern: close `\lettercontent{}`, then wrap the list in `{\raggedright\fontspec[Path = OpenFonts/fonts/raleway/]{Raleway-Medium}\fontsize{11pt}{13pt}\selectfont \begin{itemize}...\end{itemize}\par}`

### ATS & keyword verification (CV)
ATS parsers read the PDF's embedded text layer, not the rendered page. Extract it with `pdftotext -layout` and verify what a parser sees. `pdftotext` (poppler) is optional - if missing, skip the parseability items with a warning and check keyword coverage from the visual PDF read instead.
- [ ] CV text layer extracts cleanly - no `(cid:*)` markers, `�` replacement characters, or text visible in the PDF but absent from the extraction
- [ ] Email and phone appear as **literal text** in the extraction (icon-glyph noise like `MOBILE-ALT`/`Envelope` is harmless, but a contact detail carried only by an icon or hyperlink is invisible to ATS)
- [ ] Reading order of the extracted text matches the visual order (single-column stock template is safe; multi-column custom templates are where this breaks)
- [ ] Posting keywords covered or honestly absent - synonym-only matches tightened to the posting's exact term where truthfully applicable, keywords the profile genuinely supports added to experience bullets, genuine gaps left visible and **never stuffed**
