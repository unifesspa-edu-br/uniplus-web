import { Injectable, signal, computed } from '@angular/core';
import Keycloak from 'keycloak-js';
import { AuthConfig } from '../models/auth-config.model';
import { UserProfile } from '../models/user.model';
import { UniPlusTokenClaims } from '../models/token-claims.model';

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

  /**
   * Promise de refresh em voo — compartilhada entre chamadas concorrentes
   * para evitar que duas requisições disparem dois refreshes paralelos.
   * Com `refreshTokenMaxReuse=0`, o segundo refresh receberia
   * `invalid_grant: reuse exceeded` e derrubaria a sessão.
   */
  private refreshInFlight: Promise<boolean> | null = null;

  readonly authenticated = this._authenticated.asReadonly();
  readonly userProfile = this._userProfile.asReadonly();
  readonly roles = computed(() => this._userProfile()?.roles ?? []);
  /**
   * Mensagem de erro quando `init()` falha (ex.: Keycloak indisponível).
   * `null` indica init bem-sucedido ou ainda não executado. Consumida
   * por componentes de shell para exibir fallback ao usuário.
   */
  readonly initError = this._initError.asReadonly();

  /**
   * Inicializa o Keycloak. NUNCA lança — falhas são capturadas e
   * expostas via `initError()`, permitindo que o bootstrap da app
   * prossiga mesmo com o provedor de autenticação indisponível
   * (finding I7). Nessa situação o app entra em modo "não autenticado"
   * e o shell pode exibir um banner de fallback.
   */
  async init(config: AuthConfig): Promise<boolean> {
    this._initError.set(null);
    try {
      this.keycloak = this.createKeycloak(config);

      const authenticated = await this.keycloak.init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
        checkLoginIframe: false,
      });

      // Renovação periódica: o keycloak-js dispara `onTokenExpired`
      // quando o access token expira. Como `refreshToken()` é serializado
      // (Task #61), é seguro chamá-lo aqui sem risco de corrida com
      // refreshes disparados pelo interceptor.
      this.keycloak.onTokenExpired = () => {
        void this.refreshToken(30);
      };

      this._authenticated.set(authenticated);

      if (authenticated) {
        await this.loadProfile();
      }

      return authenticated;
    } catch (error) {
      this.keycloak = null;
      this._authenticated.set(false);
      this._userProfile.set(null);
      this._initError.set(describeInitError(error));
      return false;
    }
  }

  async login(): Promise<void> {
    await this.keycloak?.login();
  }

  async logout(): Promise<void> {
    await this.keycloak?.logout({ redirectUri: window.location.origin });
  }

  getToken(): string | undefined {
    return this.keycloak?.token;
  }

  /**
   * Indica se o access token atual está expirado (ou expirará em menos
   * de `minValidity` segundos). Retorna `true` quando não há Keycloak
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
   * exceeded` (Story uniplus-api#67 / PR #84 — `revokeRefreshToken=true`).
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

  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }

  /**
   * @internal Ponto de extensão para testes — substituído por spies
   * que retornam duplos de Keycloak com `init()` estubado.
   */
  protected createKeycloak(config: AuthConfig): Keycloak {
    return new Keycloak({
      url: config.keycloakUrl,
      realm: config.realm,
      clientId: config.clientId,
    });
  }

  /** @internal Acesso somente para testes — expõe a promise em voo. */
  _getRefreshInFlight(): Promise<boolean> | null {
    return this.refreshInFlight;
  }

  /**
   * Popula o perfil lendo direto do access token parseado
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

    const nomeCivil =
      claims.name ?? `${claims.given_name ?? ''} ${claims.family_name ?? ''}`.trim();

    this._userProfile.set({
      id: this.keycloak.subject ?? claims.sub ?? '',
      username: claims.preferred_username ?? '',
      email: claims.email ?? '',
      nomeCivil,
      nomeSocial: claims.nomeSocial,
      cpf: claims.cpf ?? '',
      roles: claims.realm_access?.roles ?? [],
    });
  }
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

function extractErrorDescription(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error !== 'object') return '';

  const candidates: unknown[] = [
    (error as { error_description?: unknown }).error_description,
    (error as { errorDescription?: unknown }).errorDescription,
    (error as { description?: unknown }).description,
    (error as { message?: unknown }).message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return '';
}
