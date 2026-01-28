export type PipelineErrorCode =
  | "PIPELINE_STARTED_TWICE"
  | "COMPONENT_FAILED"
  | "COMPONENT_DONE_AHEAD_OF_UPSTREAM";

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: PipelineErrorCode,
    message: string,
    opts?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(message, { cause: opts?.cause });
    this.name = new.target.name;
    this.code = code;
    this.details = opts?.details;
  }
}