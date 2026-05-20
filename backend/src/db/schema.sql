-- BizResearch Agent — Database Schema
-- Run once against your PostgreSQL instance

CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT PRIMARY KEY,
    ip_address    TEXT NOT NULL,
    user_agent    TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    provider      TEXT NOT NULL,
    metadata      JSONB DEFAULT '{}'
    );

CREATE TABLE IF NOT EXISTS tasks (
    id            SERIAL PRIMARY KEY,
    session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    message       TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'error')),
    final_answer  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
    );

CREATE TABLE IF NOT EXISTS task_steps (
    id            SERIAL PRIMARY KEY,
    task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    step_type     TEXT NOT NULL
    CHECK (step_type IN ('thinking', 'tool_call', 'tool_result', 'answer')),
    tool_name     TEXT,
    content       TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Index untuk query yang sering dipakai
CREATE INDEX IF NOT EXISTS idx_tasks_session_id     ON tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_task_id   ON task_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at     ON tasks(created_at DESC);