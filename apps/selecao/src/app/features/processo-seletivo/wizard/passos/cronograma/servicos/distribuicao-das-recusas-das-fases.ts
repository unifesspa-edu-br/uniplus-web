import type { RecusaDoProblema } from '@uniplus/shared-core/http';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import { campoComLinhaNaLista, campoDaRecusaDaFase } from '../../fase/campo-da-fase';
import { conteudoDaParte, parteDaFase, type ParteDaFase } from '../../fase/parte-da-fase';
import { localDaBancaEnviada } from '../../../shared/bancas/campo-da-banca';
import { notaDaBanca } from '../../../shared/bancas/recusas-das-bancas';
import { localDaRecusa, type LocalDaRecusa } from '../../../shared/recusas/local-da-recusa';
import type { RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';

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
  readonly fase: FaseDoCronograma;
  readonly campo: string;
  readonly parte: ParteDaFase;
  readonly nota: string | undefined;
}

interface FaseNomeada {
  readonly local: LocalDaRecusa;
  readonly fase: FaseDoCronograma;
}

/** A fase enviada que o `field` nomeia, ou `null` quando ele não nomeia fase nem posição enviada. */
function faseNomeada(
  recusa: RecusaDoProblema,
  enviadas: readonly FaseDoCronograma[],
): FaseNomeada | null {
  const local = localDaRecusa(recusa.campo);
  const fase = local?.dono === 'fase' ? enviadas[local.indice] : undefined;
  return local === null || fase === undefined ? null : { local, fase };
}

/**
 * O lugar da recusa na fase enviada, ou `null` quando ela nomeia um campo que a fase não conhece
 * ou cujo controle a tela não mostra. A recusa a uma linha de publicações que a fase enviada não
 * tinha fica na lista. A banca é a da posição enviada, e a recusa a ela passa a apontar o
 * identificador dela na tela.
 */
function naFaseEnviada(
  { local, fase }: FaseNomeada,
  controleNaTela: ControleNaTela,
): LugarNaFase | null {
  const daBanca = localDaBancaEnviada(local, 'bancasRequeridas', fase.bancasRequeridas);
  const campo = campoDaRecusaDaFase(daBanca.local);
  if (campo === null) return null;
  const doLugar = campoComLinhaNaLista(campo, fase.produtos.length);
  if (!controleNaTela(fase.faseCanonicaId, doLugar)) return null;
  const nota = notaDaBanca(daBanca.bancaAusente);
  return { fase, campo: doLugar, parte: parteDaFase(local), nota };
}

function lugarNaFase(
  recusa: RecusaDoProblema,
  enviadas: readonly FaseDoCronograma[],
  controleNaTela: ControleNaTela,
): LugarNaFase | null {
  const nomeada = faseNomeada(recusa, enviadas);
  return nomeada === null ? null : naFaseEnviada(nomeada, controleNaTela);
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
  { fase, campo, parte, nota }: LugarNaFase,
): RecusaDaFaseGuardada {
  const conteudoEnviado = conteudoDaParte(fase, parte);
  return { ...recusa, campo, resposta, origem: 'gravacao', nota, parte, conteudoEnviado };
}
