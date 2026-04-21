// Configuração de PRODUÇÃO — ponte até a implementação de runtime config via
// provideAppInitializer + K8s ConfigMap (Opção C, issue uniplus-web#84).
//
// ATENÇÃO: este arquivo NÃO contém valores reais. Em produção, fornecer via:
//   - CI/CD fileReplacements com valores corretos por ambiente, OU
//   - Substituição no pipeline (sed, envsubst) antes do deploy.
//
// Se estes placeholders chegarem ao browser, a app falhará imediatamente
// com erro de URL inválida — comportamento intencional para tornar o
// problema visível em vez de silencioso.
export const environment = {
  production: true,
  apiUrl: 'PLACEHOLDER_API_URL',
  keycloak: {
    url: 'PLACEHOLDER_KEYCLOAK_URL',
    realm: 'unifesspa',
    clientId: 'selecao-web',
  },
};
