import { FatoEscolhivel } from './fatos-escolhiveis';
import { CondicaoDeFato, operadoresDoFato } from './valor-da-condicao';

/** Uma condição que vive numa alternativa (cláusula) do predicado. */
export interface CondicaoEmClausula extends CondicaoDeFato {
  readonly clausula: number;
}

/** Uma condição junto com a posição que ela ocupa na lista — é por ela que a tela a edita. */
export interface CondicaoPosicionada<T extends CondicaoEmClausula = CondicaoEmClausula> {
  readonly indice: number;
  readonly condicao: T;
}

/** Uma alternativa: as condições que precisam valer JUNTAS para ela ser satisfeita. */
export interface ClausulaDeCondicoes<T extends CondicaoEmClausula = CondicaoEmClausula> {
  readonly numero: number;
  readonly condicoes: readonly CondicaoPosicionada<T>[];
}

/**
 * Uma condição recém-declarada sobre um fato: o primeiro operador que o domínio dele admite,
 * e nenhum valor escolhido ainda.
 *
 * Nasce sem valor de propósito. Semeá-la com o primeiro valor do domínio gravaria uma
 * afirmação que ninguém fez — e a conferência da tela cobra o valor em seguida, em vez de
 * deixar a gravação ser recusada pelo servidor.
 */
export function condicaoNova(fato: FatoEscolhivel, clausula: number): CondicaoEmClausula {
  return {
    clausula,
    fato: fato.codigo,
    operador: operadoresDoFato(fato)[0].valor,
    valor: '',
  };
}

/**
 * Os números de cláusula que a lista usa, em ordem — `[1]` quando ela ainda não tem condição
 * nenhuma, que é a cláusula em que a primeira condição nascerá.
 */
export function numerosDeClausula(condicoes: readonly CondicaoEmClausula[]): readonly number[] {
  const numeros = [...new Set(condicoes.map((condicao) => condicao.clausula))].sort(
    (um, outro) => um - outro,
  );
  return numeros.length > 0 ? numeros : [1];
}

/**
 * As alternativas, na ordem, sem as condições sobre `fatoDoRecorte` — que a tela edita por um
 * controle próprio e mostraria aqui como uma segunda verdade sobre o mesmo recorte.
 */
export function clausulasDe<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  fatoDoRecorte = '',
): readonly ClausulaDeCondicoes<T>[] {
  const posicionadas = condicoes
    .map((condicao, indice) => ({ indice, condicao }))
    .filter(({ condicao }) => fatoDoRecorte === '' || condicao.fato !== fatoDoRecorte);

  const numeros = [...new Set(posicionadas.map(({ condicao }) => condicao.clausula))].sort(
    (um, outro) => um - outro,
  );

  return numeros.map((numero) => ({
    numero,
    condicoes: posicionadas.filter(({ condicao }) => condicao.clausula === numero),
  }));
}

/** A lista com uma condição a mais na alternativa indicada. */
export function comCondicaoEm<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  clausula: number,
  fato: FatoEscolhivel,
): readonly (T | CondicaoEmClausula)[] {
  return [...condicoes, condicaoNova(fato, clausula)];
}

/** A lista com UMA condição trocada, endereçada pela posição que a tela conhece. */
export function comCondicaoTrocadaEm<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  indice: number,
  condicao: T,
): readonly T[] {
  return condicoes.map((atual, posicao) => (posicao === indice ? condicao : atual));
}

/**
 * A lista sem aquela condição. A alternativa que fica sem nenhuma some junto, e as demais
 * são renumeradas: cláusula vazia não é exprimível no wire, e um buraco na numeração faria a
 * tela mostrar "alternativa 3" onde só há duas.
 */
export function semCondicaoEm<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  indice: number,
): readonly T[] {
  return renumerarClausulas(condicoes.filter((_, posicao) => posicao !== indice));
}

/**
 * A lista com uma alternativa a mais — a segunda via pela qual o predicado passa a valer,
 * combinada por OU com as que já existem.
 *
 * O recorte acompanha: ele vale para o predicado inteiro, e deixá-lo de fora da alternativa
 * nova a faria valer sem o recorte.
 */
export function comClausulaEm<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  fato: FatoEscolhivel,
  fatoDoRecorte = '',
): readonly (T | CondicaoEmClausula)[] {
  const numero = Math.max(...numerosDeClausula(condicoes)) + 1;
  const doRecorte =
    fatoDoRecorte === ''
      ? undefined
      : condicoes.find((condicao) => condicao.fato === fatoDoRecorte);

  return [
    ...condicoes,
    condicaoNova(fato, numero),
    ...(doRecorte === undefined ? [] : [{ ...doRecorte, clausula: numero }]),
  ];
}

/** A lista sem aquela alternativa inteira. */
export function semClausulaEm<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  numero: number,
): readonly T[] {
  return renumerarClausulas(condicoes.filter((condicao) => condicao.clausula !== numero));
}

/** Renumera as alternativas de 1 a N, preservando a ordem em que aparecem. */
export function renumerarClausulas<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
): readonly T[] {
  const numeros = [...new Set(condicoes.map((condicao) => condicao.clausula))].sort(
    (um, outro) => um - outro,
  );
  const novoNumero = new Map(numeros.map((numero, indice) => [numero, indice + 1]));

  return condicoes.map((condicao) => ({
    ...condicao,
    clausula: novoNumero.get(condicao.clausula) ?? condicao.clausula,
  }));
}
