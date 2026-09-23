import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Nach jedem Test das gerenderte DOM aufräumen, damit Tests isoliert bleiben.
afterEach(() => {
  cleanup();
});
