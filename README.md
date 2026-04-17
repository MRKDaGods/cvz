# CVZ

CV optimizer that turns your resume into something you'd actually want to submit. Upload a PDF, paste a job description, pick a LaTeX template, and get back an ATS-friendly CV with AI feedback on every section.

Based on [CvOptimizZer](https://github.com/MRKDaGods/CvOptimizZer) (2024).

**by Mohamed Ammar, Seif Tamer & Claude :)**

## What it does

1. **Upload** your existing CV (PDF or paste text)
2. **Review** — AI extracts and structures your sections
3. **Template** — pick from 4 LaTeX templates (classic, modern, executive, academic)
4. **Optimize** — AI rewrites bullets with STAR method, quantified impact, and keyword matching against the job description. Scores each section and gives inline comments
5. **Refine** — answer AI questions, add corrections, re-optimize until satisfied
6. **Download** — compiled LaTeX → PDF, or grab the `.tex` source

The AI asks questions when it's unsure ("Did you mean 2 years at AWS or 3?"), flags issues by severity, and lets you accept/reject/refine every suggestion per-bullet.

## Stack

- **Next.js 16** (App Router, React 19)
- **GitHub Copilot SDK** for all LLM calls (models configurable per-step)
- **LaTeX** (MiKTeX/TeX Live) for PDF compilation
- **Prisma + SQLite** for sessions/data
- **Zustand** for client state
- **shadcn/ui + Tailwind CSS 4**
- **GitHub OAuth** for auth

## Prerequisites

- Node.js 20+
- A LaTeX distribution ([MiKTeX](https://miktex.org/) on Windows, TeX Live on Linux/macOS) — needs `pdflatex` on PATH
- A [GitHub OAuth App](https://github.com/settings/developers) (for authentication)
- [GitHub Copilot](https://github.com/features/copilot) subscription (the app uses Copilot's API for AI)

### Windows LaTeX note (MiKTeX)

If setup says `latexmk` or `pdflatex` is missing right after installing MiKTeX, it is usually a PATH refresh issue, not a failed install.

1. Fully close and reopen VS Code/terminal after MiKTeX install.
2. Verify binaries exist at `%LOCALAPPDATA%\\Programs\\MiKTeX\\miktex\\bin\\x64`.
3. Run:
  - `latexmk --version`
  - `pdflatex --version`

If those still fail, add `%LOCALAPPDATA%\\Programs\\MiKTeX\\miktex\\bin\\x64` to your user PATH and restart terminal/VS Code.

## Setup

```bash
git clone https://github.com/MRKDaGods/cvz.git
cd cvz
npm install
```

Copy the example env and fill in your values:

```bash
cp .env.example .env.local
```

You'll need:
- A GitHub OAuth App — set the callback URL to `http://localhost:3000/api/auth/callback`
- Generate a session secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Suggested `.env.local` values:

```env
DATABASE_URL="file:./dev.db"
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/callback
SESSION_SECRET=your_64_char_hex_string
COPILOT_MODEL=gpt-4.1
DEBUG_PIPELINE=false
```

Initialize the database and start:

```bash
npx prisma db push
npm run dev
```

Open [localhost:3000](http://localhost:3000), sign in with GitHub, and start optimizing.

## Project structure

```
src/
  app/              # Next.js routes & API
    api/
      auth/         # GitHub OAuth flow
      compile/      # LaTeX → PDF compilation
      pipeline/     # extract, optimize, refine, parse-pdf, keywords
      smart/        # ATS scoring, gap analysis, interview prep
      sessions/     # CRUD
  components/
    cv/             # section cards, score charts, AI questions panel
    session/        # wizard steps (upload, review, template, optimize, finalize)
    ui/             # shadcn components
  lib/
    auth/           # session cookies, crypto
    copilot/        # Copilot SDK client, model selection
    latex/          # LaTeX compiler wrapper
    pdf/            # PDF text extraction
    pipeline/       # prompt templates
    stream/         # SSE streaming utilities
  stores/           # Zustand stores (cv, pipeline, model, ui)
templates/          # LaTeX templates (.tex)
prisma/             # Schema
```

## Templates

| Template | Style |
|----------|-------|
| **Classic** | Clean single-column, Helvetica, all-caps headers |
| **Modern** | Tighter spacing, tgheros font, subtle rules |
| **Executive** | Charter serif, generous whitespace |
| **Academic** | Latin Modern, publication-friendly |

## License

MIT
