import { PipelineError } from "./error";

export interface ComponentInterface<I, O> {
  priority: number;

  canRun(ctx: {
    upstreamCanGive: boolean;
  }): boolean;

  run(input: I, ctx: {
    upstreamDone: boolean;
  }): void | Promise<void>;

  canGive(): boolean;

  give(): O | undefined;

  isDone(ctx: {
    upstreamDone: boolean;
    upstreamCanGive: boolean;
  }): boolean;

  onPipelineError?(error: PipelineError): void;
}

export type In<C> = C extends ComponentInterface<infer I, any> ? I : never;
export type Out<C> = C extends ComponentInterface<any, infer O> ? O : never;

export type Last<T extends readonly unknown[]> =
  T extends readonly [...infer _R, infer L] ? L : never;

export type First<T extends readonly unknown[]> =
  T extends readonly [infer F, ...infer _R] ? F : never;

export type Chainable<T extends readonly ComponentInterface<any, any>[]> =
  T extends readonly [
    infer C1 extends ComponentInterface<any, any>,
    infer C2 extends ComponentInterface<any, any>,
    ...infer Rest extends readonly ComponentInterface<any, any>[]
  ]
  ? Out<C1> extends In<C2>
  ? readonly [C1, ...Chainable<readonly [C2, ...Rest]>]
  : never
  : T;
