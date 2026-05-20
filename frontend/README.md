# BizResearch Agent Frontend

Frontend application for BizResearch Agent, built with React, TypeScript, Vite, and Tailwind CSS.

## Requirements

Make sure you have the following installed:

- Node.js
- npm
- Docker
- Docker Compose

Docker is required for running the backend dependencies such as PostgreSQL and Redis.

## Environment Setup

Copy the example environment file:
```bash
cp .env/example .env
```

Set the backend API URL:
```bash
VITE_API_URL=http://localhost:3001/api
```

## Install Dependencies

From the `frontend` directory:
```bash
npm install
```

## Running the Project Locally with Docker

The frontend depends on the backend API. The backend depends on PostgreSQL and Redis, which are started with Docker Compose from the `backend` directory.

### 1. Start PostgreSQL and Redis

From the `backend` directory:
```bash
cd ../backend docker compose up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

Check running containers:
```bash
docker compose up
```

### 2. Start the Backend

From the `backend` directory:
```bash
npm install
npm run dev
```

The backend should be available at:
```text
http://localhost:3001
```

### 3. Start the Frontend

Open a new terminal and go to the `frontend` directory:
```bash
cd ../frontend 
npm install 
npm run dev
```

The frontend should be available at:
```text
http://localhost:5173
```

Open the app in your browser:
```text
http://localhost:5173
```

## Available Scripts

### Development
```bash
npm run dev
```

Runs the frontend development server with Vite.

### Build
```bash
npm run build
```

Builds the frontend for production.

### Preview Production Build
```bash
npm run preview
```

Serves the production build locally for preview.

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

1. Start backend dependencies with Docker:
```bash
cd ../backend 
docker compose up -d
```

2. Start the backend:
```bash
npm install 
npm run dev
```

3. Start the frontend:
```bash
cd ../frontend 
npm install 
npm run dev
```

4. Open:
```text
http://localhost:5173
```

## Troubleshooting

### Frontend cannot connect to backend

Make sure the backend is running at:
```text
http://localhost:3001
```

Make sure `frontend/.env` contains:
```bash
VITE_API_URL=http://localhost:3001/api
```

After changing `.env`, restart the Vite dev server:
```bash
npm run dev
```

### Backend services are not running

Check Docker containers from the `backend` directory:
```bash
docker compose ps
```

If they are not running, start them:
```bash
docker compose up -d
```

### CORS error

Make sure the backend `.env` contains:
```dotenv
FRONTEND_URL=http://localhost:5173
```

Then restart the backend.

### Port already in use

If `localhost:5173` is already used, Vite may start on another port. Use the URL printed in the terminal.

If the backend port `3001` is already used, update the backend `PORT` value and also update:
```dotenv
VITE_API_URL=http://localhost:<new-port>/api
```

