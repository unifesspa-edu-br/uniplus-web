import { describe, expect, it, afterEach } from 'vitest';
import { resolveRuntimeConfigPath, resolveGeoBasePath, toAuthConfig } from './runtime-config.provider';
import type { AppConfigService } from './app-config.service';
import type { AppConfig } from './app-config.model';

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

describe('resolveGeoBasePath (issue #570)', () => {
  function storeCom(cfg: { apiUrl: string; geoApiUrl?: string }): AppConfigService {
    return { get: () => cfg } as AppConfigService;
  }

  it('usa geoApiUrl quando presente — geo-api é host separado (ex.: HML)', () => {
    const store = storeCom({
      apiUrl: 'https://uniplus-api-hml.unifesspa.edu.br',
      geoApiUrl: 'https://geo-api-hml.unifesspa.edu.br',
    });

    expect(resolveGeoBasePath(store)).toBe('https://geo-api-hml.unifesspa.edu.br');
  });

  it('cai no apiUrl quando geoApiUrl está ausente — gateway único (dev local)', () => {
    const store = storeCom({ apiUrl: 'http://localhost:5000' });

    expect(resolveGeoBasePath(store)).toBe('http://localhost:5000');
  });
});

describe('toAuthConfig — allowlist do geoApiUrl (Codex PR #571)', () => {
  function cfgCom(overrides: Partial<AppConfig>): AppConfig {
    return {
      apiUrl: 'https://uniplus-api-hml.unifesspa.edu.br',
      oidc: { issuerUrl: 'https://oidc.example/auth/realms/unifesspa', clientId: 'uniplus-portal' },
      ...overrides,
    };
  }

  it('inclui geoApiUrl na allowlist quando difere do apiUrl — senão tokenInterceptor não anexa o Bearer', () => {
    const cfg = cfgCom({ geoApiUrl: 'https://geo-api-hml.unifesspa.edu.br' });

    expect(toAuthConfig(cfg).allowedUrls).toEqual([
      'https://uniplus-api-hml.unifesspa.edu.br',
      'https://oidc.example/auth/realms/unifesspa',
      'https://geo-api-hml.unifesspa.edu.br',
    ]);
  });

  it('não duplica a origin quando geoApiUrl é ausente (cai no apiUrl)', () => {
    const cfg = cfgCom({});

    expect(toAuthConfig(cfg).allowedUrls).toEqual([
      'https://uniplus-api-hml.unifesspa.edu.br',
      'https://oidc.example/auth/realms/unifesspa',
    ]);
  });

  it('não duplica a origin quando geoApiUrl é igual ao apiUrl', () => {
    const cfg = cfgCom({ geoApiUrl: 'https://uniplus-api-hml.unifesspa.edu.br' });

    expect(toAuthConfig(cfg).allowedUrls).toEqual([
      'https://uniplus-api-hml.unifesspa.edu.br',
      'https://oidc.example/auth/realms/unifesspa',
    ]);
  });
});
