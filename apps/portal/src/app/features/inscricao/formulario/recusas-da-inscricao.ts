import type { CausaDeCampo } from '@uniplus/shared-core/http';
import type { ErroDoServidor } from '@uniplus/shared-inscricao/formulario';

/**
 * As recusas de quem gravou sobre uma revisão defasada: outra janela gravou, ou a retificação trocou a
 * versão do formulário. A inscrição enviada noutra janela também é mudança que esta tela não viu:
 * relê-la troca o rascunho pela correção por novo envio.
 */
export const CONFLITOS: ReadonlySet<string> = new Set([
  'uniplus.selecao.inscricao.precondicao_falhou',
  'uniplus.selecao.inscricao.conflito_de_concorrencia',
  'uniplus.selecao.inscricao.rascunho_so_antes_do_envio',
]);

/** O campo em que o servidor devolve a recusa da oferta de curso. */
const CAMPO_DA_OFERTA = 'ofertaCursoId';
/** O campo em que o servidor devolve a recusa da 2ª opção de curso. */
const CAMPO_DA_SEGUNDA_OPCAO = 'ofertaCursoSegundaOpcaoId';
/** Recusas da 2ª opção que nascem da 1ª: trocar a 1ª as desfaz; as demais ficam até a 2ª mudar. */
export const RECUSAS_DA_SEGUNDA_QUE_VEM_DA_PRIMEIRA: ReadonlySet<string> = new Set([
  'uniplus.selecao.inscricao.segunda_opcao_igual_a_primeira',
  'uniplus.selecao.inscricao.segunda_opcao_sem_primeira',
]);

/** As recusas do servidor separadas pelo lugar onde a tela as mostra. */
export interface RecusasSeparadas {
  /** As que apontam um campo do formulário. */
  readonly porCampo: readonly ErroDoServidor[];
  /** A mensagem da recusa da 1ª opção de curso, se houve. */
  readonly daOferta: string | null;
  /** A recusa da 2ª opção de curso, se houve. */
  readonly daSegunda: RecusaDaSegundaOpcao | null;
}

/** A mensagem da recusa da 2ª opção de curso e o código dela, que decide quando ela se desfaz. */
export interface RecusaDaSegundaOpcao {
  readonly mensagem: string;
  readonly codigo: string;
}

/** Separa as recusas do servidor entre as de campo e as das opções de curso; o texto é o da API. */
export function separarRecusas(recusas: readonly CausaDeCampo[]): RecusasSeparadas {
  const daOferta = recusas.find((e) => e.field === CAMPO_DA_OFERTA);
  const daSegunda = recusas.find((e) => e.field === CAMPO_DA_SEGUNDA_OPCAO);
  return {
    porCampo: recusas
      .filter((e) => e.field !== CAMPO_DA_OFERTA && e.field !== CAMPO_DA_SEGUNDA_OPCAO)
      .map((e) => ({ campo: e.field, mensagem: e.message })),
    daOferta: daOferta?.message ?? null,
    daSegunda: daSegunda ? { mensagem: daSegunda.message, codigo: daSegunda.code } : null,
  };
}
