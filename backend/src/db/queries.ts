import { pool } from './index';
import { AppError } from '../utils/errors';

// ============================================================
// Types — shape dari row yang dikembalikan query
// ============================================================

export interface SessionRow {
    id: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
    last_active: Date;
}

export interface TaskRow {
    id: string;
    session_id: string;
    user_message: string;
    final_answer: string | null;
    status: 'pending' | 'running' | 'done' | 'error';
    provider: 'claude' | 'gemini';
    model: string;
    iterations: number;
    created_at: Date;
    completed_at: Date | null;
}

export interface TaskStepRow {
    id: string;
    task_id: string;
    step_type: 'thinking' | 'tool_call' | 'tool_result';
    payload: Record<string, unknown>;
    iteration: number;
    created_at: Date;
}

export interface TaskWithSteps extends TaskRow {
    steps: TaskStepRow[];
}

// ============================================================
// Session Queries
// ============================================================

export async function createSession(
    ipAddress: string | null,
    userAgent: string | null,
): Promise<SessionRow> {
    const result = await pool.query<SessionRow>(
        `INSERT INTO sessions (ip_address, user_agent)
     VALUES ($1, $2)
     RETURNING *`,
        [ipAddress, userAgent],
    );

    if (!result.rows[0]) {
        throw new AppError('Gagal membuat session', 'DB_INSERT_ERROR');
    }

    return result.rows[0];
}

export async function touchSession(sessionId: string): Promise<void> {
    await pool.query(
        `UPDATE sessions SET last_active = NOW() WHERE id = $1`,
        [sessionId],
    );
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
    const result = await pool.query<SessionRow>(
        `SELECT * FROM sessions WHERE id = $1`,
        [sessionId],
    );
    return result.rows[0] ?? null;
}

// ============================================================
// Task Queries
// ============================================================

export async function createTask(params: {
    sessionId: string;
    userMessage: string;
    provider: 'claude' | 'gemini';
    model: string;
}): Promise<TaskRow> {
    const result = await pool.query<TaskRow>(
        `INSERT INTO tasks (session_id, user_message, provider, model, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
        [params.sessionId, params.userMessage, params.provider, params.model],
    );

    if (!result.rows[0]) {
        throw new AppError('Gagal membuat task', 'DB_INSERT_ERROR');
    }

    return result.rows[0];
}

export async function updateTaskStatus(
    taskId: string,
    status: TaskRow['status'],
    extras?: { finalAnswer?: string; iterations?: number },
): Promise<void> {
    await pool.query(
        `UPDATE tasks
     SET
       status        = $2::task_status,
       final_answer  = COALESCE($3::text, final_answer),
       iterations    = COALESCE($4::int, iterations),
       completed_at  = CASE
                         WHEN $2::task_status IN ('done'::task_status, 'error'::task_status)
                         THEN NOW()
                         ELSE completed_at
                       END
     WHERE id = $1`,
        [taskId, status, extras?.finalAnswer ?? null, extras?.iterations ?? null],
    );
}

export async function getTaskById(taskId: string): Promise<TaskRow | null> {
    const result = await pool.query<TaskRow>(
        `SELECT * FROM tasks WHERE id = $1`,
        [taskId],
    );
    return result.rows[0] ?? null;
}

export async function getTasksBySession(sessionId: string): Promise<TaskRow[]> {
    const result = await pool.query<TaskRow>(
        `SELECT * FROM tasks
     WHERE session_id = $1
     ORDER BY created_at DESC`,
        [sessionId],
    );
    return result.rows;
}

export async function getTaskWithSteps(taskId: string): Promise<TaskWithSteps | null> {
    // Ambil task
    const taskResult = await pool.query<TaskRow>(
        `SELECT * FROM tasks WHERE id = $1`,
        [taskId],
    );

    const task = taskResult.rows[0];
    if (!task) return null;

    // Ambil steps
    const stepsResult = await pool.query<TaskStepRow>(
        `SELECT * FROM task_steps
     WHERE task_id = $1
     ORDER BY created_at ASC`,
        [taskId],
    );

    return { ...task, steps: stepsResult.rows };
}

// ============================================================
// Task Step Queries
// ============================================================

export async function appendTaskStep(params: {
    taskId: string;
    stepType: TaskStepRow['step_type'];
    payload: Record<string, unknown>;
    iteration: number;
}): Promise<TaskStepRow> {
    const result = await pool.query<TaskStepRow>(
        `INSERT INTO task_steps (task_id, step_type, payload, iteration)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
        [params.taskId, params.stepType, JSON.stringify(params.payload), params.iteration],
    );

    if (!result.rows[0]) {
        throw new AppError('Gagal menyimpan task step', 'DB_INSERT_ERROR');
    }

    return result.rows[0];
}


export async function createSessionWithId(
    id: string,
    ipAddress: string | null,
    userAgent: string | null,
): Promise<SessionRow> {
    const result = await pool.query<SessionRow>(
        `INSERT INTO sessions (id, ip_address, user_agent)
         VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET last_active = NOW()
                                     RETURNING *`,
        [id, ipAddress, userAgent],
    );

    if (!result.rows[0]) {
        throw new AppError('Gagal membuat session', 'DB_INSERT_ERROR');
    }

    return result.rows[0];
}
