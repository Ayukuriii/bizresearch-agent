-- ============================================================
-- BizResearch Agent — Database Schema
-- Dijalankan otomatis oleh PostgreSQL saat container pertama kali up
-- ============================================================

-- Extension untuk UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE task_status AS ENUM ('pending', 'running', 'done', 'error');
CREATE TYPE step_type AS ENUM ('thinking', 'tool_call', 'tool_result');
CREATE TYPE llm_provider AS ENUM ('claude', 'gemini');

-- ============================================================
-- TABLE: sessions
-- Satu session = satu browser/user yang berinteraksi
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address    VARCHAR(45),                    -- IPv4 atau IPv6
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX idx_sessions_created_at ON sessions (created_at DESC);

-- ============================================================
-- TABLE: tasks
-- Satu task = satu kali user kirim pesan ke agent
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

CREATE INDEX idx_tasks_session_id ON tasks (session_id);
CREATE INDEX idx_tasks_created_at ON tasks (created_at DESC);
CREATE INDEX idx_tasks_status     ON tasks (status);

-- ============================================================
-- TABLE: task_steps
-- Setiap langkah agent loop dicatat di sini
-- payload JSONB menyimpan detail per step_type:
--   thinking   → { message: string }
--   tool_call  → { toolName: string, args: object }
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

CREATE INDEX idx_task_steps_task_id    ON task_steps (task_id);
CREATE INDEX idx_task_steps_created_at ON task_steps (created_at ASC);
CREATE INDEX idx_task_steps_payload    ON task_steps USING GIN (payload);