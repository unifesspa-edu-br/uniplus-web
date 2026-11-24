import { OperadorCodigo } from '@uniplus/shared-data/selecao';

import type { CondicaoGatilhoConfig, ExigenciaDeDocumento } from '../../processo-seletivo.models';

import {
  APLICABILIDADE_CONDICIONAL,
  APLICABILIDADE_GERAL,
  FATO_MODALIDADE,
} from './exigencias-documentais';

/**
 * A restrição às modalidades declarada no gatilho da exigência, ou `null` quando ela vale para
 * todo candidato.
 *
 * A restrição mora no gatilho porque é assim que o contrato o expressa — `MODALIDADE EM [...]`
 * —, e guardar uma segunda lista ao lado dele criaria duas versões da mesma verdade.
 */
export function modalidadesDaExigencia(documento: ExigenciaDeDocumento): readonly string[] | null {
  return modalidadesDoGatilho(documento.condicoes);
}

/**
 * A exigência com as modalidades trocadas. `null` devolve o documento a todo candidato: a cláusula
 * sai do gatilho em vez de ficar como lista vazia, que o agregado recusa.
 *
 * Tirar as modalidades NÃO torna a exigência geral: pode haver condição sobre outro
 * fato. A aplicabilidade só muda quando o operador a declara.
 */
export function comModalidades(
  documento: ExigenciaDeDocumento,
  codigos: readonly string[] | null,
): ExigenciaDeDocumento {
  const condicoes = comRestricaoDeModalidades(documento.condicoes, codigos);
  return codigos === null
    ? { ...documento, condicoes }
    : { ...documento, aplicabilidade: APLICABILIDADE_CONDICIONAL, condicoes };
}

/**
 * Os números de cláusula que o gatilho usa, em ordem — `[1]` quando ele ainda não tem
 * condição nenhuma, que é a cláusula em que a primeira condição nascerá.
 */
export function numerosDeClausula(condicoes: readonly CondicaoGatilhoConfig[]): readonly number[] {
  const numeros = [...new Set(condicoes.map((condicao) => condicao.clausula))].sort(
    (um, outro) => um - outro,
  );
  return numeros.length > 0 ? numeros : [1];
}

/**
 * Troca a restrição às modalidades do gatilho, replicando-a em CADA alternativa.
 *
 * As cláusulas se combinam por OU e as condições de dentro de uma delas por E — a forma
 * normal disjuntiva. Como a restrição vale para o gatilho inteiro, ela tem de aparecer em toda
 * alternativa: escrevê-la só na primeira diria "(modalidade E o resto) OU (a outra
 * alternativa, para qualquer modalidade)", que é justamente o que quem escolheu as modalidades não quis.
 */
export function comRestricaoDeModalidades(
  condicoes: readonly CondicaoGatilhoConfig[],
  codigos: readonly string[] | null,
): readonly CondicaoGatilhoConfig[] {
  const outras = condicoes.filter((condicao) => !ehCondicaoDasModalidades(condicao));
  if (codigos === null) return outras;
  return [...outras, ...modalidadesEmCadaClausula(outras, codigos)];
}

/**
 * Se a condição é a cláusula `MODALIDADE EM [...]` que o controle "quem deve entregar" escreve —
 * a única que ele sabe reescrever. Uma comparação de modalidade de outra forma, que o domínio
 * aceita e este wizard não escreve, sobrevive: descartá-la apagaria no servidor, a cada gravação,
 * uma condição declarada por outro caminho.
 */
export function ehCondicaoDasModalidades(condicao: {
  readonly fato: string;
  readonly operador: string;
}): boolean {
  return condicao.fato === FATO_MODALIDADE && condicao.operador === OperadorCodigo.ALGUM_DE;
}

function modalidadesEmCadaClausula(
  outras: readonly CondicaoGatilhoConfig[],
  codigos: readonly string[],
): readonly CondicaoGatilhoConfig[] {
  const valor = JSON.stringify(codigos);
  return numerosDeClausula(outras).map((clausula) => ({
    clausula,
    fato: FATO_MODALIDADE,
    operador: OperadorCodigo.ALGUM_DE,
    valor,
  }));
}

/**
 * A exigência com a restrição que o operador acabou de marcar em "quem deve entregar".
 *
 * Marcar TODAS as modalidades ofertadas é declarar que o documento vale para todo candidato —
 * a menos que reste outra condição a sustentá-lo. Sem esta parte, a exigência ficava "de quem
 * satisfaz" com gatilho vazio, isto é, cobrada de ninguém: o documento sumia do edital em
 * silêncio, e nenhuma conferência o acusava.
 *
 * Marcar todas também não grava uma lista que por acaso coincide com o quadro de vagas: a
 * diferença aparece quando o quadro muda depois, e o que acompanha o quadro acompanha a
 * mudança.
 */
