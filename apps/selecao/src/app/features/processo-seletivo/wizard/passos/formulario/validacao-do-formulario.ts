import type { WizardDraft } from '../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { textoDaAplicacaoEmAberto } from './modelo-de-formulario';
import { ehDaIsencao, type FaseQueRespondeFormulario } from './obrigatoriedade-na-fase';
import { problemasDoFormulario } from './problemas-do-formulario';

/** O que a conferência do passo sabe de cada aba. */
export interface AbaParaConferir {
  readonly codigo: string;
  /** Como as mensagens nomeiam o formulário, já entre aspas. */
  readonly nome: string;
  /** A fase escolhida, ou vazio. */
  readonly fase: string;
  readonly nomeDaFase: string | null;
  readonly faseEscolhida: FaseQueRespondeFormulario | undefined;
  readonly fases: readonly unknown[];
  readonly obrigatorio: boolean;
  readonly numeroInvalido: boolean;
}

/** O que impede o passo de seguir, além de cada formulário em si. */
export interface FormularioParaConferir {
  readonly abas: readonly AbaParaConferir[];
  /** As fases do cronograma, com as marcas que dizem o que cada uma é. */
  readonly fasesDoCronograma: readonly FaseQueRespondeFormulario[];
  readonly draft: WizardDraft;
  readonly aplicacoesEmAberto: ReturnType<ProcessoSeletivoStore['aplicacoesDeModeloEmAberto']>;
  /** Os campos que o formulário pergunta e o atendimento especializado não dá com o que escolher. */
  readonly camposSemValoresOfertados: readonly string[];
}

/** As mensagens de recusa do passo, na ordem em que o operador as corrige. */
export function mensagensDoFormulario(entrada: FormularioParaConferir): string[] {
  const { abas, draft } = entrada;
  return [
    ...mensagensDasAbas(abas, draft.pagamento.cobra === true),
    ...mensagensDaInscricao(abas, entrada.fasesDoCronograma),
    ...mensagensDeFaseRepetida(abas),
    ...mensagensDasAplicacoesEmAberto(entrada.aplicacoesEmAberto),
    ...abas.filter((aba) => aba.numeroInvalido).map(mensagemDoNumeroInvalido),
    ...problemasDoRascunho(draft),
    ...entrada.camposSemValoresOfertados.map(mensagemDoCampoSemValoresOfertados),
  ];
}

function problemasDoRascunho(draft: WizardDraft): readonly string[] {
  const fasesVivas = new Set(draft.cronograma.fases.map((fase) => fase.codigo));
  return problemasDoFormulario(draft.formulario, draft.documentos, fasesVivas);
}

function mensagensDasAplicacoesEmAberto(
  aplicacoes: FormularioParaConferir['aplicacoesEmAberto'],
): string[] {
  return [...aplicacoes].map(([codigo, emAberto]) =>
    textoDaAplicacaoEmAberto(`formulário ${codigo}`, emAberto),
  );
}

function mensagemDoNumeroInvalido(aba: AbaParaConferir): string {
  return `O formulário ${aba.nome} tem campos que não são números: veja os campos marcados na aba dele.`;
}

function mensagemDoCampoSemValoresOfertados(campo: string): string {
  return `O formulário pergunta ${campo} ao candidato, e a oferta de atendimento especializado não declara nenhum valor para escolher. Declare ao menos um em "Atend. especial", ou retire o campo daqui.`;
}

/** A fase que falta em cada aba e o pedido de isenção, que só existe com cobrança de taxa. */
function mensagensDasAbas(abas: readonly AbaParaConferir[], cobraTaxa: boolean): string[] {
  return [
    ...abas.filter((aba) => aba.fase === '').map(mensagemDaFaseQueFalta),
    ...abas
      .filter((aba) => !cobraTaxa && ehDaIsencao(aba, aba.faseEscolhida))
      .map(
        (aba) =>
          `O processo não cobra taxa de inscrição, e o formulário ${aba.nome} é o pedido de isenção, que só existe quando há cobrança. Remova o formulário, ou volte a cobrar a taxa em "Pagamento".`,
      ),
  ];
}

/** Por que o formulário não tem fase: o cronograma não tem fase com lugar para ele, ou o operador ainda não escolheu. */
function mensagemDaFaseQueFalta(aba: AbaParaConferir): string {
  return aba.fases.length === 0
    ? `O cronograma não tem fase com lugar para o formulário ${aba.nome}. Acrescente a fase no passo Cronograma, ou remova o formulário.`
    : `Escolha em que fase do cronograma o formulário ${aba.nome} é respondido.`;
}

const SEM_FASE_DE_INSCRICAO =
  'O cronograma não tem fase em que a inscrição é respondida. Acrescente a fase de inscrição no passo Cronograma.';
const SEM_FORMULARIO_NA_INSCRICAO =
  'A fase de inscrição não tem formulário. Use "Acrescentar formulário", escolha a fase de inscrição e informe o código do formulário.';

/** A inscrição precisa de fase no cronograma e de um formulário obrigatório nela. */
function mensagensDaInscricao(
  abas: readonly AbaParaConferir[],
  fases: readonly FaseQueRespondeFormulario[],
): string[] {
  const daInscricao = new Set(fases.filter((fase) => fase.coletaInscricao).map((f) => f.codigo));
  if (daInscricao.size === 0) return [SEM_FASE_DE_INSCRICAO];
  const temFormulario = abas.some((aba) => aba.obrigatorio && daInscricao.has(aba.fase));
  return temFormulario ? [] : [SEM_FORMULARIO_NA_INSCRICAO];
}

/** Cada fase tem um formulário obrigatório e um facultativo, no máximo. */
function mensagensDeFaseRepetida(abas: readonly AbaParaConferir[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const aba of abas.filter((item) => item.fase !== '')) {
    const chave = `${aba.fase}|${aba.obrigatorio}`;
    if (vistos.has(chave)) repetidos.add(chave);
    vistos.add(chave);
  }
  return abas
    .filter((aba) => repetidos.delete(`${aba.fase}|${aba.obrigatorio}`))
    .map(
      (aba) =>
        `A fase ${aba.nomeDaFase ?? aba.fase} tem mais de um formulário ${aba.obrigatorio ? 'obrigatório' : 'facultativo'}. Cada fase tem no máximo um obrigatório e um facultativo.`,
    );
}
