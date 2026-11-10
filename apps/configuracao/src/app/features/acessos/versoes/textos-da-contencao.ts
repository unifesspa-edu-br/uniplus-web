/** As ações de contenção do perfil que pedem um motivo. */
export type AcaoDaContencao =
  | 'suspender'
  | 'retomar_gestao_de_acessos'
  | 'retomar_protecao_de_dados'
  | 'desativar'
  | 'reativar';

export interface TextosDaContencao {
  readonly titulo: string;
  readonly confirmar: string;
  readonly ajuda: string;
  readonly sucesso: string;
  readonly variante: 'danger' | 'primary';
}

const AJUDA_DA_RETOMADA =
  'Quem suspendeu o perfil não decide a retomada, e cada etapa exigida é decidida por uma pessoa diferente. As concessões voltam a valer quando todas as etapas estiverem decididas. O motivo fica na trilha.';

export const TEXTOS_DA_CONTENCAO: Readonly<Record<AcaoDaContencao, TextosDaContencao>> = {
  suspender: {
    titulo: 'Suspender o perfil',
    confirmar: 'Suspender perfil',
    ajuda:
      'Nenhuma concessão do perfil dá acesso até a retomada, que exige outra pessoa. As concessões não são revogadas. O motivo fica na trilha e não vai nos avisos.',
    sucesso: 'Perfil suspenso',
    variante: 'danger',
  },
  retomar_gestao_de_acessos: {
    titulo: 'Retomar o perfil: gestão de acessos',
    confirmar: 'Decidir a retomada',
    ajuda: AJUDA_DA_RETOMADA,
    sucesso: 'Etapa da retomada decidida',
    variante: 'primary',
  },
  retomar_protecao_de_dados: {
    titulo: 'Retomar o perfil: proteção de dados',
    confirmar: 'Decidir a retomada',
    ajuda: AJUDA_DA_RETOMADA,
    sucesso: 'Etapa da retomada decidida',
    variante: 'primary',
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
