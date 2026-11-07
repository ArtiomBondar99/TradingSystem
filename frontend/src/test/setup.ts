// Runs before every test file (vite.config.ts "setupFiles")
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Matchers such as toBeInTheDocument() / toHaveAttribute() come from the
// jest-dom import above. Unmount what each test rendered, so the next test
// starts with an empty page.
afterEach(cleanup);

// jsdom has no layout engine: give components that measure themselves
// (the allocation bar) a ResizeObserver that simply never reports
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver;
