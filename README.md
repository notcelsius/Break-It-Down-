# Break It Down

A to-do app that lets a logged-in user create tasks and generate exactly 3 actionable steps per task via an AI service.

## Repo Layout

```
break-it-down/
├── break-it-down-web/        # Next.js app (frontend + API routes)
├── break-it-down-ai/         # FastAPI AI service
└── README_GITHUB.md
```

## Prerequisites

- Node.js >= 20.9
- npm
- Python 3.10+
- Supabase project (Auth + Postgres)

## 1) Web App Setup (Next.js)

```bash
cd break-it-down-web
npm install
```

Create `break-it-down-web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
AI_SERVICE_URL=http://localhost:8000
```

Start the web app:

```bash
npm run dev
```

Open http://localhost:3000

## 2) Database Setup (Supabase)

In Supabase, open SQL Editor and run the contents of:

```
break-it-down-web/supabase/schema.sql
```

This creates `tasks` and `steps` tables with RLS policies.

## 3) AI Service Setup (FastAPI)

```bash
cd break-it-down-ai
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

Create `break-it-down-ai/.env`:

```
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
ALLOWED_ORIGINS=http://localhost:3000
```

Start the AI service:

```bash
uvicorn main:app --reload --port 8000
```

## 4) Usage

- Sign up and confirm your email.
- Create a top-level task.
- Click “Break it down” once to generate exactly 3 steps.

## Notes

- The AI service enforces 3 steps and falls back to a deterministic response if the API fails.
- The web app blocks step generation if steps already exist.

## Troubleshooting

- Ensure Node >= 20.9 and Python deps are installed.
- Verify Supabase RLS is enabled by running `schema.sql`.
- If steps are not generating, check the AI service logs and confirm `OPENAI_API_KEY` is loaded.
