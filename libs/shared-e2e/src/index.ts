export { resetPasswords, keycloakLogin, keycloakLogout, expectUserInHeader } from './lib/keycloak-login';
export { createGlobalSetup, setupKeycloakAuth } from './lib/keycloak-auth-fixture';
export type { KeycloakAuthSetupOptions } from './lib/keycloak-auth-fixture';
export {
  assertAaaVisualContract,
  assertDocumentoSemRolagemVertical,
  assertReflowContract,
  assertTextSpacingResilience,
  runAxeWcagAA,
  runAxeWcagAAAApplicable,
  WCAG_A_AA_TAGS,
  WCAG_AAA_APPLICABLE_TAGS,
} from './lib/a11y';
export type { AaaVisualContractOptions, RunAxeOptions } from './lib/a11y';
export { falharPermissoesEfetivas, mockPermissoesEfetivas } from './lib/permissoes-efetivas';
export {
  ACESSOS_DA_SIMULACAO,
  acharNaListagem,
  aprovarCatalogoInicial,
  API_URL,
  GESTOR_DE_ACESSOS,
  PROTECAO_DE_DADOS,
  SEGUNDO_GESTOR_DE_ACESSOS,
  SENHA_DAS_PERSONAS,
  UNIDADE_DO_CERTAME,
  chamarApi,
  entrarComoPersona,
  garantirConcessao,
  garantirPerfil,
  identidadeDoToken,
  lerTopicoDoKafka,
  prepararAcessosDaSimulacao,
  tokenDaPersona,
} from './lib/backend-real';
export type { RespostaDaApi } from './lib/backend-real';
