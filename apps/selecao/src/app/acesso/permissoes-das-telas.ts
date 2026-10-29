import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import type { CodigoDePermissao } from '@uniplus/shared-auth/bootstrap';

const { selecao } = PERMISSAO;

/**
 * Permissões que abrem cada tela do app, por caminho de rota (basta uma). As rotas e a entrada da
 * raiz leem daqui, para que o destino da raiz seja sempre uma tela que a guarda da rota aceita.
 * A ordem é a da primeira tela oferecida a quem entra sem destino.
 *
 * `homologacao` e `classificacao` usam `acompanhar` porque o catálogo não tem permissão própria
 * para elas.
 */
export const PERMISSOES_DAS_TELAS = {
  dashboard: [selecao.processosAcompanhar],
  'processo-seletivo': [selecao.processosConfigurar],
  inscricoes: [selecao.inscricoesConsultar],
  homologacao: [selecao.processosAcompanhar],
  notas: [selecao.notasEnemImportar],
  classificacao: [selecao.processosAcompanhar],
} as const satisfies Record<string, readonly CodigoDePermissao[]>;

export type CaminhoDeTela = keyof typeof PERMISSOES_DAS_TELAS;
