import type { ShapeType } from './matrix/constants';

// A single row from the matrix — represents one shape
export interface MatrixRow {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly type: ShapeType;
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly rotation: number;
  readonly alive: number;
  readonly zIndex: number;
}

// Drawing tool selection
export type DrawingTool = 'rect' | 'circle' | 'line' | 'triangle' | 'select';

// Point in canvas space
export interface Point {
  readonly x: number;
  readonly y: number;
}

// Protocol log entry — records what was sent/received to prove transparency
export interface ProtocolEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly type: 'ssl_sent' | 'tool_call' | 'tool_result' | 'ai_response' | 'error';
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
}

// API request/response types
export interface ChatRequest {
  readonly ssl: string;
  readonly matrix: readonly number[][];
  readonly userMessage: string;
}

export interface ToolCallLog {
  readonly name: string;
  readonly input: Record<string, unknown>;
  readonly result: unknown;
}

export interface ChatResponse {
  readonly updatedMatrix: readonly number[][];
  readonly aiMessage: string;
  readonly toolCalls: readonly ToolCallLog[];
  readonly sslSent: string;
}
