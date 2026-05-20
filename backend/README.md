# BizResearch Agent Backend

Backend service for BizResearch Agent, built with Express, TypeScript, PostgreSQL, Redis, and LLM provider integrations such as Gemini or Claude.

## Requirements

Make sure you have the following installed:

- Node.js
- npm
- Docker
- Docker Compose

## Environment Setup

Copy the example environment file:
```bash
cp .env.example .env
```

Then update `.env` with your local configuration.

Minimum required values:
```dotenv
bash NODE_ENV=development PORT=3001
LLM_PROVIDER=gemini LLM_MODEL=gemini-2.5-flash 
GOOGLE_AI_API_KEY=your_google_ai_key
TAVILY_API_KEY=your_tavily_api_key
POSTGRES_USER=bizresearch 
POSTGRES_PASSWORD=bizresearch_dev 
POSTGRES_DB=bizresearch 
DATABASE_URL=postgresql://bizresearch:bizresearch_dev@localhost:5432/bizresearch
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_minimum_32_characters_secret 
FRONTEND_URL=[http://localhost:5173](http://localhost:5173)
```

If you want to use Claude instead of Gemini:
```dotenv
LLM_PROVIDER=claude 
LLM_MODEL=claude-sonnet-4-5 
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Running PostgreSQL and Redis with Docker

From the `backend` directory, start the required local services:
```bash
docker compose up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

Check running containers:
```bash
docker compose ps
```

Stop the containers:
```bash
docker compose down
```

Stop the containers and remove stored local data:
```bash
docker compose down -v
```

## Install Dependencies

From the `backend` directory:
```bash
npm install
```

## Run the Backend Locally

After Docker services are running and `.env` is configured:
```bash
npm run dev
```

The backend should be available at:
```text
http://localhost:3001
```

The API base URL used by the frontend is:
```text
http://localhost:3001/api
```

## Available Scripts

### Development
```bash
bash npm run dev
```

Runs the backend in development mode.

### Build
```bash
npm run build
```

Compiles the TypeScript project.

### Start Production Build
```bash
npm start
```

Runs the compiled backend from the build output.

### Type Check
```bash
npm run typecheck
```

Runs TypeScript type checking without emitting files.

### Lint
```bash
npm run lint
```

Runs ESLint.

### Fix Lint Issues
```bash
npm run lint:fix
```

Runs ESLint and automatically fixes supported issues.

## Local Development Flow

1. Start PostgreSQL and Redis:
```bash
docker compose up -d
```

2. Install dependencies
```bash
npm install 
```

3. Start the backend
```bash
npm run dev
```

4. Start the frontend from the `frontend` directory.

## Troubleshooting

### Environment validation fails

Make sure `.env` exists and all required values are filled in.

Commonly required values include:
```dotenv
LLM_PROVIDER= 
LLM_MODEL= 
GOOGLE_AI_API_KEY= 
ANTHROPIC_API_KEY= 
TAVILY_API_KEY= 
DATABASE_URL= 
REDIS_URL= 
JWT_SECRET= 
FRONTEND_URL=
```

Only one LLM API key is required depending on the selected `LLM_PROVIDER`.

### Cannot connect to PostgreSQL

Make sure Docker services are running:
```bash
docker compose up
```

When running the backend directly on your machine, use `localhost` in `DATABASE_URL`:
```bash
DATABASE_URL=postgresql://bizresearch:bizresearch_dev@localhost:5432/bizresearch
```

### Cannot connect to Redis

Make sure Redis is running:
```bash
docker compose ps
```

Use the local Redis URL:
```dotenv
REDIS_URL=redis://localhost:6379
```

### CORS error from frontend

Make sure the backend `.env` contains:
```dotenv
FRONTEND_URL=http://localhost:5173
```

Then restart the backend.