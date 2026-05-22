# BizResearch Agent

> **AI-powered business research agent** — demo project for Upwork portfolio.
> Demonstrates production-grade agentic system design: multi-step reasoning, tool calling, multi-provider LLM, and real-time SSE streaming.

---

## Repository Structure

```
bizresearch-agent/
├── backend/          ← Node.js 20 + Express + TypeScript (agent core, LLM layer, REST/SSE API)
├── frontend/         ← React 18 + Vite + Tailwind + shadcn/ui
└── README.md         ← you are here
```

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS |
| PostgreSQL | 15 |
| Redis | 7 |

### 1 — Clone & install

```bash
git clone https://github.com/your-username/bizresearch-agent.git
cd bizresearch-agent

# Install both workspaces
cd backend && npm install
cd ../frontend && npm install
```

### 2 — Configure environment

Copy and fill in the env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Minimum required variables in `backend/.env`:

```env
LLM_PROVIDER=gemini          # gemini | claude | groq
GOOGLE_AI_API_KEY=...
TAVILY_API_KEY=...
DATABASE_URL=postgresql://user:pass@localhost:5432/bizresearch
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:5173
PORT=3001
```

> **Default provider is Gemini** (free tier, 1 500 req/day).
> Switch provider by changing `LLM_PROVIDER` in `.env` and restarting the backend.

### 3 — Run the database schema

```bash
cd backend
psql $DATABASE_URL -f src/db/schema.sql
```

### 4 — Start both servers

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:3001  
Health check: http://localhost:3001/api/health

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│  Frontend (React + Vite)                         │
│  AgentChat → SSE stream → StepViewer + Report    │
└───────────────────┬──────────────────────────────┘
                    │ POST /api/agent/run (SSE)
┌───────────────────▼──────────────────────────────┐
│  Backend (Express + TypeScript)                  │
│                                                  │
│  Route → Orchestrator (agent loop, max 10 iter.) │
│            ├── LLM Factory                       │
│            │     ├── Gemini adapter              │
│            │     ├── Claude adapter              │
│            │     └── Groq adapter                │
│            ├── Tools                             │
│            │     ├── webSearch (Tavily)          │
│            │     ├── scraper (cheerio)           │
│            │     └── summarizer (LLM)            │
│            └── Memory (Redis — 24h TTL)          │
│                                                  │
│  PostgreSQL: sessions · tasks · task_steps       │
└──────────────────────────────────────────────────┘
```

### LLM Provider Switching

The entire LLM layer is provider-agnostic. Swap with a single env change:

| Provider | Env value | Notes |
|----------|-----------|-------|
| Google Gemini | `gemini` | Default; free tier 1 500 req/day |
| Anthropic Claude | `claude` | Best reasoning quality; use for demos |
| Groq | `groq` | Fastest inference |

---

## Documentation

| Document | Description |
|----------|-------------|
| [`backend/README.md`](./backend/README.md) | Backend setup, API reference, LLM adapter guide, DB schema |
| [`frontend/README.md`](./frontend/README.md) | Frontend setup, component structure, SSE hook, store |

---

## Build Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 — Foundation | `env.ts`, `llm/types.ts`, Gemini adapter, factory | ⬜ |
| 2 — Agent Core | Tools, prompts, memory, orchestrator | ⬜ |
| 3 — Backend API | DB, queries, routes, Claude + Groq adapters | ⬜ |
| 4 — Frontend | SSE hook, Zustand store, UI components | ⬜ |
| 5 — Polish | Production env, README, demo scenarios | ⬜ |

---

## Tech Stack

**Backend** — Node.js 20, TypeScript 5.4, Express 4, `@anthropic-ai/sdk`, `@google/generative-ai`, `openai` (Groq), PostgreSQL 15 (`pg`), Redis 7, Zod  
**Frontend** — React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Zustand, TanStack Query v5, shadcn/ui, Axios

---

## License

MIT