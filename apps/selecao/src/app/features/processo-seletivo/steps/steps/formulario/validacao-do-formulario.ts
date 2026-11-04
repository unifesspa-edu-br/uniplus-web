import { FINALIDADE_INSCRICAO } from '@uniplus/shared-ui/components';

import type { WizardDraft } from '../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { finalidadeCabeNaCobranca, nomeDaFinalidade } from './formularios-por-finalidade';
import { textoDaAplicacaoEmAberto } from './modelo-de-formulario';
import { problemasDoFormulario } from './problemas-do-formulario';

/** O que a conferência do passo sabe de cada aba. */
export interface AbaParaConferir {
  readonly finalidade: string;
  readonly nome: string;
  /** A fase escolhida, ou vazio. */
  readonly fase: string;
  readonly fases: readonly unknown[];
  readonly numeroInvalido: boolean;
}

/** O que impede o passo de seguir, além de cada formulário em si. */
export interface FormularioParaConferir {
  readonly abas: readonly AbaParaConferir[];
  readonly draft: WizardDraft;
  readonly aplicacoesEmAberto: ReturnType<ProcessoSeletivoStore['aplicacoesDeModeloEmAberto']>;
  /** Os campos que o formulário pergunta e a oferta de atendimento não dá com o que escolher. */
  readonly camposSemValoresOfertados: readonly string[];
}

/** As mensagens de recusa do passo, na ordem em que o operador as corrige. */
export function mensagensDoFormulario(entrada: FormularioParaConferir): string[] {
  const { abas, draft } = entrada;
  return [
    ...abas
      .filter((aba) => aba.fase === '')
      .map((aba) => mensagemDaFaseQueFalta(aba.finalidade, aba.fases.length === 0)),
    ...abas
      .filter((aba) => !finalidadeCabeNaCobranca(aba.finalidade, draft.pagamento.cobra === true))
      .map(
        (aba) =>
          `O processo não cobra taxa de inscrição, e o formulário de ${aba.nome} só existe quando há cobrança. Remova o formulário, ou volte a cobrar a taxa em "Pagamento".`,
      ),
    ...[...entrada.aplicacoesEmAberto].map(([finalidade, emAberto]) =>
      textoDaAplicacaoEmAberto(nomeDaFinalidade(finalidade), emAberto),
    ),
    ...abas
      .filter((aba) => aba.numeroInvalido)
      .map(
        (aba) =>
          `O formulário de ${aba.nome} tem campos que não são números: veja os campos marcados na aba dele.`,
      ),
    ...problemasDoFormulario(
      draft.formulario,
      draft.documentos,
      new Set(draft.cronograma.fases.map((fase) => fase.codigo)),
    ),
    ...entrada.camposSemValoresOfertados.map(
      (campo) =>
        `O formulário pergunta ${campo} ao candidato, e a oferta de atendimento especializado não declara nenhum valor para escolher. Declare ao menos um em "Atend. especial", ou retire o campo daqui.`,
    ),
  ];
}

/** Por que o formulário não tem fase: o cronograma não tem a que serve, ou o operador ainda não escolheu entre as que servem. */
function mensagemDaFaseQueFalta(finalidade: string, semFaseQueServe: boolean): string {
  if (finalidade === FINALIDADE_INSCRICAO) {
    return semFaseQueServe
      ? 'O cronograma não tem fase em que a inscrição é respondida. Acrescente a fase de inscrição no passo Cronograma.'
      : 'Escolha em que fase do cronograma a inscrição é respondida.';
  }
  return semFaseQueServe
    ? `O cronograma não tem fase em que o formulário de ${nomeDaFinalidade(finalidade)} é respondido. Acrescente a fase no passo Cronograma, ou remova o formulário.`
    : `Escolha em que fase do cronograma o formulário de ${nomeDaFinalidade(finalidade)} é respondido.`;
}
