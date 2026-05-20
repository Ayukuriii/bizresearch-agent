-- ============================================================
-- BizResearch Agent — Database Schema
-- Run against your PostgreSQL instance
-- ============================================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('pending', 'running', 'done', 'error');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'step_type') THEN
        CREATE TYPE step_type AS ENUM ('thinking', 'tool_call', 'tool_result');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_provider') THEN
        CREATE TYPE llm_provider AS ENUM ('claude', 'gemini');
    END IF;
END
$$;

-- ============================================================
-- TABLE: sessions
-- One session = one browser/user interaction session
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions (created_at DESC);

-- ============================================================
-- TABLE: tasks
-- One task = one user message sent to the agent
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID          NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_message    TEXT          NOT NULL,
    final_answer    TEXT,
    status          task_status   NOT NULL DEFAULT 'pending',
    provider        llm_provider  NOT NULL,
    model           VARCHAR(100)  NOT NULL,
    iterations      INT           NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks (session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks (status);

-- ============================================================
-- TABLE: task_steps
-- Each agent loop step is recorded here
-- payload JSONB stores details per step_type:
--   thinking    → { message: string }
--   tool_call   → { toolName: string, args: object }
--   tool_result → { toolName: string, result: string }
-- ============================================================

CREATE TABLE IF NOT EXISTS task_steps (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    step_type   step_type   NOT NULL,
    payload     JSONB       NOT NULL DEFAULT '{}',
    iteration   INT         NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_steps_task_id    ON task_steps (task_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_created_at ON task_steps (created_at ASC);
CREATE INDEX IF NOT EXISTS idx_task_steps_payload    ON task_steps USING GIN (payload);