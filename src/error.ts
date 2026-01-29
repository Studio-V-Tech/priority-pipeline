export type PipelineErrorCode =
  | "PIPELINE_STARTED_TWICE"
  | "COMPONENT_FAILED"
  | "COMPONENT_DONE_WITH_NOTHING_TO_GIVE";

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: PipelineErrorCode,
    opts?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(code, { cause: opts?.cause });
    this.name = new.target.name;
    this.code = code;
    this.details = opts?.details;
  }
}