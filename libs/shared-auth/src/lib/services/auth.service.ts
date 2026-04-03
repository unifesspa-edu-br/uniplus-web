import { Injectable, signal, computed } from '@angular/core';
import Keycloak from 'keycloak-js';
import { AuthConfig } from '../models/auth-config.model';
import { UserProfile } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private keycloak: Keycloak | null = null;
  private readonly _authenticated = signal(false);
  private readonly _userProfile = signal<UserProfile | null>(null);

  readonly authenticated = this._authenticated.asReadonly();
  readonly userProfile = this._userProfile.asReadonly();
  readonly roles = computed(() => this._userProfile()?.roles ?? []);

  async init(config: AuthConfig): Promise<boolean> {
    this.keycloak = new Keycloak({
      url: config.keycloakUrl,
      realm: config.realm,
      clientId: config.clientId,
    });

    const authenticated = await this.keycloak.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
      checkLoginIframe: false,
    });

    this._authenticated.set(authenticated);

    if (authenticated) {
      await this.loadProfile();
    }

    return authenticated;
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

  async refreshToken(minValidity = 30): Promise<boolean> {
    try {
      const refreshed = await this.keycloak?.updateToken(minValidity);
      return refreshed ?? false;
    } catch {
      this._authenticated.set(false);
      return false;
    }
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }

  private async loadProfile(): Promise<void> {
    if (!this.keycloak?.authenticated) return;

    const profile = await this.keycloak.loadUserProfile();
    const realmRoles = this.keycloak.realmAccess?.roles ?? [];
    const attrs = profile.attributes as Record<string, string[]> | undefined;

    this._userProfile.set({
      id: this.keycloak.subject ?? '',
      username: profile.username ?? '',
      email: profile.email ?? '',
      nomeCivil: `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim(),
      nomeSocial: attrs?.['nomeSocial']?.[0],
      cpf: attrs?.['cpf']?.[0] ?? '',
      roles: realmRoles,
    });
  }
}
