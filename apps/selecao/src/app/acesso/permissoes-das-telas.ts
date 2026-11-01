import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import type { CodigoDePermissao } from '@uniplus/shared-auth/bootstrap';

const { selecao } = PERMISSAO;

/**
 * Permissões que abrem cada tela do app, por caminho de rota (basta uma). As rotas e a entrada da
 * raiz leem daqui, para que o destino da raiz seja sempre uma tela que a guarda da rota aceita.
 * A ordem é a da primeira tela oferecida a quem entra sem destino.
 *
 * `processo-seletivo` abre a lista de processos também a quem só consulta inscrições: ler o processo
 * publicado é aberto, e a lista leva às inscrições dele. As telas que configuram exigem
 * `processosConfigurar`, na rota de cada uma.
 *
 * `homologacao` e `classificacao` usam `acompanhar` porque o catálogo não tem permissão própria
 * para elas.
 */
export const PERMISSOES_DAS_TELAS = {
  dashboard: [selecao.processosAcompanhar],
  'processo-seletivo': [selecao.processosConfigurar, selecao.inscricoesConsultar],
  homologacao: [selecao.processosAcompanhar],
  notas: [selecao.notasEnemImportar],
  classificacao: [selecao.processosAcompanhar],
} as const satisfies Record<string, readonly CodigoDePermissao[]>;

/** Permissões que abrem as inscrições de um processo, em `/processo-seletivo/:id/inscricoes`. */
export const PERMISSOES_DAS_INSCRICOES_DO_PROCESSO = [
  selecao.inscricoesConsultar,
] as const satisfies readonly CodigoDePermissao[];

export type CaminhoDeTela = keyof typeof PERMISSOES_DAS_TELAS;
