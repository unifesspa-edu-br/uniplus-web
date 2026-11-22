import type { IdentificadorDoItem } from '@uniplus/shared-core/http';

import {
  campoDaRecusaDaEtapa,
  NO_TOPO_DA_ETAPA,
  type CampoDaRecusaDaEtapa,
} from '../../passos/cronograma/campo-da-etapa';
import { localDaBancaIdentificada } from '../bancas/campo-da-banca';
import { conteudoDaParteDaEtapa } from '../../passos/cronograma/parte-da-etapa';
import {
  campoComLinhaNaLista,
  campoDaRecusaDaFase,
  NO_TOPO_DA_FASE,
} from '../../passos/fase/campo-da-fase';
import type { CampoDaRecusaDaFase } from '../../passos/fase/campo-da-fase';
import { conteudoDaParte, parteDaFase, type ParteDaFase } from '../../passos/fase/parte-da-fase';
import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import { localDaRecusa, type LocalDaRecusa } from './local-da-recusa';

/** O cronograma que a publicação conferiu, ou o de hoje: as fases e as etapas do rascunho. */
export interface CronogramaConferido {
  readonly fases: readonly FaseDoCronograma[];
  readonly etapas: readonly EtapaPontuada[];
}

/**
 * Onde a recusa da publicação aponta no cronograma de hoje, achada só pelos identificadores:
 * a fase pelo código, a etapa e o recurso pelo `Id`. A posição que a API deu nunca escolhe o item.
 *
 * - `fase` e `etapa`: o item existe, e `campo` diz sob qual controle a recusa aparece. A banca
 *   é achada pelo `id` que a API deu; `bancaAusente` diz que a recusa apontava uma banca que não
 *   está mais na tela, e então ela fica na seção das bancas.
 * - `recursoRegravado`: a etapa existe, mas o recurso que a recusa apontou não existe mais com
 *   aquele `Id`; a recusa fica no topo da etapa.
 * - `passo`: a fase ou a etapa que a recusa apontou não existe mais; a recusa fica no topo do passo.
 */
export type LugarDaRecusaDaPublicacao =
  | {
      readonly tipo: 'fase';
      readonly codigo: string;
      readonly campo: CampoDaRecusaDaFase;
      readonly parte: ParteDaFase;
      readonly bancaAusente?: boolean;
    }
  | {
      readonly tipo: 'etapa';
      readonly etapaId: string;
      readonly campo: CampoDaRecusaDaEtapa;
      readonly recursoId: string | null;
      readonly bancaAusente?: boolean;
    }
  | { readonly tipo: 'recursoRegravado'; readonly etapaId: string }
  | { readonly tipo: 'passo' };

interface RecusaComIdentificadores {
  readonly campo: string;
  readonly identificadores: readonly IdentificadorDoItem[];
}

const ITEM_DE_LISTA_DA_ETAPA = /^(itensDeAvaliacao|escalaDeAtendimento)\.\d+\..+$/;

function identificadorDa(
  identificadores: readonly IdentificadorDoItem[],
  lista: string,
): string | null {
  return identificadores.find((item) => item.lista === lista)?.identificador ?? null;
}

/** A lista inteira, quando o campo é de um item sem identificador: ele não é achado pela posição. */
function campoDaListaDaEtapa(campo: CampoDaRecusaDaEtapa): CampoDaRecusaDaEtapa {
  const lista = ITEM_DE_LISTA_DA_ETAPA.exec(campo);
  return lista === null ? campo : (lista[1] as CampoDaRecusaDaEtapa);
}

function lugarNaFaseAchada(local: LocalDaRecusa, fase: FaseDoCronograma, bancaId: string | null) {
  const banca = localDaBancaIdentificada(local, 'bancasRequeridas', fase.bancasRequeridas, bancaId);
  const campo = campoDaRecusaDaFase(banca.local) ?? NO_TOPO_DA_FASE;
  const bancaAusente = banca.bancaAusente;
  return {
    tipo: 'fase',
    codigo: fase.codigo,
    campo: campoComLinhaNaLista(campo, fase.produtos.length),
    parte: parteDaFase(local),
    bancaAusente,
  } as const;
}

function lugarNaFase(
  recusa: RecusaComIdentificadores,
  local: LocalDaRecusa,
  codigo: string,
  fases: readonly FaseDoCronograma[],
): LugarDaRecusaDaPublicacao {
  const fase = fases.find((candidata) => candidata.codigo === codigo);
  if (fase === undefined) return { tipo: 'passo' };
  return lugarNaFaseAchada(
    local,
    fase,
    identificadorDa(recusa.identificadores, 'bancasRequeridas'),
  );
}

