import { expect, test } from 'vitest'

import { Component } from "../src/component";
import { Orchestrator } from "../src/orchestrator";

class One extends Component<undefined, number> {
  counter = 0;

  constructor({ priority }: { priority?: number } = {}) {
    super({
      priority,
    });
  }

  isDone() {
    return this.counter > 3;
  }

  canRun() {
    return !this.isDone();
  }

  run() {
    this.queue.push(this.counter++);
  }
}

class Two extends Component<number, string> {
  constructor({ priority }: { priority?: number } = {}) {
    super({
      priority,
    });
  }

  canRun({ upstreamCanGive }: { upstreamCanGive: boolean }) {
    return upstreamCanGive;
  }

  run(value: number) {
    this.queue.push(value.toString());
  }

  isDone({ upstreamDone, upstreamCanGive }: { upstreamDone: boolean, upstreamCanGive: boolean }) {
    return upstreamDone && !upstreamCanGive;
  }
}

class Three extends Component<string, Record<string, boolean>> {
  memory = {} as Record<string, boolean>;

  constructor({ priority }: { priority?: number } = {}) {
    super({
      priority,
    });
  }

  canRun({ upstreamCanGive }: { upstreamCanGive: boolean }) {
    return upstreamCanGive;
  }

  run(value: string) {
    this.memory[value] = value === '3';
  }

  isDone({ upstreamDone, upstreamCanGive }: { upstreamDone: boolean, upstreamCanGive: boolean }) {
    if (upstreamDone && !upstreamCanGive) {
      this.queue.push(this.memory);
      return true;
    }

    return false;
  }
}

class FailingTwo extends Two {
  run(value: number) {
    throw new Error('Component failed');
  }
}

test('creates orchestrator', async () => {
  const orchestrator = new Orchestrator(new One(), new Two(), new Three());
  expect(orchestrator).toBeDefined();

  const result = await orchestrator.run();

  expect(result).toBeDefined();
  expect(result['0']).toBe(false);
  expect(result['1']).toBe(false);
  expect(result['2']).toBe(false);
  expect(result['3']).toBe(true);
  expect(result['4']).toBe(undefined);
});

test('creates orchestrator in wrong order (with type error)', () => {
  // @ts-expect-error If there were no type error in the next line, this line would fail linting as an unused directive
  const orchestratorWrongOrder = new Orchestrator(new Two(), new One(), new Three());
  expect(orchestratorWrongOrder).toBeDefined();

  // @ts-expect-error If there were no type error in the next line, this line would fail linting as an unused directive
  const orchestratorWrongOrder2 = new Orchestrator(new Three(), new Two(), new One());
  expect(orchestratorWrongOrder).toBeDefined();
});

test('orchestrator succeeds with same priorities', async () => {
  const orchestrator = new Orchestrator(new One(), new Two(), new Three());
  expect(orchestrator).toBeDefined();

  const result = await orchestrator.run();

  expect(result['0']).toBe(false);
  expect(result['1']).toBe(false);
  expect(result['2']).toBe(false);
  expect(result['3']).toBe(true);
  expect(result['4']).toBe(undefined);
});

test('orchestrator succeeds with increasing priorities', async () => {
  const orchestrator = new Orchestrator(
    new One({ priority: 1 }),
    new Two({ priority: 2 }),
    new Three({ priority: 3 }),
  );

  const result = await orchestrator.run();

  expect(result['0']).toBe(false);
  expect(result['1']).toBe(false);
  expect(result['2']).toBe(false);
  expect(result['3']).toBe(true);
  expect(result['4']).toBe(undefined);
});

test('orchestrator succeeds with decreasing priorities', async () => {
  const orchestrator = new Orchestrator(
    new One({ priority: 3 }),
    new Two({ priority: 2 }),
    new Three({ priority: 1 }),
  );

  const result = await orchestrator.run();

  expect(result['0']).toBe(false);
  expect(result['1']).toBe(false);
  expect(result['2']).toBe(false);
  expect(result['3']).toBe(true);
  expect(result['4']).toBe(undefined);
});

test('orchestrator succeeds with mixed priorities', async () => {
  const orchestrator = new Orchestrator(
    new One({ priority: 2 }),
    new Two({ priority: 1 }),
    new Three({ priority: 3 }),
  );

  const result = await orchestrator.run();

  expect(result['0']).toBe(false);
  expect(result['1']).toBe(false);
  expect(result['2']).toBe(false);
  expect(result['3']).toBe(true);
  expect(result['4']).toBe(undefined);

  const orchestrator2 = new Orchestrator(
    new One({ priority: 3 }),
    new Two({ priority: 1 }),
    new Three({ priority: 2 }),
  );

  const result2 = await orchestrator2.run();

  expect(result2['0']).toBe(false);
  expect(result2['1']).toBe(false);
  expect(result2['2']).toBe(false);
  expect(result2['3']).toBe(true);
  expect(result2['4']).toBe(undefined);
});

test('orchestrator throws when component fails', async () => {
  const orchestrator = new Orchestrator(
    new One(),
    new FailingTwo(),
    new Three(),
  );

  await expect(async () => { await orchestrator.run() }).rejects.toThrowError('COMPONENT_FAILED');
});

test('orchestrator throws when run for a second time', async () => {
  const orchestrator = new Orchestrator(new One(), new Two(), new Three());

  orchestrator.run();

  await expect(async () => { await orchestrator.run() }).rejects.toThrowError('PIPELINE_STARTED_TWICE');
});

test('orchestrator throws when run for a second time even if first time completed', async () => {
  const orchestrator = new Orchestrator(new One(), new Two(), new Three());

  await orchestrator.run();

  await expect(async () => { await orchestrator.run() }).rejects.toThrowError('PIPELINE_STARTED_TWICE');
});
