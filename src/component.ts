import { PipelineError } from "./error";

import type { ComponentInterface } from "./models";

const DEFAULT_PRIORITY = 0;

export abstract class Component<I, O> implements ComponentInterface<I, O> {
  public readonly priority: number;

  protected readonly queue: O[] = [];

  constructor({ priority = DEFAULT_PRIORITY }: { priority?: number }) {
    this.priority = priority;
  }

  abstract isDone(ctx: { upstreamDone: boolean; upstreamCanGive: boolean }): boolean;
  abstract canRun(ctx: { upstreamCanGive: boolean }): boolean;
  abstract run(input: I | undefined, ctx: { upstreamDone: boolean }): void | Promise<void>;

  canGive(): boolean {
    return this.queue.length > 0;
  }

  give(): O {
    if (this.queue.length === 0) {
      throw new PipelineError('COMPONENT_DONE_WITH_NOTHING_TO_GIVE');
    }

    // It is legitimate that O == undefined
    return this.queue.shift() as O;
  }
}
