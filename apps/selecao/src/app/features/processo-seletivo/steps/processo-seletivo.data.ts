/**
 * Um passo do wizard. `titulo` e `revisao` só são declarados quando diferem do
 * rótulo: o stepper tem largura apertada, o cabeçalho não, e o painel de
 * revisão usa o nome que o operador reconhece na lista de pendências.
 */
interface DefinicaoDePasso<Rotulo extends string = string> {
  readonly rotulo: Rotulo;
  readonly titulo?: string;
  readonly revisao?: string;
}

/**
 * Os passos na ordem em que são apresentados. Única fonte da ordem: o número
 * exibido é a posição aqui, e nenhum componente de passo declara a própria.
 */
const DEFINICOES = [
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
  // Penúltimo porque é a superfície de COLETA de tudo que veio antes: bônus, desempate,
  // eliminação e atendimento especializado podem depender de um fato do candidato, e o domínio
  // de campos como a condição de atendimento sai da oferta declarada no passo anterior.
  // Continua, como sempre esteve, depois do Cronograma — a política que ancora a apuração de
  // idade pode apontar o início ou o fim de uma fase, e parte dos campos sai dos fatos que as
  // exigências documentais citam.
  {
    rotulo: 'Formulário',
    titulo: 'Formulário de inscrição',
    revisao: 'Formulário de inscrição',
  },
  { rotulo: 'Revisão e publicação' },
] as const satisfies readonly DefinicaoDePasso[];

/** Rótulo de um passo existente: o compilador recusa o que não está em DEFINICOES. */
export type RotuloDePasso = (typeof DEFINICOES)[number]['rotulo'];

function comoPasso(passo: DefinicaoDePasso<RotuloDePasso>) {
  return {
    rotulo: passo.rotulo,
    titulo: passo.titulo ?? passo.rotulo,
    revisao: passo.revisao ?? passo.titulo ?? passo.rotulo,
  };
}

export const PASSOS = DEFINICOES.map(comoPasso);

/** Rótulos curtos do stepper lateral. */
export const STEP_LABELS = PASSOS.map((passo) => passo.rotulo);

/** O painel de revisão lista os passos anteriores, não a si mesmo. */
export const REVIEW_NAMES = PASSOS.slice(0, -1).map((passo) => passo.revisao);
