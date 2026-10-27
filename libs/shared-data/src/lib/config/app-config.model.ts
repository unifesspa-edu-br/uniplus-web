/**
 * Configuração resolvida em runtime via `/assets/runtime-config.json`
 * (ADR-0021). A mesma imagem Docker é promovida entre ambientes; só o
 * ConfigMap montado pelo Kubernetes muda o conteúdo deste arquivo.
 *
 * Não embute URL de API/provedor OIDC no bundle (ADR-0020 do publish:
 * imagem única por app).
 */
export interface OidcRuntimeConfig {
  readonly issuerUrl: string;
  readonly clientId: string;
}

export interface AppConfig {
  readonly apiUrl: string;
  /**
   * Origin do backend geo, quando genuinamente separado do `apiUrl` (ex.:
   * HML, onde `geo-api` é um deployable próprio, host distinto). Opcional:
   * ausente cai no `apiUrl` (dev local, onde um único gateway proxeia
   * `uniplus-api` e `geo-api` sob a mesma origin).
   */
  readonly geoApiUrl?: string;
  /**
   * Origin do app web da Configuração, para os links que levam de outro app a um cadastro dela
   * (ex.: o passo da fórmula do Seleção aponta o cadastro de Peso por Área). Opcional: ausente,
   * ou em branco, cai em `/configuracao` — o que só vale na topologia em que os apps dividem o
   * mesmo host sob prefixo (HML). Ambiente com um host por app precisa declarar; em dev local,
   * onde cada app tem porta própria, o runtime-config do app declara.
   */
  readonly configuracaoWebUrl?: string;
  /**
   * Liga a navegação de acompanhamento do app Seleção para validação com dados fictícios: o
   * painel passa a ficar disponível a qualquer usuário autenticado. Opcional: ausente equivale a
   * `false`. Só habilitar em ambiente controlado; a flag não concede autorização na API.
   */
  readonly acompanhamentoValidacaoHabilitada?: boolean;
  readonly oidc: OidcRuntimeConfig;
}

/** Prefixo do app da Configuração quando os apps web dividem o mesmo host. */
const CAMINHO_PADRAO_DO_APP_CONFIGURACAO = '/configuracao';

/**
 * Onde o app web da Configuração é servido, sem barra final: `configuracaoWebUrl` quando o
 * ambiente declara um valor, senão o prefixo compartilhado (`/configuracao`). Texto em branco, ou
 * só barras, conta como ausente — o link sairia relativo à raiz do app de origem, e não ao da
 * Configuração. Aceita `null` para quem lê o sinal da configuração antes de ela carregar, como
 * os testes de componente.
 */
export function resolveConfiguracaoWebUrl(cfg: AppConfig | null): string {
  const declarada = (cfg?.configuracaoWebUrl ?? '').trim().replace(/\/+$/, '');
  return declarada === '' ? CAMINHO_PADRAO_DO_APP_CONFIGURACAO : declarada;
}

/**
 * Se a navegação de acompanhamento para validação está ligada. Só o valor booleano `true` liga;
 * ausente, texto ou qualquer outro valor contam como desligado. Aceita `null` para quem lê o
 * sinal da configuração antes de ela carregar.
 */
export function resolveAcompanhamentoValidacaoHabilitada(cfg: AppConfig | null): boolean {
  return cfg?.acompanhamentoValidacaoHabilitada === true;
}

export function resolveOidcConfig(cfg: AppConfig): OidcRuntimeConfig {
  if (!cfg.oidc) {
    throw new Error(
      'runtime-config.json deve conter o bloco "oidc" com issuerUrl e clientId.',
    );
  }
  return cfg.oidc;
}
