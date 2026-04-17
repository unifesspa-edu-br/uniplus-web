// Environment padrão — valores de desenvolvimento local.
// Para produção, substituir via deploy (K8s ConfigMap, env var injection
// ou fileReplacements quando o suporte no @angular/build for resolvido).
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api/v1',
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'unifesspa',
    clientId: 'ingresso-web',
  },
};
