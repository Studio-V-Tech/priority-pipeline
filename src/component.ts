import type { ComponentInterface } from "./models";

export abstract class Component<I, O> implements ComponentInterface<I, O> {
  constructor(public priority: number) {}

  abstract isDone(): boolean;
  abstract canRun(): boolean;
  abstract run(input: I | undefined, ctx: { upstreamDone: boolean }): void | Promise<void>;
  abstract give(): O | undefined;
}
