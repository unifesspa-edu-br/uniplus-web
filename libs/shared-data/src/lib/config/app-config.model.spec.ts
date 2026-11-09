import { describe, expect, it } from 'vitest';

import { resolveConfiguracaoWebUrl, type AppConfig } from './app-config.model';

const BASE: AppConfig = {
  apiUrl: 'http://localhost:5000',
  oidc: { issuerUrl: 'http://localhost:8080/realms/unifesspa', clientId: 'selecao-web' },
};

describe('resolveConfiguracaoWebUrl', () => {
  it('usa a origem declarada pelo ambiente, sem barra final', () => {
    expect(
      resolveConfiguracaoWebUrl({ ...BASE, configuracaoWebUrl: 'http://localhost:4203/' }),
    ).toBe('http://localhost:4203');
  });

  it('cai no prefixo compartilhado quando o ambiente não declara', () => {
    expect(resolveConfiguracaoWebUrl(BASE)).toBe('/configuracao');
  });

  it('trata a origem em branco como ausente', () => {
    expect(resolveConfiguracaoWebUrl({ ...BASE, configuracaoWebUrl: '   ' })).toBe('/configuracao');
    expect(resolveConfiguracaoWebUrl({ ...BASE, configuracaoWebUrl: '' })).toBe('/configuracao');
  });

  it('trata a origem declarada só com barras como ausente', () => {
    expect(resolveConfiguracaoWebUrl({ ...BASE, configuracaoWebUrl: '/' })).toBe('/configuracao');
    expect(resolveConfiguracaoWebUrl({ ...BASE, configuracaoWebUrl: ' // ' })).toBe(
      '/configuracao',
    );
  });

  it('cai no prefixo compartilhado antes de a configuração carregar', () => {
    expect(resolveConfiguracaoWebUrl(null)).toBe('/configuracao');
  });
});
