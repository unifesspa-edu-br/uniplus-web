import type { PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type { FaseDoCronograma } from '../../processo-seletivo.models';

/**
 * Recusa de precedência que a tela consegue antecipar.
 *
 * Só vale quando **as duas** fases da aresta estão no cronograma: a ausência de
 * uma delas não é violação, e é o que permite um cronograma curto. Quem arbitra
 * continua sendo o servidor — isto existe para avisar antes de gravar.
 */
/** A primeira fase não tem anterior com quem dividir o momento. */
export const MENSAGEM_DA_PRIMEIRA_FASE_NO_MESMO_MOMENTO =
  'A primeira fase não tem fase anterior: desmarque "Acontece no mesmo momento da fase anterior".';

export interface ViolacaoDePrecedencia {
  readonly antecessora: string;
  readonly sucessora: string;
  readonly motivo: 'mesmoMomento' | 'ordem' | 'sobreposicao';
}

export function violacoesDePrecedencia(
  fases: readonly FaseDoCronograma[],
  arestas: readonly PrecedenciaFaseDto[],
): readonly ViolacaoDePrecedencia[] {
  const porCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));
  const momentos = momentoDeCadaFase(fases);
  return arestas.flatMap((aresta) => {
    const par = parDaAresta(aresta, porCodigo);
    const motivo = par === null ? null : motivoDaViolacao(aresta, par, momentos);
    return motivo === null ? [] : [violacaoDaAresta(aresta, motivo)];
  });
}

type ParDeFases = readonly [FaseDoCronograma, FaseDoCronograma];

/** As duas fases da aresta, ou `null` quando alguma delas não está no cronograma. */
function parDaAresta(
  aresta: PrecedenciaFaseDto,
  porCodigo: ReadonlyMap<string, FaseDoCronograma>,
): ParDeFases | null {
  const antecessora = porCodigo.get(aresta.antecessoraCodigo);
  const sucessora = porCodigo.get(aresta.sucessoraCodigo);
  return antecessora === undefined || sucessora === undefined ? null : [antecessora, sucessora];
}

function violacaoDaAresta(
  aresta: PrecedenciaFaseDto,
  motivo: ViolacaoDePrecedencia['motivo'],
): ViolacaoDePrecedencia {
  return { antecessora: aresta.antecessoraCodigo, sucessora: aresta.sucessoraCodigo, motivo };
}

/**
 * O momento de cada fase, percorrendo as fases na ordem: o número só avança quando a fase não está
 * marcada como acontecendo junto com a anterior.
 */
function momentoDeCadaFase(fases: readonly FaseDoCronograma[]): ReadonlyMap<string, number> {
  const momentos = new Map<string, number>();
  let momento = 0;
  for (const [posicao, fase] of [...fases].sort((a, b) => a.ordem - b.ordem).entries()) {
    if (posicao === 0 || !fase.noMesmoMomentoDaAnterior) momento++;
    momentos.set(fase.codigo, momento);
  }
  return momentos;
}

function motivoDaViolacao(
  aresta: PrecedenciaFaseDto,
  [antecessora, sucessora]: ParDeFases,
  momentos: ReadonlyMap<string, number>,
): ViolacaoDePrecedencia['motivo'] | null {
  if (momentos.get(antecessora.codigo) === momentos.get(sucessora.codigo)) return 'mesmoMomento';
  if (antecessora.ordem >= sucessora.ordem) return 'ordem';

  const sobrepoe =
    !aresta.permiteSobreposicao &&
    antecessora.fim !== null &&
    sucessora.inicio !== null &&
    instanteDe(antecessora.fim) > instanteDe(sucessora.inicio);
  return sobrepoe ? 'sobreposicao' : null;
}

/**
 * Trocar a ordem entre duas fases que permanecem no cronograma forma um ciclo
 * que o servidor não consegue persistir numa chamada só — cada linha precisa que
 * a outra libere o valor primeiro.
 *
 * Renumerar a lista sequencialmente **não** evita isso: trocar duas fases de
 * lugar e renumerar produz precisamente essa permutação, e é a reordenação mais
 * comum que existe. Quem move fase na tela guarda a operação com esta função e,
 * quando ela acusa, segue o que a recusa do domínio orienta — mover uma das
 * fases para uma ordem livre numa gravação e fechar o ciclo na seguinte.
 *
 * Uma cadeia que termina numa ordem livre, ou na ordem de uma fase removida, não
 * é ciclo: a remoção libera o valor.
 */
