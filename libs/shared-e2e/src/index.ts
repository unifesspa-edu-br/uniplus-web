export { resetPasswords, keycloakLogin, keycloakLogout, expectUserInHeader } from './lib/keycloak-login';
export { createGlobalSetup, setupKeycloakAuth } from './lib/keycloak-auth-fixture';
export type { KeycloakAuthSetupOptions } from './lib/keycloak-auth-fixture';
export {
  runAxeWcagAA,
  runAxeWcagAAAApplicable,
  WCAG_A_AA_TAGS,
  WCAG_AAA_APPLICABLE_TAGS,
} from './lib/a11y';
export type { RunAxeOptions } from './lib/a11y';
export { assertAaaVisualContract } from './lib/a11y-contrato-visual';
export type { AaaVisualContractOptions } from './lib/a11y-contrato-visual';
export { assertDocumentoSemRolagemVertical, assertReflowContract } from './lib/a11y-reflow';
export { assertTextSpacingResilience } from './lib/a11y-espacamento-de-texto';
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
  prepararAcessosDaSimulacao,
  tokenDaPersona,
} from './lib/backend-real';
export type { RespostaDaApi } from './lib/backend-real';
export { lerTopicoDoKafka } from './lib/kafka-real';
