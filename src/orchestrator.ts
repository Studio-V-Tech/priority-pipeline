import { PipelineError } from "./error";
import { ComponentInterface, Chainable, First, In, Last, Out } from "./models";

export class Orchestrator<
  const T extends readonly ComponentInterface<any, any>[]
> {
  // Surface endpoint types for consumers
  public _types = null as unknown as {
    input: In<First<T>>;
    output: Out<Last<T>>;
  };

  private components: Chainable<T>;
  private hasStarted = false;
  private componentError: { component: ComponentInterface<any, any>, error: unknown } | undefined;

  constructor(...components: Chainable<T>) {
    if (components.length === 0) {
      throw new Error('Orchestrator must have at least one component');
    }

    this.components = components;
  }

  public async run(input?: In<First<T>>): Promise<Out<Last<T>>> {
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

          const canRun = component.canRun({ upstreamCanGive: this.getUpstream(component)?.canGive() ?? true });
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

  private getDone(component: ComponentInterface<any, any>): boolean {
    for (let comp: ComponentInterface<any, any> | undefined = this.firstComponent; (comp ? this.getIndex(comp) : Infinity) <= this.getIndex(component); comp = this.getDownstream(comp!)) {
      if (!comp!.isDone({ upstreamDone: true, upstreamCanGive: this.getUpstream(comp!)?.canGive() ?? true })) return false;
    }

    return true;
  }

  private tryRunComponent(component: ComponentInterface<any, any>, input?: In<First<T>>) {
    const upstreamComponent = this.getUpstream(component);

    try {
      const maybePromise = component.run(input ?? upstreamComponent?.give(), {
        upstreamDone: upstreamComponent ? this.getDone(upstreamComponent) : true,
      });

      if (maybePromise instanceof Promise) {
        maybePromise.catch((error) => this.componentError = { component, error });
      }
    } catch (error) {
      this.componentError = { component, error };
    }
  }

  private async handleError(component: ComponentInterface<any, any>, error: unknown) {
    const pipelineError = new PipelineError('COMPONENT_FAILED', {
      cause: error,
      details: {
        componentIndex: this.getIndex(component),
      }
    });

    await Promise.all(this.components.map(c => c.onPipelineError?.(pipelineError)));

    throw pipelineError;
  }

  private getUpstream(component: ComponentInterface<any, any>): ComponentInterface<any, any> | undefined {
    return this.components[this.getIndex(component) - 1];
  }

  private getDownstream(component: ComponentInterface<any, any>): ComponentInterface<any, any> | undefined {
    return this.components[this.getIndex(component) + 1];
  }

  private isLast(component: ComponentInterface<any, any>) {
    return this.getIndex(component) === this.components.length - 1;
  }

  private get firstComponent() {
    return this.components[0];
  }

  private getIndex(component: ComponentInterface<any, any>) {
    return this.components.indexOf(component);
  }
}
