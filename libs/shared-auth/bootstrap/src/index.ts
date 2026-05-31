export { AuthService } from '../../src/lib/services/auth.service';
export { UserContextService } from '../../src/lib/services/user-context.service';
export { provideAuth } from '../../src/lib/providers/auth.provider';
export { AUTH_ALLOWED_URLS, AUTH_CONFIG } from '../../src/lib/tokens/auth.tokens';
export { LoginErrorCode, classifyLoginError } from '../../src/lib/models/login-error.model';
export type { AuthConfig } from '../../src/lib/models/auth-config.model';
export type { LoginErrorDetails } from '../../src/lib/models/login-error.model';
export type { UniPlusTokenClaims } from '../../src/lib/models/token-claims.model';
export type { UserProfile, UserRole } from '../../src/lib/models/user.model';
