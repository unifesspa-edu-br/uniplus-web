export {
  resetPasswords,
  keycloakLogin,
  keycloakLogout,
  expectUserInHeader,
} from './lib/keycloak-login';
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
  acharNaListagem,
  API_URL,
  GESTOR_DE_ACESSOS,
  REPRESENTANTE_DO_CONTROLADOR,
  SEGUNDO_GESTOR_DE_ACESSOS,
  chamarApi,
  entrarComoPersona,
  identidadeDoToken,
  tokenDaPersona,
} from './lib/backend-real';
export {
  AUTOR_DAS_VERSOES,
  aguardarDocumentoVerificado,
  aprovarVersaoPendente,
  codigosEmVigor,
  decidirVersao,
  diferencaDeComposicao,
  enviarDocumentoDaVersao,
  garantirPerfil,
  lerPerfil,
  proporVersao,
} from './lib/versoes-de-perfil-reais';
export { garantirConcessao } from './lib/concessoes-reais';
export { PDF_MINIMO, enviarPelaUrlAssinada } from './lib/envio-de-arquivo';
export { SENHA_DAS_PERSONAS } from './lib/credenciais';
export type { RespostaDaApi } from './lib/backend-real';
export {
  ACESSOS_DA_SIMULACAO,
  aprovarCatalogoInicial,
  garantirOperadorDoRoteiro,
  OPERADOR_DO_ROTEIRO,
  prepararAcessosDaSimulacao,
  unidadeDoCertame,
} from './lib/simulacao-real';
export { lerTopicoDoKafka } from './lib/kafka-real';
