import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import { decimalDoCampo, inteiroDoCampo } from '../../shared/numero-do-campo';

/** Origem de data que obriga a fase a declarar janela. */
export const ORIGEM_DATA_PROPRIA = 'PROPRIA';

/**
 * O que a fase escolhida exige, lido do catálogo — nunca declarado pelo
 * operador. É a diferença entre perguntar "esta fase permite recurso?" e
 * descobrir que ela permite porque produz resultado não definitivo.
 */
export interface ExigenciasDaFase {
  readonly janelaObrigatoria: boolean;
  readonly exigeAtoProduzido: boolean;
  readonly admiteRecurso: boolean;
  readonly agrupaEtapas: boolean;
}

export function exigenciasDe(fase: FaseCanonicaDto): ExigenciasDaFase {
  return {
    janelaObrigatoria: fase.origemData === ORIGEM_DATA_PROPRIA,
    exigeAtoProduzido: fase.produzResultado,
    admiteRecurso: fase.produzResultado && !fase.resultadoDefinitivo,
    agrupaEtapas: fase.agrupaEtapas,
  };
}

/**
 * Recusa de precedência que a tela consegue antecipar.
 *
 * Só vale quando **as duas** fases da aresta estão no cronograma: a ausência de
 * uma delas não é violação, e é o que permite um cronograma curto. Quem arbitra
 * continua sendo o servidor — isto existe para avisar antes de gravar.
 */
export interface ViolacaoDePrecedencia {
  readonly antecessora: string;
  readonly sucessora: string;
  readonly motivo: 'ordem' | 'sobreposicao';
}

export function violacoesDePrecedencia(
  fases: readonly FaseDoCronograma[],
  arestas: readonly PrecedenciaFaseDto[],
): readonly ViolacaoDePrecedencia[] {
  const porCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));
  const violacoes: ViolacaoDePrecedencia[] = [];

  for (const aresta of arestas) {
    const antecessora = porCodigo.get(aresta.antecessoraCodigo);
    const sucessora = porCodigo.get(aresta.sucessoraCodigo);
    if (antecessora === undefined || sucessora === undefined) continue;

    if (antecessora.ordem >= sucessora.ordem) {
      violacoes.push({
        antecessora: aresta.antecessoraCodigo,
        sucessora: aresta.sucessoraCodigo,
        motivo: 'ordem',
      });
      continue;
    }

    if (
      !aresta.permiteSobreposicao &&
      antecessora.fim !== null &&
      sucessora.inicio !== null &&
      instanteDe(antecessora.fim) > instanteDe(sucessora.inicio)
    ) {
      violacoes.push({
        antecessora: aresta.antecessoraCodigo,
        sucessora: aresta.sucessoraCodigo,
        motivo: 'sobreposicao',
      });
    }
  }

  return violacoes;
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
  const anteriores = new Map(antes.map((fase) => [fase.faseCanonicaId, fase]));
  const novas = new Map(depois.map((fase) => [fase.faseCanonicaId, fase]));

  const retidaNaOrdem = new Map<number, string>();
  for (const [id, fase] of anteriores) {
    if (novas.has(id)) retidaNaOrdem.set(fase.ordem, id);
  }

  const estado = new Map<string, 'visitando' | 'concluido'>();
  for (const inicial of anteriores.keys()) {
    if (estado.has(inicial)) continue;

    const caminho: string[] = [];
    let atual: string | undefined = inicial;

    while (atual !== undefined) {
      const jaVisto = estado.get(atual);
      if (jaVisto !== undefined) {
        if (jaVisto === 'visitando') return true;
        break;
      }

      const nova = novas.get(atual);
      const anterior = anteriores.get(atual);
      if (nova === undefined || anterior === undefined || nova.ordem === anterior.ordem) break;

      estado.set(atual, 'visitando');
      caminho.push(atual);
      atual = retidaNaOrdem.get(nova.ordem);
    }

    for (const visitado of caminho) estado.set(visitado, 'concluido');
  }

  return false;
}

/**
 * Compara janelas pelo instante que elas representam, não pelo texto: dois
 * mesmos momentos escritos com deslocamentos diferentes precisam comparar
 * iguais, e a ordem lexicográfica do texto os separaria.
 */
function instanteDe(valor: string): number {
  return Date.parse(valor);
}

/** Renumera a lista de 1 a N, na ordem em que ela está. */
export function renumerar(fases: readonly FaseDoCronograma[]): readonly FaseDoCronograma[] {
  return fases.map((fase, indice) => ({ ...fase, ordem: indice + 1 }));
}

/**
 * Uma etapa compõe a nota quando pontua e declara peso **positivo**. Havendo
 * etapas, ao menos uma precisa fazê-lo: sem nenhuma, o divisor da média seria
 * zero, e o agregado recusa com uma mensagem que fala de nota final, não de
 * etapa.
 *
 * Peso zero não compõe: ele não soma ao divisor, e o domínio o recusa à parte,
 * exigindo peso maior que zero quando informado. Aceitá-lo aqui faria um
 * conjunto de etapas todo zerado passar na conferência da tela para ser
 * recusado no servidor por outro motivo — com uma mensagem que fala do peso de
 * uma etapa, não da nota final que ficou sem divisor.
 */
export function componeNota(etapa: EtapaPontuada): boolean {
  const pontua = etapa.carater === 'classificatoria' || etapa.carater === 'ambas';
  const peso = decimalDoCampo(etapa.peso);
  return pontua && peso !== null && peso > 0;
}

