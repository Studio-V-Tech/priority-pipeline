import { PipelineError } from "./error";

import type { ComponentInterface } from "./models";

const DEFAULT_PRIORITY = 0;

export abstract class Component<I, O, S> implements ComponentInterface<I, O, S> {
  declare readonly __input?: I;
  declare readonly __output?: O;

  public readonly priority: number;
  public readonly name?: string;

  protected readonly queue: O[] = [];

  constructor({ priority, name }: { priority?: number; name?: string } = {}) {
    this.priority = priority ?? DEFAULT_PRIORITY;
    this.name = name;
  }

  abstract isDone(ctx: { upstreamDone: boolean; upstreamCanGive: boolean, state: S }): boolean;
  abstract canRun(ctx: { upstreamCanGive: boolean, state: S }): boolean;
  abstract run(input: I | undefined, ctx: { upstreamDone: boolean, state: S }): void | Promise<void>;

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