export function comModalidadesEscolhidas(
  documento: ExigenciaDeDocumento,
  escolhidas: readonly string[],
  ofertadas: readonly string[],
): ExigenciaDeDocumento {
  const acompanhaOQuadro =
    escolhidas.length === ofertadas.length &&
    ofertadas.every((codigo) => escolhidas.includes(codigo));

  const exigencia = comModalidades(documento, acompanhaOQuadro ? null : [...escolhidas]);
  return acompanhaOQuadro && exigencia.condicoes.length === 0
    ? comExigidoDeTodos(exigencia, true)
    : exigencia;
}

/** Se a exigência é cobrada de todo candidato, sem gatilho nenhum. */
export function exigidoDeTodos(documento: ExigenciaDeDocumento): boolean {
  return documento.aplicabilidade === APLICABILIDADE_GERAL;
}

/**
 * Declara de quem a exigência é cobrada. É uma DECLARAÇÃO, nunca inferida da presença de
 * condição (ADR-0071): quem diz "de todos" está dizendo que o gatilho não se aplica, e por
 * isso ele é descartado junto — o agregado recusa a exigência geral que carrega condição, e
 * guardar o gatilho invisível o faria ressurgir na próxima vez que a aplicabilidade mudasse,
 * sem que ninguém o tivesse reescrito.
 */
export function comExigidoDeTodos(
  documento: ExigenciaDeDocumento,
  deTodos: boolean,
): ExigenciaDeDocumento {
  if (deTodos) {
    return { ...documento, aplicabilidade: APLICABILIDADE_GERAL, condicoes: [] };
  }
  return { ...documento, aplicabilidade: APLICABILIDADE_CONDICIONAL };
}

/**
 * As modalidades da restrição, ou `null` quando não há restrição a escrever.
 *
 * Duas podas, por motivos diferentes. A restrição que ficou VAZIA depois de o quadro de vagas
 * mudar sai porque cláusula vazia é recusada pelo agregado — e a exigência que deixou de
 * alcançar modalidade alguma é acusada à parte, pela conferência de alcance.
 *
 * A restrição que passou a cobrir TODA a oferta sai só quando o gatilho tem outra condição para
 * sustentar a exigência. Sem ela, retirá-la deixaria uma exigência "de quem satisfaz" sem
 * condição nenhuma — cobrada de ninguém —, e o documento sumiria do edital em silêncio por
 * causa de uma mudança no quadro de vagas que ninguém ligou a ele.
 */
export function modalidadesParaGravacao(
  documento: ExigenciaDeDocumento,
  modalidadesOfertadas: readonly string[],
): readonly string[] | null {
  const ofertadas = new Set(modalidadesOfertadas);
  const modalidadesRestritas = (modalidadesDoGatilho(documento.condicoes) ?? []).filter((codigo) =>
    ofertadas.has(codigo),
  );
  if (modalidadesRestritas.length === 0) return null;

  const temOutraCondicao = documento.condicoes.some((c) => c.fato !== FATO_MODALIDADE);
  return modalidadesRestritas.length === ofertadas.size && temOutraCondicao
    ? null
    : modalidadesRestritas;
}

/**
 * As modalidades da cláusula `MODALIDADE EM [...]`, ou `null` quando o gatilho não fala de
 * modalidade.
 *
 * O valor trafega como texto que contém JSON (mesmo tratamento do gatilho no resto do
 * contrato), e texto que não é a lista esperada não vira restrição — uma restrição inventada a
 * partir de um valor ilegível mentiria sobre quem precisa entregar.
 */
export function modalidadesDoGatilho(
  condicoes: readonly {
    readonly fato: string;
    readonly operador: string;
    readonly valor: string;
  }[],
): readonly string[] | null {
  const daModalidade = condicoes.find(ehCondicaoDasModalidades);
  return daModalidade === undefined ? null : listaDeTextos(daModalidade.valor);
}

function listaDeTextos(texto: string): readonly string[] | null {
  try {
    const valor: unknown = JSON.parse(texto);
    if (!Array.isArray(valor)) return null;
    return valor.filter((item): item is string => typeof item === 'string');
  } catch {
    return null;
  }
}
