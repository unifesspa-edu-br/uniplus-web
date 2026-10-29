// Services
export { AuthService } from './services/auth.service';
export { UserContextService } from './services/user-context.service';
export { PermissoesService } from './services/permissoes.service';
export type { EstadoDasPermissoes, PermissaoEfetiva } from './services/permissoes.service';
export { PERMISSAO } from './permissoes/catalogo';
export type { CodigoDePermissao, ModuloDePermissao } from './permissoes/catalogo';

// Guards
export { authGuard } from './guards/auth.guard';
export { roleGuard } from './guards/role.guard';
export { permissaoGuard, permissaoNoModuloGuard } from './guards/permissao.guard';

// Interceptors
export { tokenInterceptor } from './interceptors/token.interceptor';
export { authErrorInterceptor } from './interceptors/auth-error.interceptor';

// Models
export type { UserProfile } from './models/user.model';
export type { UserRole } from './models/user.model';
export type { AuthConfig } from './models/auth-config.model';

// Providers
export { provideAuth } from './providers/auth.provider';

// Tokens
export { AUTH_ALLOWED_URLS, AUTH_CONFIG, AUTORIZACAO_BASE_PATH, PROFILE_BASE_PATH } from './tokens/auth.tokens';

// Components
export { AuthErrorBannerComponent } from './components/auth-error-banner.component';
export { AccessDeniedComponent } from './components/access-denied.component';
export { LoginErrorBannerComponent } from './components/login-error-banner.component';
export { UserHeaderInfoComponent } from './components/user-header-info.component';
export { TemPermissaoDirective } from './components/tem-permissao.directive';

// Models
export { LoginErrorCode, classifyLoginError } from './models/login-error.model';
export type { LoginErrorDetails } from './models/login-error.model';
export type { UniPlusTokenClaims } from './models/token-claims.model';
