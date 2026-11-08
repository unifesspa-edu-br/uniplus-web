/**
 * Senha de todos os usuários locais do realm, definida por `setup-keycloak-dev.sh`. Fica fora do
 * módulo de backend real para os projetos de interface a usarem sem puxar a API nem o Kafka.
 */
export const SENHA_DAS_PERSONAS = process.env['E2E_SENHA_DAS_PERSONAS'] ?? 'Uni+Teste26';
