import { textoDaRecusaDosTiposDeDecisao } from '../../shared/decisoes-da-fase-ou-etapa/recusas-dos-tipos-de-decisao';
import { indiceDaFaseEm, recusaDaBancaNaFase } from '../fase/recusas-da-fase';

/** O erro de campo que o servidor devolve na recusa de uma gravação. */
export interface ErroDaRecusaDoServidor {
  readonly field: string;
  readonly code: string;
  readonly message?: string;
}

/** O texto da recusa do servidor à fase, com a fase de origem quando o caminho a nomeia; `null` quando a recusa é outra. */
export function textoDaRecusaDaFase(erro: ErroDaRecusaDoServidor): string | null {
  const texto = recusaDaBancaNaFase(erro)?.mensagem ?? textoDaRecusaDosTiposDeDecisao(erro.code);
  if (texto === null) return null;
  const indice = indiceDaFaseEm(erro.field);
  return indice === null ? texto : `Fase ${indice + 1}: ${texto}`;
}
