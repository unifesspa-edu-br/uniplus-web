// Environment padrão — valores de desenvolvimento local.
// Em produção este arquivo é substituído por environment.prod.ts via fileReplacements.
// Estratégia final: runtime config via provideAppInitializer + K8s ConfigMap (Option C).
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api/v1',
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'unifesspa',
    clientId: 'ingresso-web',
  },
};
