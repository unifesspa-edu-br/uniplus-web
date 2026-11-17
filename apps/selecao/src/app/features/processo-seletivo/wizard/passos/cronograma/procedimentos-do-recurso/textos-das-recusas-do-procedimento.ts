import { textoDaRecusaDosTiposDeDecisao } from '../../../shared/decisoes-da-fase-ou-etapa/recusas-dos-tipos-de-decisao';

/** A janela de recurso da etapa e a da fase recusam o procedimento pelos mesmos motivos, com o prefixo da entidade. */
const PREFIXOS_DA_JANELA = [
  'uniplus.selecao.recurso_da_etapa.',
  'uniplus.selecao.regra_recurso_fase.',
] as const;

/** Já tem texto, junto da declaração dos tipos de decisão: o procedimento reaproveita o mesmo. */
const SUFIXO_DA_DECISAO_NAO_DECLARADA = 'procedimento_para_decisao_nao_declarada';

const TEXTO_PELO_SUFIXO: ReadonlyMap<string, string> = new Map([
  [
    'procedimento_de_recurso_desconhecido',
    'O procedimento escolhido não está na lista de procedimentos de recurso disponíveis. Escolha outro.',
  ],
  [
    'procedimento_de_recurso_duplicado',
    'Há mais de um procedimento para a mesma decisão e mesmo item contestado. Remova a repetição.',
  ],
  [
    'procedimento_de_recurso_conflitante',
    'Há um procedimento para a decisão inteira e procedimentos por item contestado. Mantenha o procedimento da decisão inteira ou os procedimentos por item e remova os demais.',
  ],
  [
    'alvo_do_procedimento_de_recurso_inexistente',
    'O item contestado ou a área do ENEM contestada não existe mais nesta fase ou etapa. Escolha outro item ou remova o procedimento.',
  ],
  [
    'procedimento_de_recurso_ausente',
    'Falta declarar o procedimento de recurso para uma decisão ou um item contestado.',
  ],
]);

/** O texto da recusa do servidor a um procedimento de recurso, ou `null` quando o código é outro. */
export function textoDaRecusaDoProcedimento(codigo: string): string | null {
  const prefixo = PREFIXOS_DA_JANELA.find((candidato) => codigo.startsWith(candidato));
  if (prefixo === undefined) return null;
  const sufixo = codigo.slice(prefixo.length);
  if (sufixo === SUFIXO_DA_DECISAO_NAO_DECLARADA) return textoDaRecusaDosTiposDeDecisao(codigo);
  return TEXTO_PELO_SUFIXO.get(sufixo) ?? null;
}
