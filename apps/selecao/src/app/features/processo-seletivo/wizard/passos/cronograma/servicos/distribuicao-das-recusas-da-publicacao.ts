import { NO_TOPO_DA_ETAPA } from '../campo-da-etapa';
import { NO_TOPO_DA_FASE } from '../../fase/campo-da-fase';
import type { RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';
import type { LugarDaRecusaDaPublicacao } from '../../../shared/recusas/lugar-da-recusa-da-publicacao';

/** A recusa da publicação no lugar que ela tem no cronograma de hoje, já com o campo e o estado. */
export interface RecusaNoCronograma {
  readonly lugar: LugarDaRecusaDaPublicacao;
  readonly recusa: RecusaOrdenada;
}

/** As recusas da publicação por fase (pelo código), por etapa (pelo `Id`) e as do topo do passo. */
export interface DistribuicaoDaPublicacao {
  readonly porFase: ReadonlyMap<string, readonly RecusaOrdenada[]>;
  readonly porEtapa: ReadonlyMap<string, readonly RecusaOrdenada[]>;
  readonly doPasso: readonly RecusaOrdenada[];
}

/** O campo sob o qual a recusa aparece no lugar; o topo quando o lugar não tem campo. */
export function campoDoLugar(lugar: LugarDaRecusaDaPublicacao): string {
  if (lugar.tipo === 'fase' || lugar.tipo === 'etapa') return lugar.campo;
  return lugar.tipo === 'recursoRegravado' ? NO_TOPO_DA_ETAPA : NO_TOPO_DA_FASE;
}

function acrescentar(
  mapa: Map<string, RecusaOrdenada[]>,
  chave: string,
  recusa: RecusaOrdenada,
): void {
  mapa.set(chave, [...(mapa.get(chave) ?? []), recusa]);
}

/** Reparte as recusas pelo dono do lugar; as sem fase nem etapa vão ao topo do passo. */
export function distribuirAsRecusasDaPublicacao(
  noCronograma: readonly RecusaNoCronograma[],
): DistribuicaoDaPublicacao {
  const porFase = new Map<string, RecusaOrdenada[]>();
  const porEtapa = new Map<string, RecusaOrdenada[]>();
  const doPasso: RecusaOrdenada[] = [];
  for (const { lugar, recusa } of noCronograma) {
    if (lugar.tipo === 'fase') acrescentar(porFase, lugar.codigo, recusa);
    else if (lugar.tipo === 'passo') doPasso.push(recusa);
    else acrescentar(porEtapa, lugar.etapaId, recusa);
  }
  return { porFase, porEtapa, doPasso };
}
