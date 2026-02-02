import { PipelineError } from "./error";

export interface ComponentInterface<I, O, S> {
  readonly priority: number;
  readonly name?: string;

  readonly canRun: (ctx: {
    state: S;
    upstreamCanGive: boolean;
  }) => boolean;

  readonly run: (input: I | undefined, ctx: {
    state: S;
    upstreamDone: boolean;
  }) => void | Promise<void>;

  readonly canGive: () => boolean;

  readonly give: () => O;

  readonly isDone: (ctx: {
    state: S;
    upstreamDone: boolean;
    upstreamCanGive: boolean;
  }) => boolean;

  readonly onPipelineError?: (error: PipelineError, ctx: { state: S }) => void;
}

export type In<C> = C extends ComponentInterface<infer I, any, any> ? I : never;
export type Out<C> = C extends ComponentInterface<any, infer O, any> ? O : never;
export type State<C> = C extends ComponentInterface<any, any, infer S> ? S : never;

export type InputOf<C> = C extends { __input?: infer I } ? I : In<C>;
export type OutputOf<C> = C extends { __output?: infer O } ? O : Out<C>;

export type Last<T extends readonly unknown[]> =
  T extends readonly [...infer _, infer L] ? L : never;

export type First<T extends readonly unknown[]> =
  T extends readonly [infer F, ...infer _] ? F : never;

type CompTuple = readonly ComponentInterface<any, any, any>[];

type FirstComponent<T extends readonly unknown[]> =
  T extends readonly [infer F, ...unknown[]] ? F : never;

type LastComponent<T extends CompTuple> =
  T extends readonly [...infer _, infer L] ? L : never;

export type FirstInput<T extends CompTuple> = In<FirstComponent<T>>;
export type LastOutput<T extends CompTuple> = Out<LastComponent<T>>;

export type NonEmptyComponents =
  readonly [ComponentInterface<any, any, any>, ...ComponentInterface<any, any, any>[]];

export type RunArgs<I> =
  [I] extends [undefined] ? [] | [undefined] : [input: I];

export type Orchestrator<
  T extends readonly [ComponentInterface<any, any, any>, ...ComponentInterface<any, any, any>[]]
> = {
  run(
    ...args: RunArgs<InputOf<T[0]>>
  ): Promise<
    T extends readonly [...unknown[], infer L]
    ? L extends ComponentInterface<any, any, any>
    ? OutputOf<L>
    : never
    : never
  >;
};

export type AnyComp<S> = ComponentInterface<any, any, S>;

export type NonEmpty<T> = readonly [T, ...T[]];

export type ChainableAny<T extends readonly ComponentInterface<any, any, any>[]> =
  T extends readonly [
    infer C1 extends ComponentInterface<any, any, any>,
    infer C2 extends ComponentInterface<any, any, any>,
    ...infer Rest extends readonly ComponentInterface<any, any, any>[]
  ]
  ? OutputOf<C1> extends InputOf<C2>
  ? readonly [C1, ...ChainableAny<readonly [C2, ...Rest]>]
  : never
  : T;

type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsUnknown<T> = unknown extends T ? ([T] extends [unknown] ? true : false) : false;

type IsDontCare<T> = IsAny<T> extends true ? true : IsUnknown<T>;

type StateOf<C> = C extends ComponentInterface<any, any, infer S> ? S : never;

type SoftStateOk<S, C> =
  IsDontCare<StateOf<C>> extends true
    ? C
    : StateOf<C> extends S
      ? C
      : never;

export type SoftStateCheck<S, T extends readonly unknown[]> = T & {
  [K in keyof T]: SoftStateOk<S, T[K]>
};
