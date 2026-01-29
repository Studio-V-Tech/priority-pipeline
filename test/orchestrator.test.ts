import { expect, test } from 'vitest'

import { Orchestrator } from "../src/orchestrator";

const oneFactory = () => ({
  priority: 1,
  counter: 0,
  queue: [] as number[],
  isDone: function () {
    return this.counter > 3;
  },
  canGive: function () {
    return this.queue.length > 0;
  },
  give: function () {
    return this.queue.shift()!;
  },
  canRun: function () {
    return !this.isDone();
  },
  run: function () {
    this.queue.push(this.counter++);
  },
});

const twoFactory = () => ({
  priority: 1,
  queue: [] as string[],
  canGive: function () {
    return this.queue.length > 0;
  },
  give: function () {
    return this.queue.shift()!;
  },
  canRun: ({ upstreamCanGive }: { upstreamCanGive: boolean }) => upstreamCanGive,
  run: function (value: number) {
    this.queue.push(value.toString());
  },
  isDone: ({ upstreamDone, upstreamCanGive }: { upstreamDone: boolean, upstreamCanGive: boolean }) => upstreamDone && !upstreamCanGive,
});

const threeFactory = () => ({
  priority: 1,
  memory: {} as Record<string, boolean>,
  canGive: () => true,
  give: function () {
    return this.memory;
  },
  canRun: ({ upstreamCanGive }: { upstreamCanGive: boolean }) => upstreamCanGive,
  run: function (value: string) {
    this.memory[value] = value === '3';
  },
  isDone: ({ upstreamDone, upstreamCanGive }: { upstreamDone: boolean, upstreamCanGive: boolean }) => upstreamDone && !upstreamCanGive,
});

test('creates orchestrator', async () => {
  const orchestrator = new Orchestrator(oneFactory(), twoFactory(), threeFactory());
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
  const orchestratorWrongOrder = new Orchestrator(twoFactory(), oneFactory(), threeFactory());
  expect(orchestratorWrongOrder).toBeDefined();

  // @ts-expect-error If there were no type error in the next line, this line would fail linting as an unused directive
  const orchestratorWrongOrder2 = new Orchestrator(threeFactory(), twoFactory(), oneFactory());
  expect(orchestratorWrongOrder).toBeDefined();
});

test('orchestrator succeeds with same priorities', async () => {
  const orchestrator = new Orchestrator(oneFactory(), twoFactory(), threeFactory());
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
    { ...oneFactory(), priority: 1 },
    { ...twoFactory(), priority: 2 },
    { ...threeFactory(), priority: 3 },
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
    { ...oneFactory(), priority: 3 },
    { ...twoFactory(), priority: 2 },
    { ...threeFactory(), priority: 1 },
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
    { ...oneFactory(), priority: 2 },
    { ...twoFactory(), priority: 1 },
    { ...threeFactory(), priority: 3 },
  );

  const result = await orchestrator.run();

  expect(result['0']).toBe(false);
  expect(result['1']).toBe(false);
  expect(result['2']).toBe(false);
  expect(result['3']).toBe(true);
  expect(result['4']).toBe(undefined);

  const orchestrator2 = new Orchestrator(
    { ...oneFactory(), priority: 3 },
    { ...twoFactory(), priority: 1 },
    { ...threeFactory(), priority: 2 },
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
    oneFactory(),
    { ...twoFactory(), run: () => { throw new Error('Component failed'); } },
    threeFactory(),
  );

  await expect(async () => { await orchestrator.run() }).rejects.toThrowError('COMPONENT_FAILED');
});

test('orchestrator throws when run for a second time', async () => {
  const orchestrator = new Orchestrator(oneFactory(), twoFactory(), threeFactory());

  orchestrator.run();

  await expect(async () => { await orchestrator.run() }).rejects.toThrowError('PIPELINE_STARTED_TWICE');
});

test('orchestrator throws when run for a second time even if first time completed', async () => {
  const orchestrator = new Orchestrator(oneFactory(), twoFactory(), threeFactory());

  await orchestrator.run();

  await expect(async () => { await orchestrator.run() }).rejects.toThrowError('PIPELINE_STARTED_TWICE');
});

test('orchestrator succeeds with an async component', async () => {
  const orchestrator = new Orchestrator(
    oneFactory(),
    { 
      ...twoFactory(),
      run: async function (value: number) {
        await new Promise(resolve => setTimeout(resolve, 1));
        this.queue.push(value.toString());
      },
    },
    threeFactory(),
  );

  const result = await orchestrator.run();

  expect(result['0']).toBe(false);
  expect(result['1']).toBe(false);
  expect(result['2']).toBe(false);
  expect(result['3']).toBe(true);
  expect(result['4']).toBe(undefined);
});

test('orchestrator throws when async component fails', async () => {
  const orchestrator = new Orchestrator(
    oneFactory(),
    { ...twoFactory(), run: async function () { throw new Error('Component failed'); } },
    threeFactory(),
  );

  await expect(async () => { await orchestrator.run() }).rejects.toThrowError('COMPONENT_FAILED');
});
