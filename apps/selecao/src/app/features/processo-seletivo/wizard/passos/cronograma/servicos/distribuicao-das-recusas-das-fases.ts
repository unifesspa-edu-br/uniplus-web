import type { RecusaDoProblema } from '@uniplus/shared-core/http';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import { campoDaRecusaDaFase } from '../../fase/campo-da-fase';
import { conteudoDaParte, parteDaFase, type ParteDaFase } from '../../fase/parte-da-fase';
import { localDaRecusa, type LocalDaRecusa } from '../../../shared/recusas/local-da-recusa';
import type { RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';

/** O campo das recusas que a fase recebe mas a tela não mostra num controle: ficam no topo da fase. */
export const NO_TOPO_DA_FASE = '';

/**
 * A recusa da gravação, guardada com a parte do cadastro a que pertence e com o que a fase tinha
 * naquela parte quando foi enviada: é a comparação com o que a fase tem depois que diz se a parte
 * foi alterada e a recusa está a conferir de novo.
 */
export interface RecusaDaFaseGuardada extends Omit<RecusaOrdenada, 'aConferir'> {
  readonly parte: ParteDaFase;
  readonly conteudoEnviado: unknown;
}

export interface DistribuicaoDasRecusas {
  /** As recusas que acharam lugar, pelo identificador da fase canônica enviada. */
  readonly porFase: ReadonlyMap<string, readonly RecusaDaFaseGuardada[]>;
  /** As que não nomeiam fase, nomeiam uma posição que a gravação não enviou ou um campo sem controle na tela. */
  readonly semLugar: readonly RecusaDoProblema[];
}

/** A fase tem, na tela, controle para o campo: o que não tem a recusa não pode apontar. */
export type ControleNaTela = (faseCanonicaId: string, campo: string) => boolean;

interface LugarNaFase {
  readonly local: LocalDaRecusa;
  readonly fase: FaseDoCronograma;
  readonly campo: string;
}

/**
 * A fase enviada que o `field` aponta, ou `null` quando ele não nomeia fase, nomeia uma posição
 * que não foi enviada ou nomeia um campo cujo controle a tela não mostra.
 */
function lugarNaFase(
  recusa: RecusaDoProblema,
  enviadas: readonly FaseDoCronograma[],
  controleNaTela: ControleNaTela,
): LugarNaFase | null {
  const local = localDaRecusa(recusa.campo);
  const fase = local?.dono === 'fase' ? enviadas[local.indice] : undefined;
  if (local === null || fase === undefined) return null;
  const campo = campoDaRecusaDaFase(local) ?? NO_TOPO_DA_FASE;
  return controleNaTela(fase.faseCanonicaId, campo) ? { local, fase, campo } : null;
}

/**
 * Distribui as recusas de uma resposta pelas fases enviadas. A posição `fases[i]` vale para o
 * conteúdo que produziu a resposta, e é nele que ela vira o identificador da fase: depois da
 * resposta a fase pode ter mudado de lugar, ou saído. A recusa sem lugar vai para o resumo do
 * passo, e assim nunca some.
 */
export function distribuirRecusasDasFases(
  resposta: number,
  enviadas: readonly FaseDoCronograma[],
  recusas: readonly RecusaDoProblema[],
  controleNaTela: ControleNaTela,
): DistribuicaoDasRecusas {
  const porFase = new Map<string, RecusaDaFaseGuardada[]>();
  const semLugar: RecusaDoProblema[] = [];
  for (const recusa of recusas) {
    const lugar = lugarNaFase(recusa, enviadas, controleNaTela);
    if (lugar === null) semLugar.push(recusa);
    else acrescentar(porFase, lugar.fase, guardar(recusa, resposta, lugar));
  }
  return { porFase, semLugar };
}

function acrescentar(
  porFase: Map<string, RecusaDaFaseGuardada[]>,
  fase: FaseDoCronograma,
  guardada: RecusaDaFaseGuardada,
): void {
  const id = fase.faseCanonicaId;
  porFase.set(id, [...(porFase.get(id) ?? []), guardada]);
}

function guardar(
  recusa: RecusaDoProblema,
  resposta: number,
  { local, fase, campo }: LugarNaFase,
): RecusaDaFaseGuardada {
  const parte = parteDaFase(local);
  return {
    ...recusa,
    campo,
    resposta,
    origem: 'gravacao',
    parte,
    conteudoEnviado: conteudoDaParte(fase, parte),
  };
}
