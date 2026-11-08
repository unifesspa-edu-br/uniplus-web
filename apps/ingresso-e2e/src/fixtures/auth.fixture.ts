import { SENHA_DAS_PERSONAS } from '@uniplus/shared-e2e';
import { test as base } from '@playwright/test';

export const STORAGE_STATE_PATH_ADMIN = '.playwright-auth/storage-state-admin.json';

export const ADMIN_USER = {
  username: 'admin',
  password: SENHA_DAS_PERSONAS,
} as const;

export const test = base;

export { expect } from '@playwright/test';
