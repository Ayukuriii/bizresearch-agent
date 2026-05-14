// ============================================================
// Message Types
// ============================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface LLMMessage {
    role: MessageRole;
    content: string;
}

// ============================================================
// Tool Types
// ============================================================

export interface LLMToolParameter {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    enum?: string[];
    items?: LLMToolParameter;
}

export interface LLMToolParameters {
    type: 'object';
    properties: Record<string, LLMToolParameter>;
    required: string[];
}

export interface LLMTool {
    name: string;
    description: string;
    parameters: LLMToolParameters;
}

// ============================================================
// Response Types
// ============================================================

export interface ToolCall {
    id: string;
    name: string;
    args: Record<string, unknown>;
}

export interface LLMResponse {
    content: string | null;
    toolCalls: ToolCall[];
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
}

// ============================================================
// Chat Options
// ============================================================

export interface ChatOptions {
    tools?: LLMTool[];
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

// ============================================================
// Provider Interface — kontrak yang harus diimplementasi
// semua adapter
// ============================================================

export interface LLMProvider {
    chat(messages: LLMMessage[], options?: ChatOptions): Promise<LLMResponse>;
    chatStream(
        messages: LLMMessage[],
        options?: ChatOptions,
        onChunk?: (chunk: string) => void
    ): Promise<LLMResponse>;
}

// ============================================================
// Agent Types — dipakai oleh orchestrator dan SSE route
// ============================================================

export type AgentStepType =
    | 'thinking'
    | 'tool_call'
    | 'tool_result'
    | 'final_answer';

export interface AgentStep {
    type: AgentStepType;
    message?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    result?: string;
    iteration?: number;
}