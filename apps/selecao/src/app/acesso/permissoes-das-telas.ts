import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import type { CodigoDePermissao } from '@uniplus/shared-auth/bootstrap';

const { selecao } = PERMISSAO;

/**
 * Permissões que abrem cada tela protegida do app, por caminho de rota (basta uma). As rotas e o
 * menu leem daqui, para que o menu só ofereça o que a guarda da rota aceita. O painel
 * (`/dashboard`) não está aqui: basta a sessão, e ela não concede acesso a dados.
 *
 * `processo-seletivo` abre a lista de processos também a quem só consulta inscrições: ler o processo
 * publicado é aberto, e a lista leva às inscrições dele. As telas que configuram exigem
 * `processosConfigurar`, na rota de cada uma.
 *
 * `homologacao` e `classificacao` usam `acompanhar` porque o catálogo não tem permissão própria
 * para elas.
 */
export const PERMISSOES_DAS_TELAS = {
  'processo-seletivo': [selecao.processosConfigurar, selecao.inscricoesConsultar],
  homologacao: [selecao.processosAcompanhar],
  notas: [selecao.notasEnemImportar],
  classificacao: [selecao.processosAcompanhar],
} as const satisfies Record<string, readonly CodigoDePermissao[]>;

/** Permissões que abrem as inscrições de um processo, em `/processo-seletivo/:id/inscricoes`. */
export const PERMISSOES_DAS_INSCRICOES_DO_PROCESSO = [
  selecao.inscricoesConsultar,
] as const satisfies readonly CodigoDePermissao[];

/** Permissão que abre o comprovante de uma inscrição do processo, em `…/inscricoes/:inscricaoId/comprovantes/:numero`. */
export const PERMISSOES_DO_COMPROVANTE_DA_INSCRICAO = [
  selecao.inscricoesEmitirComprovante,
] as const satisfies readonly CodigoDePermissao[];

export type CaminhoDeTela = keyof typeof PERMISSOES_DAS_TELAS;