/**
 * Peso e nota mínima, como o comando os recebe. A gramática é a dos campos
 * numéricos do editor, e não a de moeda: aqui o ponto é separador decimal,
 * porque `0.5` é meio — lê-lo como agrupador devolveria 5, e o servidor
 * aceitaria, porque 5 é um peso válido.
 */
export { decimalDoCampo as comoNumero, inteiroDoCampo };

/**
 * O que impede a gravação, na ordem em que quem preenche resolve: primeiro o
 * que falta declarar, depois o que está incoerente entre si.
 *
 * Só entra aqui o que a tela consegue afirmar com o que tem em mãos. Teto de
 * vagas, vigência de ato e unicidade de código no servidor continuam sendo dele
 * — repetir a conferência aqui daria duas fontes para a mesma regra, e a que
 * ficasse desatualizada recusaria o que o servidor aceita.
 */
export function problemasDoCronograma(
  fases: readonly FaseDoCronograma[],
  etapas: readonly EtapaPontuada[],
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
  precedencias: readonly PrecedenciaFaseDto[],
): readonly string[] {
  const problemas: string[] = [];

  if (fases.length === 0) {
    problemas.push('O cronograma precisa de ao menos uma fase.');
    return problemas;
  }

  const codigosRepetidos = repetidos(fases.map((fase) => fase.faseCanonicaId));
  if (codigosRepetidos.length > 0) {
    problemas.push('Cada fase canônica entra uma vez só no cronograma.');
  }

  if (repetidos(fases.map((fase) => fase.ordem)).length > 0) {
    problemas.push('Duas fases não podem ocupar a mesma posição na linha do tempo.');
  }

  for (const fase of fases) {
    const canonica = fasePorId.get(fase.faseCanonicaId);
    if (canonica === undefined) continue;

    const exigencias = exigenciasDe(canonica);

    if (exigencias.janelaObrigatoria && (fase.inicio === null || fase.fim === null)) {
      problemas.push(`A fase ${canonica.nome} precisa de data e hora de início e de fim.`);
    }

    if (
      fase.inicio !== null &&
      fase.fim !== null &&
      Date.parse(fase.fim) < Date.parse(fase.inicio)
    ) {
      problemas.push(`Na fase ${canonica.nome}, o fim não pode vir antes do início.`);
    }

    if (exigencias.exigeAtoProduzido && fase.atoProduzidoCodigo === null) {
      problemas.push(
        `A fase ${canonica.nome} produz resultado e precisa declarar o ato que o publica.`,
      );
    }
  }

  problemas.push(...problemasDasEtapas(fases, etapas, fasePorId));

  for (const violacao of violacoesDePrecedencia(fases, precedencias)) {
    problemas.push(
      violacao.motivo === 'ordem'
        ? `${violacao.antecessora} precisa vir antes de ${violacao.sucessora} na linha do tempo.`
        : `${violacao.antecessora} não pode se sobrepor a ${violacao.sucessora}: o cadastro exige que uma termine antes da outra começar.`,
    );
  }

  return problemas;
}

/**
 * As etapas e a fase que as agrupa formam um par: uma fase que agrupa etapas sem
 * nenhuma etapa é recusada na hora da gravação, e etapas sem a fase que as
 * agrupa passam agora para serem recusadas na publicação.
 *
 * Os dois casos entram aqui porque a diferença — recusa agora ou depois — não
 * ajuda quem preenche: os dois descrevem um cronograma que não se sustenta.
 */
function problemasDasEtapas(
  fases: readonly FaseDoCronograma[],
  etapas: readonly EtapaPontuada[],
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): readonly string[] {
  const problemas: string[] = [];
  const faseQueAgrupa = fases.find((fase) => {
    const canonica = fasePorId.get(fase.faseCanonicaId);
    return canonica !== undefined && canonica.agrupaEtapas;
  });

  if (faseQueAgrupa !== undefined && etapas.length === 0) {
    problemas.push(
      'A fase de avaliação agrupa as etapas pontuadas e precisa de ao menos uma. Declare a etapa, ou remova a fase.',
    );
  }

  if (faseQueAgrupa === undefined && etapas.length > 0) {
    problemas.push(
      'As etapas pontuadas precisam da fase de avaliação que as agrupa. Acrescente a fase, ou remova as etapas.',
    );
  }

  if (etapas.length === 0) return problemas;

  if (etapas.some((etapa) => etapa.nome.trim() === '')) {
    problemas.push('Toda etapa precisa de nome.');
  }

  if (etapas.some((etapa) => etapa.tipoEtapaOrigemId === '')) {
    problemas.push('Toda etapa precisa do tipo que a classifica.');
  }

  if (etapas.some((etapa) => etapa.carater === '')) {
    problemas.push('Toda etapa precisa declarar se é classificatória, eliminatória ou ambas.');
  }

  if (repetidos(etapas.map((etapa) => etapa.ordem)).length > 0) {
    problemas.push('Duas etapas não podem ocupar a mesma posição.');
  }

  if (!etapas.some(componeNota)) {
    problemas.push(
      'Ao menos uma etapa precisa compor a nota final: ser classificatória (ou ambas) e ter peso maior que zero.',
    );
  }

  return problemas;
}

function repetidos<T>(valores: readonly T[]): readonly T[] {
  const vistos = new Set<T>();
  const repetidos = new Set<T>();
  for (const valor of valores) {
    if (vistos.has(valor)) repetidos.add(valor);
    vistos.add(valor);
  }
  return [...repetidos];
}
