import { test as base } from './base.fixture';

export const test = base.extend<{ authenticatedPage: void }>({
  authenticatedPage: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      // TODO: implementar autenticação via Keycloak para testes E2E
      await use();
    },
    { auto: false },
  ],
});

export { expect } from '@playwright/test';
