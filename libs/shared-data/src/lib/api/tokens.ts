/**
 * Os tokens de base path dos módulos, sem os clientes. Quem roda no carregamento inicial importa daqui:
 * importar do barrel de um módulo leva junto o cliente que uma rota lazy usa.
 */
export { CONFIGURACAO_BASE_PATH } from './configuracao/tokens';
export { GEO_BASE_PATH } from './geo/tokens';
export { INGRESSO_BASE_PATH } from './ingresso/tokens';
export { ORGANIZACAO_BASE_PATH } from './organizacao/tokens';
export { PUBLICACOES_BASE_PATH } from './publicacoes/tokens';
export { SELECAO_BASE_PATH } from './selecao/tokens';
