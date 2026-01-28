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

  constructor(...components: Chainable<T>) {
    if (components.length === 0) {
      throw new Error('Orchestrator must have at least one component');
    }

    this.components = components;
  }

  public async run(input?: In<First<T>>): Promise<Out<Last<T>>> {
    if (this.hasStarted) {
      throw new PipelineError('PIPELINE_STARTED_TWICE', 'Pipeline has already been started');
    }

    this.hasStarted = true;

    const priorities = Array.from(new Set(this.components.map(c => c.priority))).sort((a, b) => b - a);

    const tieredComponents = priorities.map((p) => ({
      components: this.components.filter(c => c.priority === p),
      anyCouldRun: this.components.some(c => c === this.components[0]) // First component in pipeline must run first
    }));

    this.tryRunComponent(this.components[0], input);

    while (true) {
      let anyUpperTierCouldRun = false;

      outerLoop: for (const compsInTier of tieredComponents) {
        for (const component of compsInTier.components) {
          if (anyUpperTierCouldRun) break outerLoop;

          if (component.isDone({ upstreamDone: this.getUpstreamDone(component) })) {
            await this.validateComponentDone(component);

            if (this.isLast(component)) return component.give();
          }

          const canRun = component.canRun();
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

  private getUpstreamDone(component: ComponentInterface<any, any>): boolean {
    for (let upComp = this.components[0]; upComp !== component; upComp = this.getDownstream(upComp)) {
      if (!upComp.isDone({ upstreamDone: false })) return false;
    }

    return true;
  }

  private async tryRunComponent(component: ComponentInterface<any, any>, input?: In<First<T>>): Promise<void> {
    const upstreamComponent = this.getUpstream(component);

    try {
      const maybePromise = component.run(input ?? upstreamComponent?.give(), {
        upstreamDone: this.getUpstreamDone(component),
      });
      if (maybePromise instanceof Promise) {
        maybePromise.catch((error) => handleError(error, this));
      }
    } catch (error) {
      handleError(error, this);
    }

    async function handleError(error: unknown, that: Orchestrator<T>) {
      const pipelineError = new PipelineError('COMPONENT_FAILED', 'Component failed', {
        cause: error,
        details: {
          componentIndex: that.getIndex(component),
        }
      });

      await Promise.all(that.components.map(c => c.onPipelineError?.(pipelineError)));
      throw pipelineError;
    }
  }

  private async validateComponentDone(component: ComponentInterface<any, any>) {
    for (let upComp = this.getUpstream(component); Boolean(upComp); upComp = this.getUpstream(upComp)) {
      if (!upComp.isDone({ upstreamDone: this.getUpstreamDone(upComp) })) {
        const error = new PipelineError(
          'COMPONENT_DONE_AHEAD_OF_UPSTREAM',
          'Component is done ahead of upstream',
          {
            details: {
              componentIndex: this.getIndex(component),
              upstreamComponentIndex: this.getIndex(upComp),
            }
          }
        );

        await Promise.all(this.components.map(c => c.onPipelineError?.(error)));
        throw error;
      }
    }
  }

  private getUpstream(component: ComponentInterface<any, any>) {
    return this.components[this.getIndex(component) - 1];
  }

  private getDownstream(component: ComponentInterface<any, any>) {
    return this.components[this.getIndex(component) + 1];
  }

  private isLast(component: ComponentInterface<any, any>) {
    return this.getIndex(component) === this.components.length - 1;
  }

  private getIndex(component: ComponentInterface<any, any>) {
    return this.components.indexOf(component);
  }
}
