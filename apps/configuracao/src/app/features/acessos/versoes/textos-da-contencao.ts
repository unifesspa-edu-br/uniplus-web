/** As ações de contenção do perfil que pedem um motivo. */
export type AcaoDaContencao = 'suspender' | 'desativar' | 'reativar';

export interface TextosDaContencao {
  readonly titulo: string;
  readonly confirmar: string;
  readonly ajuda: string;
  readonly sucesso: string;
  readonly variante: 'danger' | 'primary';
}

export const TEXTOS_DA_CONTENCAO: Readonly<Record<AcaoDaContencao, TextosDaContencao>> = {
  suspender: {
    titulo: 'Suspender o perfil',
    confirmar: 'Suspender perfil',
    ajuda:
      'Nenhuma concessão do perfil dá acesso até a retomada, que exige outra pessoa. As concessões não são revogadas. O motivo fica na trilha e não vai nos avisos.',
    sucesso: 'Perfil suspenso',
    variante: 'danger',
  },
  desativar: {
    titulo: 'Desativar o perfil',
    confirmar: 'Desativar perfil',
    ajuda:
      'O perfil deixa de aceitar pedidos e versões novas; as concessões existentes continuam valendo. O motivo fica na trilha.',
    sucesso: 'Perfil desativado',
    variante: 'danger',
  },
  reativar: {
    titulo: 'Reativar o perfil',
    confirmar: 'Reativar perfil',
    ajuda:
      'Outra pessoa da gestão de acessos, que não desativou o perfil, o reativa. O motivo fica na trilha.',
    sucesso: 'Perfil reativado',
    variante: 'primary',
  },
};
