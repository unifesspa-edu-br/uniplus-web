export { AuthService } from './services/auth.service';
export { UserContextService } from './services/user-context.service';
export { provideAuth } from './providers/auth.provider';
export { AUTH_ALLOWED_URLS, AUTH_CONFIG } from './tokens/auth.tokens';
export { LoginErrorCode, classifyLoginError } from './models/login-error.model';
export type { AuthConfig } from './models/auth-config.model';
export type { LoginErrorDetails } from './models/login-error.model';
export type { UniPlusTokenClaims } from './models/token-claims.model';
export type { UserProfile, UserRole } from './models/user.model';
