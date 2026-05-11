# SECOP Agent

Monorepo for the SECOP Bidding Analysis Platform — automating discovery, classification, and evaluation of Colombian public procurement opportunities.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   apps/web      │────▶│   apps/nest     │
│   React + Vite  │ REST│   NestJS API    │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │PostgreSQL│ │  Redis   │ │  Hermes  │
              │+ pgvector│ │ (BullMQ) │ │(scheduler│
              └──────────┘ └──────────┘ └──────────┘
```

## Stack

| Component | Technology |
|-----------|-----------|
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL + pgvector |
| Queue | BullMQ + Redis |
| Automation | Hermes |
| LLM Provider | OpenCode Go (abstracted via LlmProvider) |
| Frontend | React + Vite + Tailwind CSS |

## Getting Started

```bash
# Install dependencies
npm install

# Start infrastructure
docker compose up -d

# Run database migrations
npm run migration:run -w apps/nest

# Start backend (port 3000)
npm run dev:nest

# Start frontend (port 5173)
npm run dev:web
```

## Project Structure

```
secop-agent/
├── apps/
│   ├── nest/          # NestJS backend
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── convocatorias/
│   │       │   ├── companies/
│   │       │   ├── scoring/
│   │       │   ├── llm/
│   │       │   ├── documents/
│   │       │   ├── rag/
│   │       │   ├── competitors/
│   │       │   ├── alerts/
│   │       │   └── audit/
│   │       ├── common/
│   │       └── config/
│   └── web/           # React frontend
│       └── src/
│           ├── pages/
│           ├── components/
│           └── hooks/
├── docs/              # Documentation & architecture
├── docker-compose.yml
└── package.json       # Root workspace config
```

## MVP Scope (Sprint 1-3)

✅ Automatic ingestion from SECOP via SODA API 3.0
✅ Sector classification by keyword rules
✅ Company profile with sectors, regions, financial capacity
✅ Scoring engine: 3 variables (technical, economic, experience)
✅ Hard filters (financial, sector, region, type, date, modality)
✅ Web dashboard with score table, filters, and detail view
✅ LlmProvider abstraction + OpenCode Go implementation

## License

Source code: AGPL-3.0 — see [LICENSE](LICENSE)
