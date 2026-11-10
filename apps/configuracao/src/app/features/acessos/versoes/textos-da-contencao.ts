/** As ações de contenção do perfil que pedem um motivo. */
export type AcaoDaContencao = 'desativar' | 'reativar';

export interface TextosDaContencao {
  readonly titulo: string;
  readonly confirmar: string;
  readonly ajuda: string;
  readonly sucesso: string;
  readonly variante: 'danger' | 'primary';
}

export const TEXTOS_DA_CONTENCAO: Readonly<Record<AcaoDaContencao, TextosDaContencao>> = {
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
