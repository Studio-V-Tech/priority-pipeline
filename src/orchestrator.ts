import { PipelineError } from "./error";
import { ComponentInterface, Orchestrator, NonEmpty, AnyComp, ChainableAny, SoftStateCheck } from "./models";

class OrchestratorImpl<S, T extends NonEmpty<AnyComp<S>>> {
  private hasStarted = false;
  private componentError: { component: AnyComp<S>; error: unknown } | undefined;

  constructor(
    private readonly state: S,
    private readonly components: T
  ) { }

  public async run(input?: T): Promise<T> {
    if (this.hasStarted) {
      throw new PipelineError('PIPELINE_STARTED_TWICE');
    }

    this.hasStarted = true;

    const priorities = Array.from(new Set(this.components.map(c => c.priority))).sort((a, b) => b - a);

    const tieredComponents = priorities.map((p) => ({
      components: this.components.filter(c => c.priority === p),
      anyCouldRun: this.components.some(c => c === this.firstComponent) // First component in pipeline must run first
    }));

    this.tryRunComponent(this.firstComponent, input);

    while (true) {
      let anyUpperTierCouldRun = false;

      outerLoop: for (const compsInTier of tieredComponents) {
        for (const component of compsInTier.components) {
          if (this.componentError) await this.handleError(this.componentError.component, this.componentError.error);

          if (this.getDone(component) && this.isLast(component)) return component.give();

          if (anyUpperTierCouldRun) break outerLoop;

          const canRun = component.canRun({
            state: this.state,
            upstreamCanGive: this.getUpstream(component)?.canGive() ?? true,
          });
          compsInTier.anyCouldRun = compsInTier.anyCouldRun || canRun;

          if (canRun) {
            this.tryRunComponent(component);
          }
        }

        anyUpperTierCouldRun = compsInTier.anyCouldRun;
        compsInTier.anyCouldRun = false;
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  private getDone(component: AnyComp<S>): boolean {
    for (let comp: AnyComp<S> | undefined = this.firstComponent; (comp ? this.getIndex(comp) : Infinity) <= this.getIndex(component); comp = this.getDownstream(comp!)) {
      if (!comp!.isDone({
        state: this.state,
        upstreamDone: true,
        upstreamCanGive: this.getUpstream(comp!)?.canGive() ?? true,
      })) return false;
    }

    return true;
  }

  private tryRunComponent(component: AnyComp<S>, input?: T) {
    const upstreamComponent = this.getUpstream(component);

    try {
      const maybePromise = component.run(input ?? upstreamComponent?.give(), {
        state: this.state,
        upstreamDone: upstreamComponent ? this.getDone(upstreamComponent) : true,
      });

      if (maybePromise instanceof Promise) {
        maybePromise.catch((error) => this.componentError = { component, error });
      }
    } catch (error) {
      this.componentError = { component, error };
    }
  }

  private async handleError(component: AnyComp<S>, error: unknown) {
    const pipelineError = new PipelineError('COMPONENT_FAILED', {
      cause: error,
      details: {
        componentIndex: this.getIndex(component),
      }
    });

    await Promise.all(this.components.map(c => c.onPipelineError?.(pipelineError, { state: this.state })));

    throw pipelineError;
  }

  private getUpstream(component: AnyComp<S>): AnyComp<S> | undefined {
    return this.components[this.getIndex(component) - 1];
  }

  private getDownstream(component: AnyComp<S>): AnyComp<S> | undefined {
    return this.components[this.getIndex(component) + 1];
  }

  private isLast(component: AnyComp<S>) {
    return this.getIndex(component) === this.components.length - 1;
  }

  private get firstComponent() {
    return this.components[0];
  }

  private getIndex(component: AnyComp<S>) {
    return this.components.indexOf(component);
  }
}

export function createOrchestrator<
  S,
  const T extends readonly [
    ComponentInterface<any, any, any>,
    ...ComponentInterface<any, any, any>[]
  ]
>(
  state: S,
  ...components: T
    & ChainableAny<T>
    & SoftStateCheck<S, T>
): Orchestrator<T> {
  return new OrchestratorImpl<S, any>(
    state,
    components as any
  ) as unknown as Orchestrator<T>;
}
