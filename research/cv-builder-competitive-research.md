# Competitive Research: Code-Based & Structured-Text CV/Resume Creation

*Research Date: March 2026*

---

## 1. DSL / Code-Based Resume Tools

### 1.1 JSON Resume (jsonresume.org)

**How it works:** An open-source, community-driven standard that stores resume data as a JSON file conforming to a defined schema. Users write/edit JSON, then render it through themes to produce HTML/PDF output. A CLI tool (`resume-cli`) handles validation, export, and local preview. A hosted registry at `registry.jsonresume.org` lets users publish resumes with unique URLs.

**Community size:**
- 400+ npm theme packages built by the community
- The `resume-cli` repo and core schema repos are hosted under the [JSON Resume GitHub org](https://github.com/jsonresume)
- Active ecosystem with implementations in Rust, Python, and Node.js
- Registry allows publishing and sharing resumes at unique URLs

**Themes:** Over 400 community themes available on npm. Themes range from minimalist (e.g., `jsonresume-theme-even`, `jsonresume-theme-actual`) to more elaborate designs. Any npm-published theme is automatically picked up by the registry.

**Limitations:**
- The official `resume-cli` tool has had maintenance issues; community members have built alternatives (e.g., [Ferrisume](https://news.ycombinator.com/item?id=41102193) in Rust)
- JSON is verbose and less human-friendly to edit than YAML or Markdown
- Theme quality varies widely across 400+ community packages
- No built-in job-tailoring or AI features
- Hacker News commenters note the concept is loved (separating content from presentation) but tooling is inconsistent

**Sources:**
- [JSON Resume Official Site](https://jsonresume.org/)
- [JSON Resume GitHub Organization](https://github.com/jsonresume)
- [JSON Resume Themes](https://jsonresume.org/themes)
- [Show HN: Ferrisume, a JSON Resume CLI Tool](https://news.ycombinator.com/item?id=41102193)
- [HN: Ask HN — What do you use to build your resume?](https://news.ycombinator.com/item?id=16155473)

---

### 1.2 YAML-Based Resume Generators

**RenderCV** (Most Notable)
- Open-source resume builder for academics and engineers
- Write CV in YAML, generate PDF with LaTeX-quality typesetting
- Features JSON Schema for interactive YAML editing with autocompletion
- New web app at [rendercv.com](https://rendercv.com/) with AI chat for polishing CVs, YAML + form editors, and GitHub sync
- Integrates with AI coding agents (Claude Code, Cursor, Copilot, etc.)
- HN reception: users praise it ("I used it in my recent job search and it was fantastic", "Word kept breaking my layout and LaTeX was overkill") but some report breaking changes between versions
- [GitHub: rendercv/rendercv](https://github.com/rendercv/rendercv)
- [Show HN: RenderCV](https://news.ycombinator.com/item?id=46344616)

**YAMLResume (by PPResume)**
- "Resumes as code in YAML" — renders YAML to PDF with pluggable typesetting engine
- GitHub Actions integration for CI/CD pipeline resume generation
- Chose YAML over JSON for human readability/writability
- [GitHub: yamlresume/yamlresume](https://github.com/yamlresume/yamlresume)

**Other YAML Tools:**
- [yaml-cv](https://github.com/haath/yaml-cv) — Static CV generator from YAML to HTML/PDF
- [hanula/resume](https://github.com/hanula/resume) — Python-based, YAML to PDF and static HTML
- [Kamisaku (sinaru/cv-builder)](https://github.com/sinaru/cv-builder) — YAML to PDF with multiple templates

---

### 1.3 LaTeX Resume Templates

**Major Templates & Community Size:**

| Template | Description | Notes |
|----------|-------------|-------|
| [Awesome-CV](https://github.com/posquit0/Awesome-CV) | Clean, semantic LaTeX CV template | One of the most-starred resume repos on GitHub; widely used on Overleaf |
| [Deedy-Resume](https://github.com/deedy/Deedy-Resume) | One-page, two-column XeTeX template for CS undergrads | Very popular among CS students |
| [ModernCV](https://github.com/topics/latex-cv-template) | Classic LaTeX CV class | Long-standing community standard |
| [latexcv](https://github.com/jankapunkt/latexcv) | Collection of CV/resume templates in LaTeX | Multi-language support |
| [Jake's Resume](https://github.com/topics/latex-resume-template) | Popular single-column template | Widely forked |

**Pain points of LaTeX resumes (from HN and community feedback):**
- **ATS compatibility issues:** "Apple's ATS did not properly ingest my PDF LaTeX CV" — real-world parsing failures reported. PDF (embedded fonts) has an 18% ATS parsing failure rate vs. 4% for plain DOCX
- **Steep learning curve:** Writing code, not WYSIWYG; no real-time preview
- **Template lock-in:** "Once you choose a template, you're stuck with it. If you decide to try another, you must do everything from scratch"
- **Maintenance burden:** Fiddling with spacing, fonts, and layout consumes disproportionate time relative to content
- **Environment setup:** Requires TeX distribution installation, though Overleaf mitigates this

**Sources:**
- [HN: Opinion — LaTeX resumes don't make any sense](https://news.ycombinator.com/item?id=28198044)
- [Awesome CV on Overleaf](https://www.overleaf.com/latex/templates/awesome-cv/dfnvtnhzhhbm)
- [DEV: Ditch LaTeX for Markdown to write your resume](https://dev.to/kavyaj/ditch-latex-for-markdown-to-write-your-resume-333m)

---

### 1.4 Typst — Emerging LaTeX Alternative

Typst is gaining significant traction in 2025-2026 as a modern alternative to LaTeX:
- Single self-contained binary (no TeX installation needed)
- Near-instant compilation, readable error messages
- Cleaner markup syntax that's "immediately intuitive"
- Growing ecosystem of CV/resume templates on [Typst Universe](https://typst.app/universe/search/)
- Templates include ports of Awesome-CV (`modern-cv`), `moderner-cv`, `impressive-impression`, `simple-technical-resume`
- Developers switching from LaTeX report easier maintenance and better templating

**Sources:**
- [Typst Universe: modern-cv](https://typst.app/universe/package/modern-cv/)
- [I Tried Typst (And Actually Loved It)](https://javadibrahimli.github.io/blog/2026/i-tried-typst-and-actually-loved-it/)
- [Typst: The Modern Alternative to LaTeX](https://calmops.com/latex/typst-modern-alternative-latex/)

---

### 1.5 Other Structured/Code-Based Approaches

**HackMyResume**
- Node.js CLI tool generating resumes in HTML, Markdown, LaTeX, Word, PDF, plain text, JSON, XML, YAML
- Supports both FRESH and JSON Resume formats
- Can analyze resumes for keyword density and gaps
- Appears to be largely unmaintained
- [GitHub: hacksalot/HackMyResume](https://github.com/hacksalot/HackMyResume)

**KissMyResume**
- Spiritual successor to HackMyResume, aims to "keep it simple"
- [GitHub: karlitos/KissMyResume](https://github.com/karlitos/KissMyResume)

**HTML/CSS Resumes**
- Some developers advocate writing resumes in HTML+CSS for full control and browser-based PDF export
- [Why I use HTML to make my resume instead of LaTeX or Microsoft Word](https://wkaisertexas.github.io/blog/create-your-resume-in-html-and-css/)

**CodeCV**
- CV format specification and tools to manage CV documents as structured data
- [GitHub: codecv-co/codecv](https://github.com/codecv-co/codecv)

**Markdown Resumes**
- Multiple tools convert Markdown to styled PDFs
- Positioned as "middle ground" between LaTeX complexity and WYSIWYG simplicity
- "LaTeX values absolute control, Markdown values absolute simplicity — and for a resume, simplicity is the smarter investment"

**Reactive Resume (Open Source WYSIWYG)**
- 30,000+ GitHub stars — the most popular open-source resume builder
- MIT license, self-hostable via Docker, no tracking/ads/hidden costs
- Unlimited resumes, full customization
- Not code-based, but important open-source benchmark
- [Reactive Resume](https://rxresu.me/) | [GitHub](https://github.com/AmruthPillai/Reactive-Resume)

---

## 2. User Sentiment: Code vs. WYSIWYG for Resumes

### 2.1 Developer Preferences

**Arguments FOR code-based resumes:**
- Version control via Git (track changes, maintain history)
- Typographic precision and consistent design
- Commented-out sections for per-job customization
- Semantic markup enabling one-line layout changes
- Free tooling, no vendor lock-in
- "I really love tools that treat documents as code" — HN commenter on RenderCV

**Arguments AGAINST code-based resumes:**
- ATS parsing failures with PDFs (18% failure rate vs. 4% for DOCX)
- No real-time editing; steep learning curve
- Template lock-in once committed to a specific LaTeX class
- Over-engineering a simple document: "a resume is a single, small document with different sections"
- Recruiters may deprioritize candidates who submit PDFs over editable formats
- Maintenance friction for minor formatting changes

**Sources:**
- [HN: Why I do my resume in LaTeX](https://news.ycombinator.com/item?id=2238408)
- [HN: Opinion on LaTeX resumes](https://news.ycombinator.com/item?id=28198044)
- [DEV: Godspeed LaTeX, Long Live Microsoft Word](https://dev.to/jfhbrook/godspeed-latex-long-live-microsoft-word-k3j)

### 2.2 Non-Technical Users

Non-technical users effectively never use code-based approaches. The entire code-based resume ecosystem serves developers, academics, and engineers. For everyone else, WYSIWYG tools (Canva, Google Docs, Word, online builders) dominate completely.

### 2.3 The "Middle Ground" Demand

There is clear demand for approaches that combine the benefits of structured data with visual editing:
- RenderCV's new web app offers both YAML editor and form-based editor
- Reactive Resume provides a WYSIWYG interface backed by structured JSON data
- The trend is toward **"structured data under the hood, visual editing on top"** rather than exposing raw code to users
- HN commenter: "Word kept breaking my layout and LaTeX was overkill" — indicating a gap between the two extremes

### 2.4 AI-Native Resumes: HN Skepticism

A recent HN discussion about an "AI Native Resume" revealed significant pushback:
- "If I were the hiring manager and found out about this, you would not be invited to an interview"
- "You need to make it as easy as possible for me to learn about you. If instructions are necessary it's not easy"
- Hiring managers prefer traditional formats; innovation in resume presentation is viewed skeptically
- [HN: Show HN: My AI Native Resume](https://news.ycombinator.com/item?id=43891245)

---

## 3. Market Gaps & User Complaints

### 3.1 Top Complaints About Existing CV Builders

**1. Deceptive Pricing / Dark Patterns (THE #1 complaint)**
- Platforms lure users with "free" promises, let them spend an hour building a resume, then gate PDF download behind a paywall
- Specific offenders: Zety ($1.95 trial → $25.95/4 weeks), Resume Genius ($2.95 trial → $23.95/4 weeks), Resume.io ($2.95 trial → ~$24.95/month)
- Auto-renewal traps and difficult cancellation processes
- Reddit Feb 2026: "Resumeio is a scam" thread
- "Hidden fees and automatic renewals are the most common complaints"

**2. ATS Anxiety vs. ATS Reality**
- 77% of candidates worry about being filtered out by ATS
- The widely-cited "75% of resumes are auto-rejected by ATS" is **debunked** — originated from Preptel, a defunct company with no published methodology
- Reality: 92% of recruiters confirm ATS does NOT auto-reject based on content; it ranks/sorts
- The real problem is volume: 180+ applicants per position, entry-level roles getting 400-600 applicants
- Many "ATS optimization" features exploit this anxiety without delivering real value

**3. Generic AI Output**
- AI-generated content often sounds formulaic
- Reddit consensus: "AI resume builders are most effective when you treat them as a starting point rather than a finished product"
- HN warning about oversaturation: "I have been through a huge over supply of AI generated CVs using similar tools this year"
- Users want AI as a coach/editor, not a wholesale generator

**4. Template Limitations**
- Canva templates are visually appealing but often not ATS-optimized (multi-column layouts, embedded graphics)
- Resume.io: only one template (Vancouver) available on the free tier
- Most builders offer 10-30 templates; users want more customization

**5. Lack of Integrated Job-Tailoring Workflow**
- Most tools treat resume creation and job tailoring as separate steps
- Users want: paste a job description → get a tailored resume instantly
- The gap: no mainstream tool seamlessly combines generation + tailoring + conversational editing in one flow

**Sources:**
- [ResuFit: Best Free Resume Builder — 7 Truly Free](https://resufit.com/blog/the-ultimate-guide-to-truly-free-resume-builders-no-hidden-costs-or-paywalls/)
- [PitchMeAI: Best AI Resume Builder Reddit](https://pitchmeai.com/blog/best-ai-resume-builder-reddit)
- [CoverSentry: ATS Statistics 2026](https://www.coversentry.com/ats-statistics)
- [HR Dive: Job seekers optimize resumes amid ATS anxiety](https://www.hrdive.com/news/job-seekers-longer-resumes-growing-ats-concerns-monster/810834/)
- [Reddit: Resume builder complaints](https://pitchmeai.com/blog/zety-resume-builder-download-paywall)

### 3.2 Features Users Are Begging For

1. **Conversational AI editing** — "Watch your resume update instantly as you chat" (Jobsuit AI pioneering this)
2. **One-click job tailoring** — Paste job description, get optimized resume
3. **Transparent pricing** — "If a tool is free, I should be able to download without a paywall"
4. **Real ATS diagnostics** — Show parsing results, not just a score; OpenResume's parser lets you see what an ATS would extract
5. **Industry-specific bullet point generation** — Not generic AI, but role-aware content
6. **Version management** — Maintain a master resume and create job-specific variants
7. **Skills gap analysis** — Compare resume to job description, highlight missing keywords

### 3.3 Tools Attempting the "Generate + Tailor + Edit" Flow

| Tool | Generation | Tailoring | Chat Editing | Notes |
|------|-----------|-----------|-------------|-------|
| [Teal](https://www.tealhq.com/tools/resume-builder) | Yes | Yes | Yes (ChatGPT integration) | All-in-one job search platform |
| [Jobsuit AI](https://jobsuit.ai/) | Yes | Yes | Yes (conversational) | First "conversational" resume builder |
| [ResumeUp.AI](https://resumeup.ai/) | Yes | Yes | Yes (ResumeGPT) | Multiple creation modes |
| [Enhancv](https://enhancv.com/ai-resume-builder/) | Yes | Yes | Partial | ChatGPT-powered content generation |
| [Kickresume](https://www.kickresume.com/) | Yes | Limited | No | Strong foundation building |
| [Rezi](https://www.rezi.ai/) | Yes | Yes (keyword targeting) | No | ATS-focused |

**Gap:** No tool combines structured data (code/YAML/JSON), AI generation, job tailoring, AND conversational editing in a single flow. This is the whitespace.

---

## 4. Pricing & Business Models

### 4.1 Common Pricing Tiers

| Tier | Price Range | Features |
|------|------------|----------|
| **Free/Freemium** | $0 | Basic templates (1-4), limited AI, often paywalled PDF export |
| **Trial Bait** | $1.95-$2.95 for 7-14 days | Full access, auto-renews at $20-26/month |
| **Monthly Subscription** | $9-$30/month | All templates, AI features, unlimited exports |
| **Annual Subscription** | $50-$180/year | Same as monthly at ~50% discount |
| **Lifetime/One-time** | $29-$99 | Rare but valued (Rezi Pro at $29 one-time is a standout) |

### 4.2 Typically Paywalled Features

- PDF/DOCX export (the most common paywall)
- Premium templates (beyond 1-4 basic ones)
- AI-powered content writing/rewriting
- Job-specific tailoring
- ATS score/analysis
- Cover letter generation
- Multiple resume versions
- Remove watermarks/branding

### 4.3 Truly Free Alternatives (No PDF Paywall)

- Google Docs (templates)
- Indeed/Resume.com
- [OpenResume](https://www.open-resume.com/)
- [FlowCV](https://flowcv.com/) (1 resume, no watermarks)
- [Reactive Resume](https://rxresu.me/) (unlimited, open-source)
- [Rezi](https://www.rezi.ai/) (core builder + PDF export free)
- [Teal](https://www.tealhq.com/tools/resume-builder) (unlimited resumes + exports free)
- [Wobo](https://www.wobo.ai/) (completely free, AI-powered)

### 4.4 Market Size & Revenue Data

- Global resume building tool market: **~$1.5-2.2 billion in 2025**
- CAGR: **7.8-9.3%** through 2032-2035
- AI-powered resume builder segment: **$1.3B in 2024**, projected to reach **$1.8B by 2032** (CAGR 20%)
- Subscription-based tools dominate with **64.7% market share** in 2025
- Job seekers represent **78.5%** of the market
- AI resume builders saw **10,900% growth** in adoption during 2025-2026

**Funding:**
- Resumaker.ai: $5M funding (June 2024) for AI resume-writing algorithms
- Rezi: 9 investors including Firestreak Ventures, Kortschak Investments
- Kickresume: Invested in by CEED Tech and VentureOut
- Enhancv: Seed VC from Eleven Ventures
- Most successful resume builders are **bootstrapped** with 85%+ margins

**Sources:**
- [Coherent Market Insights: Resume Building Tool Market 2025-2032](https://www.coherentmarketinsights.com/industry-reports/resume-building-tool-market)
- [Business Research Company: Resume Builder Market Report 2025](https://www.thebusinessresearchcompany.com/report/resume-builder-global-market-report)
- [FutureDataStats: AI-Powered Resume Builders Market](https://www.futuredatastats.com/ai-powered-resume-builders-market)
- [Kickresume: Top 10 Resume Builders 2026](https://www.kickresume.com/en/help-center/10-best-resume-builders/)
- [Local AI Master: Resume Builder Market Analysis 2025](https://localaimaster.com/blog/resume-builder-market-analysis)

---

## 5. User Behavior Patterns

### 5.1 Resume Tailoring Behavior

- **48.8%** of job seekers make only minor adjustments per application
- **32.9%** create a brand new resume for each application
- **18.2%** submit the same resume every time
- **83%** of recruiters prefer resumes tailored to the specific job description
- **63%** of recruiters say the #1 mistake is not tailoring

**The dominant pattern:** Users maintain a "master resume" (comprehensive, all-in-one version) and create 2-3 base variants for different job families, then make minor tweaks per application.

A Reddit split-test of 100 applications: tailored resumes had **12% success rate** vs. **8% for generic**. A separate test: 5 interviews from 29 tailored applications vs. 0 from 29 generic.

**Sources:**
- [Enhancv: 170+ Resume Statistics](https://enhancv.com/blog/resume-statistics/)
- [Qureos: 30+ Resume Statistics (March 2026)](https://www.qureos.com/career-guide/resume-statistics-for-job-seekers)
- [DEV: Should You Customize Your Resume for Every Job?](https://dev.to/jasmeet7015/should-you-customize-your-resume-for-every-job-heres-what-i-learned-after-applying-to-100-roles-4bo3)

### 5.2 Application Volume

- Job seekers typically submit **30-50 resumes** to secure a position
- Less than **3%** of resumes sent result in job interviews
- Interview conversion rates dropped from **15% (2016)** to approximately **3% (2024)**
- Entry-level roles: **400-600 applicants**; customer service/remote: **1,000+** in the first week; tech/engineering: **2,000+**
- **44%** of job seekers received zero interviews in the previous month
- **77%** report being ghosted after applying

### 5.3 ATS Awareness & Anxiety

- **77%** of candidates are worried their resumes will be filtered out by ATS
- **97.8%** of Fortune 500 companies use an ATS; **93%** of recruiters in 2026
- **88%** of employers believe they lose qualified candidates to ATS formatting issues
- However: **92% of recruiters confirm their ATS does NOT auto-reject** based on content
- The "75% auto-rejection" statistic is debunked (originated from defunct Preptel, no methodology)
- ATS anxiety is driving resumes to grow longer: **49%** now exceed one page, **30%** are two pages+

**Sources:**
- [CoverSentry: ATS Statistics 2026](https://www.coversentry.com/ats-statistics)
- [SSR: Applicant Tracking System Statistics 2026](https://www.selectsoftwarereviews.com/blog/applicant-tracking-system-statistics)
- [HR Dive: Job seekers optimize resumes amid ATS anxiety](https://www.hrdive.com/news/job-seekers-longer-resumes-growing-ats-concerns-monster/810834/)
- [DAVRON: ATS Systems Explained](https://www.davron.net/ats-systems-explained-75-percent-resumes-rejected/)

### 5.4 Mobile vs. Desktop Usage

- **67%** of job applications are submitted from mobile devices (though declining slightly from peak)
- **77%** of job seekers use phones for job searches
- **50.2%** use mobile as their first-choice device for job discovery vs. **48.2%** desktop
- But desktop has **higher application completion rates** — mobile drives discovery, desktop drives action
- **Gig workers**: 86% apply via mobile
- **Tech/finance/legal roles**: predominantly desktop
- **Resume creation** specifically is still largely a desktop activity — mobile is used for browsing/applying, not building

**Sources:**
- [Appcast: Mobile vs. Desktop Job Search Trends](https://www.appcast.io/mobile-versus-desktop-trends-in-job-search/)
- [HR Dive: Mobile job applications surpassed desktop in 2020](https://www.hrdive.com/news/mobile-job-applications-surpassed-desktop-in-2020-report-says/595891/)
- [The Interview Guys: Mobile-First Resume Design](https://blog.theinterviewguys.com/mobile-first-resume-design/)

### 5.5 Resume Format Statistics

- Average resume: **1.7 pages, 683 words, 15 skills, 13 years of experience, 5 jobs**
- **96%** of job seekers chose double-column formats in 2024
- Hiring managers spend approximately **17 seconds** reviewing resumes (not the commonly cited 7 seconds)
- **88%** of hiring managers prioritize work experience
- **75%** want quantifiable achievements
- **76%** of resumes rejected due to unprofessional email addresses
- **68%** of recruiters would reject poorly formatted resumes

---

## 6. Key Strategic Insights

### 6.1 The Whitespace Opportunity

No existing tool combines ALL of:
1. **Structured data** (JSON/YAML) for version control and programmatic manipulation
2. **Visual editing** for non-technical usability
3. **AI-powered generation** from minimal input
4. **Job-specific tailoring** via job description paste
5. **Conversational refinement** (chat-based editing)
6. **Transparent pricing** (no PDF paywall traps)

### 6.2 The Code-Based Resume Paradox

Developers love the *idea* of resumes-as-code, but adoption remains niche because:
- The overhead of learning/maintaining a tool exceeds the infrequent need (most people update resumes every 1-3 years)
- ATS compatibility concerns discourage PDF-based approaches
- The ecosystem is fragmented (JSON Resume, RenderCV, Typst, LaTeX — no clear winner)
- Non-developers will never adopt code-based approaches

**The winning approach:** Structured data as the *backend* (for versioning, tailoring, export flexibility) with a visual/conversational *frontend* that hides the complexity.

### 6.3 Pricing Sweet Spot

Based on market data and user sentiment:
- **Free tier must include PDF export** — anything else is perceived as a scam in 2026
- **One-time payment** ($29-$49) for AI/premium features has strong appeal (Rezi's model)
- **Subscription** ($9-$15/month) works only if tied to active job search value (tailoring, applications, tracking)
- **Per-export pricing** is universally despised
- Users will pay for: AI tailoring, ATS diagnostics, version management, interview prep — NOT for basic PDF export

### 6.4 User Behavior Implications

- With 30-50 applications needed per job search and 83% of recruiters wanting tailored resumes, the real product is **rapid tailoring at scale**, not one-time resume creation
- The master-resume-to-variants workflow is underserved by current tools
- Mobile resume *creation* is rare, but mobile resume *editing/tweaking* before applying is a growing use case