export function trocaFechaCiclo(
  antes: readonly FaseDoCronograma[],
  depois: readonly FaseDoCronograma[],
): boolean {
  const troca = trocaDeOrdens(antes, depois);
  const estado: EstadoDaVisita = new Map();
  return [...troca.anteriores.keys()].some(
    (inicial) => !estado.has(inicial) && cadeiaFechaCiclo(inicial, troca, estado),
  );
}

function trocaDeOrdens(
  antes: readonly FaseDoCronograma[],
  depois: readonly FaseDoCronograma[],
): TrocaDeOrdens {
  const anteriores = new Map(antes.map((fase) => [fase.faseCanonicaId, fase]));
  const novas = new Map(depois.map((fase) => [fase.faseCanonicaId, fase]));
  return { anteriores, novas, retidaNaOrdem: ordensRetidas(anteriores, novas) };
}

/** Cada fase da cadeia em visita, ou já concluída por uma cadeia anterior. */
type EstadoDaVisita = Map<string, 'visitando' | 'concluido'>;

interface TrocaDeOrdens {
  readonly anteriores: ReadonlyMap<string, FaseDoCronograma>;
  readonly novas: ReadonlyMap<string, FaseDoCronograma>;
  /** A fase que continua no cronograma, por ordem que ela ocupava antes da troca. */
  readonly retidaNaOrdem: ReadonlyMap<number, string>;
}

function ordensRetidas(
  anteriores: ReadonlyMap<string, FaseDoCronograma>,
  novas: ReadonlyMap<string, FaseDoCronograma>,
): ReadonlyMap<number, string> {
  const retidaNaOrdem = new Map<number, string>();
  for (const [id, fase] of anteriores) {
    if (novas.has(id)) retidaNaOrdem.set(fase.ordem, id);
  }
  return retidaNaOrdem;
}

/** A ordem nova da fase que mudou de lugar, ou `undefined` se ela ficou onde estava ou saiu. */
function ordemNovaDaFaseMovida(id: string, troca: TrocaDeOrdens): number | undefined {
  const nova = troca.novas.get(id);
  const anterior = troca.anteriores.get(id);
  if (nova === undefined || anterior === undefined || nova.ordem === anterior.ordem) {
    return undefined;
  }
  return nova.ordem;
}

/**
 * Segue, de fase em fase, quem ocupa a ordem para onde a anterior se mudou. Voltar a uma fase
 * ainda em visita é o ciclo; chegar a uma já concluída, ou a uma ordem livre, não é.
 */
function cadeiaFechaCiclo(inicial: string, troca: TrocaDeOrdens, estado: EstadoDaVisita): boolean {
  const fechou = percorrerCadeia(inicial, troca, estado);
  for (const [fase, situacao] of estado) {
    if (situacao === 'visitando') estado.set(fase, 'concluido');
  }
  return fechou;
}

function percorrerCadeia(inicial: string, troca: TrocaDeOrdens, estado: EstadoDaVisita): boolean {
  for (let atual: string | undefined = inicial; atual !== undefined; ) {
    const jaVisto = estado.get(atual);
    if (jaVisto !== undefined) return jaVisto === 'visitando';

    const ordemNova = ordemNovaDaFaseMovida(atual, troca);
    if (ordemNova === undefined) return false;

    estado.set(atual, 'visitando');
    atual = troca.retidaNaOrdem.get(ordemNova);
  }
  return false;
}

/**
 * Compara janelas pelo instante que elas representam, não pelo texto: dois
 * mesmos momentos escritos com deslocamentos diferentes precisam comparar
 * iguais, e a ordem lexicográfica do texto os separaria.
 */
export function instanteDe(valor: string): number {
  return Date.parse(valor);
}
