import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { UserRole } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly authService = inject(AuthService);

  readonly user = this.authService.userProfile;
  readonly displayName = computed(() => {
    const profile = this.user();
    if (!profile) return '';
    return profile.nomeSocial?.trim() || profile.nomeCivil;
  });
  readonly isAuthenticated = this.authService.authenticated;

  hasRole(role: UserRole): boolean {
    return this.authService.hasRole(role);
  }

  hasAnyRole(...roles: UserRole[]): boolean {
    return roles.some((role) => this.authService.hasRole(role));
  }
}
