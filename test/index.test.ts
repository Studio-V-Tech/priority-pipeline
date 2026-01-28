import { expect, test } from 'vitest'

import { noop } from '../src/index'

test('adds 1 + 2 to equal 3', () => {
  expect(noop()).toBe(undefined);
});
