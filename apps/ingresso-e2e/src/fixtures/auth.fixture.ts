import { test as base } from '@playwright/test';

export const STORAGE_STATE_PATH_ADMIN = '.playwright-auth/storage-state-admin.json';

export const ADMIN_USER = {
  username: 'admin',
  password: 'E2eTest!123',
} as const;

export const test = base;

export { expect } from '@playwright/test';
