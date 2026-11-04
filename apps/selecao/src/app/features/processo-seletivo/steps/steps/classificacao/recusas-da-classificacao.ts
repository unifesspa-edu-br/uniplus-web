import type { ProblemValidationError } from '@uniplus/shared-core/http';

import { TEXTO_DA_PENDENCIA_DA_RESOLUCAO } from './classificacao-para-comando';

export const PREFIXO_DA_RECUSA = 'uniplus.selecao.configuracao_classificacao.';

/**
 * O que a tela diz para cada recusa da resolução. O texto é daqui, e não o `message` que o
 * servidor devolve: a mensagem ao operador é contrato da tela, e o `code` é o que é estável.
 */
const MENSAGEM_POR_CODIGO_DA_RESOLUCAO: ReadonlyMap<string, string> = new Map([
  [
    `${PREFIXO_DA_RECUSA}resolucao_peso_area_enem_obrigatoria`,
    TEXTO_DA_PENDENCIA_DA_RESOLUCAO.obrigatoria.campo,
  ],
  [
    `${PREFIXO_DA_RECUSA}resolucao_peso_area_enem_indevida`,
    'A resolução de Peso por Área só se aplica à classificação baseada em ENEM com a média ponderada.',
  ],
  [
    `${PREFIXO_DA_RECUSA}resolucao_peso_area_enem_invalida`,
    'O nome da resolução de Peso por Área não é válido. Escolha a resolução na lista.',
  ],
  [
    `${PREFIXO_DA_RECUSA}resolucao_peso_area_enem_nao_encontrada`,
    'A resolução escolhida não está no cadastro de Peso por Área. Escolha outra.',
  ],
  [
    `${PREFIXO_DA_RECUSA}resolucao_peso_area_enem_incompleta`,
    'A resolução escolhida não tem pesos cadastrados para todos os grupos de área. Complete-a no cadastro de Peso por Área ou escolha outra.',
  ],
  [
    `${PREFIXO_DA_RECUSA}quadro_peso_area_enem_vazio`,
    'A resolução escolhida não tem nenhum grupo de área no cadastro de Peso por Área.',
  ],
  [
    `${PREFIXO_DA_RECUSA}quadro_peso_area_enem_grupo_repetido`,
    'A resolução escolhida repete um grupo de área no cadastro de Peso por Área.',
  ],
]);

/** A tela mostra o que o servidor disse da escala; sem mensagem, orienta pelo campo. */
export function mensagemDaRecusaDaEscala(erro: Pick<ProblemValidationError, 'message'>): string {
  return (
    erro.message?.trim() || 'O servidor recusou a escala da nota final. Confira o valor informado.'
  );
}

const MENSAGEM_DE_RECUSA_DESCONHECIDA =
  'O servidor recusou a resolução de Peso por Área escolhida. Confira o cadastro de Peso por Área ou escolha outra.';

export function mensagemDaRecusaDaResolucao(erro: Pick<ProblemValidationError, 'code'>): string {
  return MENSAGEM_POR_CODIGO_DA_RESOLUCAO.get(erro.code) ?? MENSAGEM_DE_RECUSA_DESCONHECIDA;
}
