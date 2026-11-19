# ChatResume — Shipping Roadmap

> Tailor your CV to any job in 10 seconds.

**Primary user**: Already has a CV → uploads → tailors to job description (ATS matching)
**Secondary user**: No CV → types experience → generates from scratch

---

## Checkpoint 0: Infrastructure

> Before any code. Decisions that block everything else.

- [ ] Buy domain: `chatresume.live`
- [ ] Hosting: Vercel or Cloudflare Pages
- [ ] LLM backend decision
  - **DO NOT** send DSL spec to third-party APIs (leaks your moat)
  - Option A: Claude API (Anthropic doesn't train on API data)
  - Option B: Self-host Qwen3 (DSL never leaves your server)
- [ ] Auth: Supabase Auth (Google OAuth + email magic link)
- [ ] Database: Supabase Postgres
- [ ] Payment: Stripe (not needed at launch — add at Checkpoint 7)

---

## Checkpoint 1: Landing Page — Week 1

> Visitor arrives → understands the product in 3 seconds.

### Hero Section
- [ ] Headline: "Tailor your CV to any job in 10 seconds"
- [ ] Subtext explaining both user flows
- [ ] Demo video or animation showing the full flow

### Prompt Bar (core interaction)
- [ ] Main textarea: paste CV or type from scratch
- [ ] `🎨 Style` toggle → template gallery appears in middle
- [ ] `📋 Job Posting` toggle → JD textarea appears in middle
- [ ] Upload button (PDF / screenshot / paste image)
- [ ] `Generate →` button

### Template Gallery (inline, not a separate page)
- [ ] 8 pre-rendered CV style thumbnails
- [ ] First card: "Your style" (upload/describe your own)
- [ ] Click to select, blue border highlight

### Mobile
- [ ] Prompt bar stacks vertically
- [ ] Templates become 2-column grid
- [ ] Full-width layout on phone

**Done when**: Someone can land, see value, type or upload, pick a style, and click Generate.

---

## Checkpoint 2: CV Generation — Week 2

> End-to-end: paste info → see it render live → get a PDF.

### LLM Integration
- [ ] System prompt with CVM DSL specification
- [ ] Streaming response (SSE from backend)
- [ ] Parse partial DSL on each chunk
- [ ] Render incrementally on canvas (~20fps)

### Two Input Modes
- [ ] **Mode A: Upload existing CV**
  - [ ] PDF text extraction (pdf.js client-side)
  - [ ] Screenshot paste → vision API → extract text + layout structure
  - [ ] Plain text paste (direct)
- [ ] **Mode B: Type from scratch**
  - [ ] Freeform text → LLM structures it into a CV

### Job Description Tailoring
- [ ] JD paste textarea
- [ ] Keyword extraction from JD
- [ ] CV content adapted to match JD keywords
- [ ] ATS keyword match score displayed after generation

### Live Streaming Render
- [ ] Canvas replaces demo video area on Generate click
- [ ] Shapes draw in real-time, shape by shape
- [ ] Counter: "Rendering... 24 elements"
- [ ] Smooth transition to final result state

### Result Display
- [ ] Full CV visible (never blurred)
- [ ] ATS match percentage badge
- [ ] `↓ Download PDF` button
- [ ] `✎ Edit` and `↻ Regenerate` buttons

### PDF Export
- [ ] Canvas → high-res image (3x) → jsPDF
- [ ] A4 page size, correct proportions
- [ ] Clean output, no watermark (for beta)

**Done when**: Paste CV + job description → see live render → download PDF. Works end-to-end.

---

## Checkpoint 3: Auth + Saving — Week 3

> User signs in after seeing their CV. Sunk cost drives conversion.

### Sign-in Gate
- [ ] Appears **after** generation (not before)
- [ ] CV fully visible behind modal (not blurred — sunk cost)
- [ ] "Sign in to save & download"
- [ ] Google OAuth button
- [ ] Email magic link button
- [ ] No account needed to generate, only to save/download

### Backend: User Accounts
- [ ] Supabase Auth setup
- [ ] User record: `id`, `email`, `name`, `created_at`
- [ ] Session management (JWT)

### Backend: CV Storage
- [ ] Table: `cvs`
  - `id` (uuid)
  - `user_id` (ref)
  - `name` (string — company name or "Master CV")
  - `voxi_source` (text — the DSL code)
  - `job_description` (text, nullable)
  - `ats_score` (int, nullable)
  - `is_master` (boolean)
  - `parent_id` (uuid, nullable — "tailored from")
  - `created_at`, `updated_at`

### Post-Auth Flow
- [ ] After sign-in → PDF downloads immediately
- [ ] CV saved to account automatically
- [ ] Redirect to dashboard

**Done when**: Generate → sign in → CV saved → PDF downloaded → return and see it.

---

## Checkpoint 4: Dashboard — Week 4

> Returning users see all their CVs. Quick-tailor to new jobs.

### Dashboard Page (`/dashboard`)
- [ ] Grid of CV cards (thumbnails rendered from DSL)
- [ ] First card: `★ Master CV` (highlighted, special)
- [ ] Other cards: job-tailored versions
- [ ] Each card shows: company name, ATS %, date, preview
- [ ] `+ New CV` card at the end
- [ ] Click any card → opens CV viewer (Checkpoint 5)

### Quick Tailor Bar
- [ ] "Using: ★ Master CV" dropdown selector
- [ ] Paste job description textarea
- [ ] Company name field (auto-detected from JD if possible)
- [ ] `Tailor & Save →` button
- [ ] New tailored CV appears as a card instantly

### Master CV Concept
- [ ] First generated CV becomes `★ Master`
- [ ] All tailored versions reference `parent_id = master`
- [ ] User can change which CV is the master
- [ ] Editing master shows option to re-tailor children

### Card Actions
- [ ] Rename
- [ ] Delete
- [ ] Duplicate
- [ ] Download PDF

**Done when**: Returning user sees all CVs, quick-tailors to a new job in <10 seconds.

---

## Checkpoint 5: CV Viewer + Chat Edit — Week 5–6

> Open a CV. Talk to it. See changes live.

### Viewer Page (`/cv/:id`)
- [ ] Full CV rendered on canvas (left pane, 60% width)
- [ ] Header: company name, ATS score, last edited timestamp
- [ ] `↓ PDF` and `↓ DOCX` download buttons
- [ ] `← Back to dashboard` navigation

### Chat Panel (right pane, 40% width)
- [ ] Natural language text input
- [ ] Message bubbles: user (gray right) + AI (blue left-border)
- [ ] Each AI response = a DSL mutation applied to the CV
- [ ] CV re-renders live after each change
- [ ] Changes auto-saved to database

### Chat Capabilities
- [ ] "Add my AWS certification from 2023"
- [ ] "Make the work experience section longer"
- [ ] "Remove the photo"
- [ ] "Change to a darker sidebar style"
- [ ] "Swap education and experience sections"
- [ ] "Translate to Dutch"

### Re-Tailor Bar (bottom of viewer)
- [ ] "Paste a new JD to adapt this CV further"
- [ ] Creates a new tailored variant or updates current one

### ATS Score Updates
- [ ] Re-calculates after each chat edit
- [ ] Shows delta: "ATS: 91% → 94% ↑"

**Done when**: Open any CV, chat-edit it, see live updates, re-tailor to new jobs.

---

## Checkpoint 6: Batch Tailor — Week 7

> Power users paste 5 job descriptions → get 5 tailored CVs.

### Batch Page (`/batch`)
- [ ] Table view: `#` | Job Description | Company | Status | ATS
- [ ] Paste multiple JDs into rows
- [ ] Auto-detect company name from JD text
- [ ] `Tailor All →` button processes sequentially
- [ ] Progress bar: "3/5 complete"
- [ ] Each result → new card on dashboard
- [ ] ATS score shown per row as they complete

### Base CV Selector
- [ ] "Using: ★ Master CV `[change ▾]`"
- [ ] Dropdown to pick any existing CV as the base

**Done when**: Paste 5 job descriptions, click one button, get 5 tailored CVs saved.

---

## Checkpoint 7: Polish + Payments — Week 8

> Someone can pay money for a CV.

### Pricing
- [ ] Free tier: generate + view (subtle watermark on PDF)
- [ ] $15 one-time: 1 CV, no watermark, PDF + DOCX
- [ ] $29/month: unlimited CVs, batch mode, chat edit, no watermark
- [ ] Stripe Checkout integration
- [ ] Webhook to update user subscription status

### Watermark
- [ ] Free PDFs: subtle "Made with ChatResume.live" footer
- [ ] Paid PDFs: clean, no branding

### Landing Page Polish
- [ ] "How it works" — 3-step visual section
- [ ] Testimonials (placeholder, replace with real ones)
- [ ] FAQ accordion
- [ ] Footer: legal links, social links

### Legal
- [ ] Privacy policy page
- [ ] Terms of service page
- [ ] GDPR compliance: data export, data deletion endpoint
- [ ] Cookie consent (if analytics used)

### Analytics
- [ ] PostHog or Plausible (privacy-friendly, no cookies)
- [ ] Track funnel: visit → generate → sign-up → download → pay
- [ ] Key metric: **time from landing → PDF downloaded**

**Done when**: Someone can pay $15 or $29/mo and get a clean PDF.

---

## Launch Strategy

| Milestone | What to ship | What to measure | Where to post |
|-----------|-------------|-----------------|---------------|
| **Beta launch** (CP 1+2) | Landing + generation + PDF | Do people generate CVs? | Reddit r/resumes, r/jobs |
| **Soft launch** (CP 3+4) | Auth + dashboard + quick tailor | Do people sign up and return? | Hacker News "Show HN" |
| **Product launch** (CP 5+6) | Chat edit + batch mode | Do people use it for multiple jobs? | Product Hunt |
| **Revenue launch** (CP 7) | Payments + polish | Do people pay? | Paid ads (if CAC < LTV) |

---

## Timeline

```
Week:  1        2        3        4       5-6      7        8
       │        │        │        │        │        │        │
       CP1      CP2      CP3      CP4      CP5      CP6      CP7
      Landing  Generate  Auth    Dashboard Chat    Batch    Payments
      + Style  + PDF     + Save  + Quick   + Edit  + Multi  + Stripe
      + Mobile + Stream  + Gate  + Master  + ATS   + Table  + Polish
       │        │
       ├────────┤
       BETA LAUNCH → post on Reddit/HN
                         │        │
                         ├────────┤
                         SOFT LAUNCH → invite users
                                                     │        │
                                                     ├────────┤
                                                     REVENUE → Product Hunt
```

---

## Key Decisions Still Open

| Decision | Options | Deadline |
|----------|---------|----------|
| LLM provider | Claude API vs self-hosted Qwen3 | Before CP2 |
| DSL exposure | Hide completely vs open-source the spec | Before CP2 |
| DOCX export | Add it or PDF-only? | Before CP5 |
| Pricing model | One-time vs subscription vs both | Before CP7 |
| Domain | chatresume.live (confirmed available?) | Before CP1 |

---

*Last updated: March 2026*
