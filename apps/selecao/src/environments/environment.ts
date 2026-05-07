// Environment padrão — valores de desenvolvimento local.
// Em produção este arquivo é substituído por environment.prod.ts via fileReplacements.
// Estratégia final: runtime config via provideAppInitializer + K8s ConfigMap (Option C).
export const environment = {
  production: false,
  // Origin absoluta da uniplus-api (sem sufixo /api/v1). O Contrato V1
  // declara paths absolutos a partir do origin (`/api/editais` etc.) e o
  // versionamento per-resource é feito via vendor MIME (ADR-0028 do
  // `uniplus-api`), não via prefixo de URL.
  apiUrl: 'http://localhost:5000',
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'unifesspa',
    clientId: 'selecao-web',
  },
};
