export { AuthService } from '../../src/lib/services/auth.service';
export { UserContextService } from '../../src/lib/services/user-context.service';
export { provideAuth } from '../../src/lib/providers/auth.provider';
export { AUTH_ALLOWED_URLS, AUTH_CONFIG, AUTORIZACAO_BASE_PATH, PROFILE_BASE_PATH } from '../../src/lib/tokens/auth.tokens';
export { LoginErrorCode, classifyLoginError } from '../../src/lib/models/login-error.model';
export type { AuthConfig } from '../../src/lib/models/auth-config.model';
export type { LoginErrorDetails } from '../../src/lib/models/login-error.model';
export type { UniPlusTokenClaims } from '../../src/lib/models/token-claims.model';
export type { UserProfile, UserRole } from '../../src/lib/models/user.model';
export { DOMAIN_ROLES, ROLE_LABELS } from '../../src/lib/models/user.model';
export type { PerfilConcedido } from '../../src/lib/models/perfil-concedido.model';
export {
  escopoDoPerfil,
  prazoDoPerfil,
  rotuloDoPerfil,
} from '../../src/lib/models/perfil-concedido.model';
export { PermissoesService } from '../../src/lib/services/permissoes.service';
export { PerfisDeAcessoService } from '../../src/lib/services/perfis-de-acesso.service';
export type { EstadoDosPerfis } from '../../src/lib/services/perfis-de-acesso.service';
export type {
  EstadoDasPermissoes,
  PermissaoEfetiva,
} from '../../src/lib/services/permissoes.service';
export { PERMISSAO } from '../../src/lib/permissoes/catalogo';
export type { CodigoDePermissao, ModuloDePermissao } from '../../src/lib/permissoes/catalogo';