function lugarNoRecurso(
  local: LocalDaRecusa,
  etapa: EtapaPontuada,
  recursoId: string | null,
): LugarDaRecusaDaPublicacao {
  const etapaId = etapa.id ?? '';
  const posicao = etapa.recursos.findIndex((recurso) => recurso.id === recursoId);
  if (recursoId === null || posicao < 0) return { tipo: 'recursoRegravado', etapaId };
  const campo =
    campoDaRecusaDaEtapa({ ...local, recurso: posicao }) ?? `recursos.${posicao}.recurso`;
  return { tipo: 'etapa', etapaId, campo: campo as CampoDaRecusaDaEtapa, recursoId };
}

function lugarNoCorpoDaEtapa(
  local: LocalDaRecusa,
  identificadores: readonly IdentificadorDoItem[],
  etapa: EtapaPontuada,
): LugarDaRecusaDaPublicacao {
  const bancaId = identificadorDa(identificadores, 'bancas');
  const banca = localDaBancaIdentificada(local, 'bancas', etapa.bancas, bancaId);
  const campo = campoDaListaDaEtapa(campoDaRecusaDaEtapa(banca.local) ?? NO_TOPO_DA_ETAPA);
  const bancaAusente = banca.bancaAusente;
  return { tipo: 'etapa', etapaId: etapa.id ?? '', campo, recursoId: null, bancaAusente };
}

function lugarNaEtapa(
  local: LocalDaRecusa,
  identificadores: readonly IdentificadorDoItem[],
  etapas: readonly EtapaPontuada[],
): LugarDaRecusaDaPublicacao {
  const etapaId = identificadorDa(identificadores, 'etapas');
  const etapa = etapas.find((candidata) => candidata.id !== null && candidata.id === etapaId);
  if (etapa === undefined) return { tipo: 'passo' };
  if (local.recurso === null) return lugarNoCorpoDaEtapa(local, identificadores, etapa);
  return lugarNoRecurso(local, etapa, identificadorDa(identificadores, 'recursos'));
}

/**
 * O lugar da recusa no cronograma, ou `null` quando ela não aponta fase nem etapa por
 * identificador: sem identificador a recusa fica só na Revisão, sem campo.
 */
export function lugarDaRecusaDaPublicacao(
  recusa: RecusaComIdentificadores,
  cronograma: CronogramaConferido,
): LugarDaRecusaDaPublicacao | null {
  const local = localDaRecusa(recusa.campo);
  if (local === null) return null;
  const doDono = identificadorDa(
    recusa.identificadores,
    local.dono === 'fase' ? 'fases' : 'etapas',
  );
  if (doDono === null) return null;
  return local.dono === 'fase'
    ? lugarNaFase(recusa, local, doDono, cronograma.fases)
    : lugarNaEtapa(local, recusa.identificadores, cronograma.etapas);
}

/**
 * O que a parte do cadastro a que o lugar pertence tem naquele cronograma; `null` quando o
 * lugar não tem parte ou ela não existe nele. Serve a comparar o cronograma que a publicação
 * conferiu com o de hoje.
 */
export function conteudoDoLugar(
  lugar: LugarDaRecusaDaPublicacao,
  cronograma: CronogramaConferido,
): unknown {
  if (lugar.tipo === 'fase') {
    const fase = cronograma.fases.find((candidata) => candidata.codigo === lugar.codigo);
    return fase === undefined ? null : conteudoDaParte(fase, lugar.parte);
  }
  if (lugar.tipo !== 'etapa') return null;
  const etapa = cronograma.etapas.find((candidata) => candidata.id === lugar.etapaId);
  if (etapa === undefined) return null;
  if (lugar.recursoId === null) return conteudoDaParteDaEtapa(etapa, 'etapa');
  return etapa.recursos.find((recurso) => recurso.id === lugar.recursoId) ?? null;
}

/** Identifica a parte do cadastro do lugar; `null` para o lugar que não tem parte. */
export function chaveDaParteDoLugar(lugar: LugarDaRecusaDaPublicacao): string | null {
  if (lugar.tipo === 'fase') return `fase|${lugar.codigo}|${lugar.parte}`;
  if (lugar.tipo !== 'etapa') return null;
  return `etapa|${lugar.etapaId}|${lugar.recursoId ?? ''}`;
}
