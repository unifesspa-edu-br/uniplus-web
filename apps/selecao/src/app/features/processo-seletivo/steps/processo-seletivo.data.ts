/**
 * Um passo do wizard. `titulo` e `revisao` só são declarados quando diferem do
 * rótulo: o stepper tem largura apertada, o cabeçalho não, e o painel de
 * revisão usa o nome que o operador reconhece na lista de pendências.
 */
interface DefinicaoDePasso {
  readonly rotulo: string;
  readonly titulo?: string;
  readonly revisao?: string;
}

/**
 * Os passos na ordem em que são apresentados. Única fonte da ordem: o número
 * exibido é a posição aqui, e nenhum componente de passo declara a própria.
 */
const DEFINICOES: readonly DefinicaoDePasso[] = [
  { rotulo: 'Tipo do processo', revisao: 'Tipo do processo seletivo' },
  { rotulo: 'Identificação' },
  { rotulo: 'Pagamento', titulo: 'Taxa de inscrição e isenção', revisao: 'Taxa de inscrição' },
  { rotulo: 'Vagas' },
  {
    rotulo: 'Cronograma',
    titulo: 'Cronograma, fases e etapas',
    revisao: 'Cronograma e etapas',
  },
  { rotulo: 'Fórmula e precisão', revisao: 'Fórmula de classificação' },
  { rotulo: 'Bônus', titulo: 'Bônus (opcional)' },
  { rotulo: 'Desempate', revisao: 'Critérios de desempate' },
  { rotulo: 'Eliminação', revisao: 'Regras de eliminação' },
  { rotulo: 'Atend. especial', titulo: 'Atendimento especializado' },
  { rotulo: 'Revisão e publicação' },
];

export const PASSOS = DEFINICOES.map((passo) => ({
  rotulo: passo.rotulo,
  titulo: passo.titulo ?? passo.rotulo,
  revisao: passo.revisao ?? passo.titulo ?? passo.rotulo,
}));

/** Rótulos curtos do stepper lateral. */
export const STEP_LABELS = PASSOS.map((passo) => passo.rotulo);

/** O painel de revisão lista os passos anteriores, não a si mesmo. */
export const REVIEW_NAMES = PASSOS.slice(0, -1).map((passo) => passo.revisao);
