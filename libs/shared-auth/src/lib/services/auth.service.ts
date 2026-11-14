import { Injectable, signal, computed } from '@angular/core';
import Keycloak, { type KeycloakInitOptions } from 'keycloak-js';
import { AuthConfig } from '../models/auth-config.model';
import { UserProfile } from '../models/user.model';
import { UniPlusTokenClaims } from '../models/token-claims.model';
import { primeiraDescricao } from '../models/descricao-do-erro';

/**
 * Padrão usado por Keycloak quando um refresh token é replayado:
 * `error: "invalid_grant"`, `error_description: "... reuse exceeded ..."`
 * com `revokeRefreshToken=true` + `refreshTokenMaxReuse=0`.
 */
const REFRESH_REUSE_MARKERS = ['reuse exceeded', 'session not active', 'token is not active'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private keycloak: Keycloak | null = null;
  private readonly _authenticated = signal(false);
  private readonly _userProfile = signal<UserProfile | null>(null);
  private readonly _initError = signal<string | null>(null);
  private readonly _renovacoesDoToken = signal(0);

  /**
   * Promise de refresh em voo — compartilhada entre chamadas concorrentes
   * para evitar que duas requisições disparem dois refreshes paralelos.
   * Com `refreshTokenMaxReuse=0`, o segundo refresh receberia
   * `invalid_grant: reuse exceeded` e derrubaria a sessão.
   */
  private refreshInFlight: Promise<boolean> | null = null;

  readonly authenticated = this._authenticated.asReadonly();
  readonly userProfile = this._userProfile.asReadonly();
  /**
   * Identifica a sessão corrente: muda no login, na troca de usuário e a cada renovação do token,
   * e vira `null` sem sessão. Quem guarda estado derivado da sessão reage a este sinal.
   */
  readonly sessao = computed(() =>
    this._authenticated() ? `${this._userProfile()?.id ?? ''}:${this._renovacoesDoToken()}` : null,
  );
  /**
   * Mensagem de erro quando `init()` falha (ex.: provedor OIDC indisponível).
   * `null` indica init bem-sucedido ou ainda não executado. Consumida
   * por componentes de shell para exibir fallback ao usuário.
   */
  readonly initError = this._initError.asReadonly();

  /**
   * Inicializa o cliente OIDC via adapter Keycloak. NUNCA lança — falhas são capturadas e
   * expostas via `initError()`, permitindo que o bootstrap da app
   * prossiga mesmo com o provedor de autenticação indisponível.
   * Nessa situação o app entra em modo "não autenticado"
   * e o shell pode exibir um banner de fallback.
   */
  async init(config: AuthConfig): Promise<boolean> {
    this._initError.set(null);
    try {
      const keycloak = this.criarCliente(config);
      const authenticated = await keycloak.init(opcoesDoInit());
      this.renovarAoExpirar(keycloak);
      this._authenticated.set(authenticated);
      if (authenticated) await this.loadProfile();
      return authenticated;
    } catch (error) {
      this.registrarFalhaDoInit(error);
      return false;
    }
  }

  private criarCliente(config: AuthConfig): Keycloak {
    const keycloak = this.createKeycloak(config);
    this.keycloak = keycloak;
    return keycloak;
  }

  // Renovação periódica: o keycloak-js dispara `onTokenExpired`
  // quando o access token expira. Como `refreshToken()` é serializado,
  // é seguro chamá-lo aqui sem risco de corrida com
  // refreshes disparados pelo interceptor.
  private renovarAoExpirar(keycloak: Keycloak): void {
    keycloak.onTokenExpired = () => {
      void this.refreshToken(30);
    };
  }

  private registrarFalhaDoInit(error: unknown): void {
    this.keycloak = null;
    this._authenticated.set(false);
    this._userProfile.set(null);
    this._initError.set(describeInitError(error));
  }

  /**
   * Com a rota de volta, o login retorna a ela, resolvida contra `document.baseURI` como no
   * logout; sem ela, o keycloak-js volta à URL atual, que durante uma navegação bloqueada ainda é
   * a de origem.
   */
  async login(rotaDeVolta?: string): Promise<void> {
    await this.keycloak?.login(
      rotaDeVolta
        ? { redirectUri: new URL(rotaDeVolta.replace(/^\//, ''), document.baseURI).href }
        : undefined,
    );
  }

  /**
   * Abre a atualização de perfil do provedor (ação iniciada pela aplicação), onde o titular edita o
   * que o realm permite, como o nome social. Ao concluir, o provedor devolve o usuário à página de
   * origem e o `init` troca o código por tokens novos, de onde `loadProfile` repopula o usuário sem
   * novo login.
   */
  async atualizarPerfil(): Promise<void> {
    await this.keycloak?.login({ action: 'UPDATE_PROFILE' });
  }

  /**
   * Redireciona de volta ao mount point do app (`document.baseURI`), não à
   * origem do domínio. Sob subpath (`/portal`, `/selecao`,
   * `/ingresso`, PathPrefix sem StripPrefix),
   * `window.location.origin` aponta pra raiz do host, que não
   * tem rota própria e cai no 404 do Traefik. Mesma resolução relativa já
   * usada em `silentCheckSsoRedirectUri` (init acima) — preserva a raiz em
   * standalone-compact/lab, onde `document.baseURI` já é a própria origem.
   */
  async logout(): Promise<void> {
    await this.keycloak?.logout({ redirectUri: document.baseURI });
  }

  getToken(): string | undefined {
    return this.keycloak?.token;
  }

  /**
   * Indica se o access token atual está expirado (ou expirará em menos
   * de `minValidity` segundos). Retorna `true` quando não há cliente OIDC
   * inicializado — o interceptor trata esse caso como "sem token".
   */
  isTokenExpired(minValidity = 30): boolean {
    if (!this.keycloak) return true;
    return this.keycloak.isTokenExpired(minValidity);
  }

  /**
   * Renova o access token de forma **serializada**: múltiplas chamadas
   * concorrentes compartilham a mesma Promise de rede, evitando que o
   * Keycloak rejeite o segundo refresh com `invalid_grant: reuse
   * exceeded` (`revokeRefreshToken=true`).
   *
   * Se a renovação falhar com marcador de replay/sessão morta, dispara
   * `logout()` — a sessão está comprometida e um novo login é exigido.
   */
  async refreshToken(minValidity = 30): Promise<boolean> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.runRefresh(minValidity).finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  private async runRefresh(minValidity: number): Promise<boolean> {
    try {
      const refreshed = await this.keycloak?.updateToken(minValidity);
      if (refreshed) this._renovacoesDoToken.update((total) => total + 1);
      return refreshed ?? false;
    } catch (error) {
      this._authenticated.set(false);
      if (isRefreshReuseError(error)) {
        // Replay/reuso detectado — sessão comprometida. Força logout.
        void this.logout();
      }
      return false;
    }
  }

  /**
   * @internal Ponto de extensão para testes — substituído por spies
   * que retornam duplos de Keycloak com `init()` estubado.
   */
  protected createKeycloak(config: AuthConfig): Keycloak {
    const keycloakConfig = toKeycloakConfig(config);
    return new Keycloak({
      url: keycloakConfig.url,
      realm: keycloakConfig.realm,
      clientId: keycloakConfig.clientId,
    });
  }

  /** @internal Acesso somente para testes — expõe a promise em voo. */
  _getRefreshInFlight(): Promise<boolean> | null {
    return this.refreshInFlight;
  }

  /**
   * Popula o perfil lendo direto do access token OIDC parseado
   * (`keycloak.tokenParsed`). Todos os claims necessários vêm via
   * scope `uniplus-profile` + protocol mappers configurados no realm,
   * então não é preciso chamar `loadUserProfile()` — que bateria no
   * endpoint `/account` (client separado, com CORS e permissões
   * próprias) e falharia sem configuração extra.
   */
  private async loadProfile(): Promise<void> {
    if (!this.keycloak?.authenticated) return;

    const claims = this.keycloak.tokenParsed as UniPlusTokenClaims | undefined;
    if (!claims) return;

    this._userProfile.set(perfilDosClaims(claims, this.keycloak.subject));
  }
}

function perfilDosClaims(claims: UniPlusTokenClaims, subject: string | undefined): UserProfile {
  const nomeCivil = claims.name ?? `${claims.given_name ?? ''} ${claims.family_name ?? ''}`.trim();
  return {
    id: subject ?? claims.sub ?? '',
    username: claims.preferred_username ?? '',
    email: claims.email ?? '',
    nomeCivil,
    nomeSocial: claims.nomeSocial,
    cpf: claims.cpf ?? '',
  };
}

interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

function opcoesDoInit(): KeycloakInitOptions {
  return {
    onLoad: 'check-sso',
    silentCheckSsoRedirectUri: new URL('assets/silent-check-sso.html', document.baseURI).toString(),
    checkLoginIframe: false,
  };
}

function toKeycloakConfig(config: AuthConfig): KeycloakConfig {
  const issuer = new URL(config.issuerUrl);
  const { realm, basePath } = realmEPrefixoDoCaminho(issuer.pathname);
  return {
    url: basePath ? `${issuer.origin}${basePath}` : issuer.origin,
    realm,
    clientId: config.clientId,
  };
}

const MARCADOR_DO_REALM = '/realms/';
const ISSUER_INCOMPATIVEL = 'issuerUrl OIDC incompatível com o adapter Keycloak atual: ';

/** O realm e o prefixo do caminho do emissor, que o Keycloak serve em `{prefixo}/realms/{realm}`. */
function realmEPrefixoDoCaminho(caminho: string): { realm: string; basePath: string } {
  const markerIndex = caminho.lastIndexOf(MARCADOR_DO_REALM);
  if (markerIndex < 0) throw new Error(`${ISSUER_INCOMPATIVEL}esperado path "/realms/{realm}".`);
  const restante = caminho.slice(markerIndex + MARCADOR_DO_REALM.length).replace(/\/$/, '');
  const realm = decodeURIComponent(restante);
  if (!realm || realm.includes('/'))
    throw new Error(`${ISSUER_INCOMPATIVEL}realm ausente ou inválido.`);
  return { realm, basePath: caminho.slice(0, markerIndex) };
}

function describeInitError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  const message = extractErrorDescription(error);
  if (message) return message;
  return 'Não foi possível contatar o provedor de autenticação.';
}

function isRefreshReuseError(error: unknown): boolean {
  const description = extractErrorDescription(error).toLowerCase();
  return REFRESH_REUSE_MARKERS.some((marker) => description.includes(marker));
}

const CAMPOS_DA_DESCRICAO = ['error_description', 'errorDescription', 'description', 'message'];

function extractErrorDescription(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return typeof error === 'object' ? primeiraDescricao(error, CAMPOS_DA_DESCRICAO) : '';
}
