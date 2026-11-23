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
  { rotulo: 'Fator de Atenuação', titulo: 'Fator de Atenuação das Desigualdades de Acesso' },
  { rotulo: 'Desempate', revisao: 'Critérios de desempate' },
  { rotulo: 'Eliminação', revisao: 'Regras de eliminação' },
  { rotulo: 'Atend. especial', titulo: 'Atendimento especializado' },
  { rotulo: 'Prova presencial' },
  // Penúltimo porque é a superfície de COLETA de tudo que veio antes: Fator de Atenuação, desempate,
  // eliminação e atendimento especializado podem depender de um fato do candidato, e o domínio
  // de campos como a condição de atendimento sai da oferta declarada no passo anterior.
  // Continua, como sempre esteve, depois do Cronograma — a política que ancora a apuração de
  // idade pode apontar o início ou o fim de uma fase, e parte dos campos sai dos fatos que as
  // exigências documentais citam.
  { rotulo: 'Formulários' },
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
export const ROTULOS_DOS_PASSOS = PASSOS.map((passo) => passo.rotulo);

/** O painel de revisão lista os passos anteriores, não a si mesmo. */
export const REVIEW_NAMES = PASSOS.slice(0, -1).map((passo) => passo.revisao);

/** Posição do passo em que o formulário de inscrição é montado, derivada da ordem única dos passos. */
export const PASSO_FORMULARIO = ROTULOS_DOS_PASSOS.indexOf('Formulários');

/**
 * O nome que o menu e o cabeçalho mostram para o passo, dado pelo rótulo. O rótulo é tipado
 * pela própria lista de passos, então um passo inexistente é defeito de programação.
 */
function tituloDoPassoPeloRotulo(rotulo: RotuloDePasso): string {
  const passo = PASSOS.find((candidato) => candidato.rotulo === rotulo);
  if (passo === undefined) throw new Error(`O passo "${rotulo}" não existe no wizard.`);
  return passo.titulo;
}

/** O nome do passo da fórmula nas mensagens que mandam a pessoa até ele. */
export const NOME_DO_PASSO_DA_FORMULA = tituloDoPassoPeloRotulo('Fórmula e precisão');
