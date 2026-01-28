import { expect, test } from 'vitest'

import { Orchestrator } from "../src/orchestrator";

const one = {
  priority: 1,
  counter: 0,
  give: function () {
    return this.counter;
  },
  run: function () {
    this.counter++;
  },
  canRun: () => true,
  isDone: function () {
    return this.counter >= 3;
  },
}

const two = {
  priority: 2,
  queue: [] as string[],
  give: function () {
    return this.queue.shift();
  },
  run: function (value: number) {
    this.queue.push(value.toString());
  },
  canRun: () => true,
  isDone: ({ upstreamDone }: { upstreamDone: boolean }) => upstreamDone,
}

const three = {
  priority: 3,
  memory: {} as Record<string, boolean>,
  give: function () {
    return this.memory;
  },
  run: function (value: string) {
    this.memory[value] = true;
  },
  canRun: () => true,
  isDone: ({ upstreamDone }: { upstreamDone: boolean }) => upstreamDone,
}

test('creates orchestrator', async () => {
  const orchestrator = new Orchestrator(one, two, three);
  expect(orchestrator).toBeDefined();

  const result = await orchestrator.run();

  expect(result).toBeDefined();
  expect(result['0']).toBe('0');
  expect(result['1']).toBe('1');
  expect(result['2']).toBe('2');
  expect(result['3']).toBe(undefined);
});

test('creates orchestrator in wrong order', () => {
  // @ts-expect-error If there were no type error in the next line, this line would fail linting as an unused directive
  const orchestrator = new Orchestrator(two, one, three);
  expect(orchestrator).toBeDefined();
});
