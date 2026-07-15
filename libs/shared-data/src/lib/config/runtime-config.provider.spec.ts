import { describe, expect, it, afterEach } from 'vitest';
import { resolveRuntimeConfigPath } from './runtime-config.provider';

describe('resolveRuntimeConfigPath (Story #446/#452)', () => {
  let base: HTMLBaseElement | null = null;

  afterEach(() => {
    base?.remove();
    base = null;
  });

  it('resolve relativo a document.baseURI na raiz', () => {
    expect(resolveRuntimeConfigPath()).toBe(
      new URL('assets/runtime-config.json', document.baseURI).toString(),
    );
  });

  it('resolve sob o mount point quando servido sob subpath (<base href> não-raiz)', () => {
    base = document.createElement('base');
    base.href = 'http://localhost:3000/portal/';
    document.head.appendChild(base);

    expect(document.baseURI).toBe('http://localhost:3000/portal/');
    expect(resolveRuntimeConfigPath()).toBe('http://localhost:3000/portal/assets/runtime-config.json');
  });
});
