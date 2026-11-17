import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoCascataDeRemanejamento,
} from '@uniplus/shared-data/selecao';

import { referenciaQueVale, type RegraEscolhida } from '../regra-escolhida';
import { textoQueVale } from '../valor-que-vale';
import { comCampo, comLista, naSecao } from './secao-do-documento';

/**
 * Uma origem da matriz que a regra congelou: a modalidade de onde a vaga sai e a ordem de
 * preferência dos destinos. `destinos` vem na ordem em que a regra os declara, e a `ordem` do
 * documento nasce dela, a partir de 1.
 */
export interface OrdemDeOrigem {
  readonly origem: string;
  readonly destinos: readonly string[];
}

/**
 * A cascata como a regra do catálogo a congela (`RegraCatalogoDto.esquemaArgs` de
 * `criterio_remanejamento`): a modalidade de reserva e a ordem de cada origem. A tela só lê o que
 * a regra declarou e apresenta; nunca monta a matriz.
 */
export interface MatrizDaCascata {
  readonly fallbackCodigo: string;
  readonly ordens: readonly OrdemDeOrigem[];
}

export type DestinoDoDocumento = NonNullable<
  DocumentoDaConfiguracaoCascataDeRemanejamento['destinos']
>[number];

/** Os destinos de cada origem, na ordem em que a origem aparece e ordenados por `ordem`. */
export function ordensDoDocumento(destinos: readonly DestinoDoDocumento[]): OrdemDeOrigem[] {
  const porOrigem = new Map<string, DestinoDoDocumento[]>();
  for (const destino of destinos) {
    const origem = destino.modalidadeOrigemCodigo;
    porOrigem.set(origem, [...(porOrigem.get(origem) ?? []), destino]);
  }
  return [...porOrigem].map(([origem, daOrigem]) => ({
    origem,
    destinos: daOrigem.sort((a, b) => a.ordem - b.ordem).map((d) => d.modalidadeDestinoCodigo),
  }));
}

/** A ordem do documento é a posição do destino entre os da mesma origem, a partir de 1. */
function destinosDaOrigem(origem: string, codigos: readonly string[]): DestinoDoDocumento[] {
  return codigos.map((codigo, posicao) => ({
    modalidadeOrigemCodigo: origem,
    ordem: posicao + 1,
    modalidadeDestinoCodigo: codigo,
  }));
}

type CodigosPorOrigem = ReadonlyMap<string, readonly string[]>;

function mesmosCodigos(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): boolean {
  return a?.length === b?.length && (a ?? []).every((codigo, posicao) => codigo === b?.[posicao]);
}

function codigosPorOrigem(ordens: readonly OrdemDeOrigem[]): CodigosPorOrigem {
  return new Map(ordens.map(({ origem, destinos }) => [origem, destinos]));
}

/** As entradas do documento: a origem que não mudou volta como estava; a que mudou é reescrita. */
function entradasDasOrigensDoDocumento(
  atuais: readonly DestinoDoDocumento[],
  lidas: CodigosPorOrigem,
  desejadas: CodigosPorOrigem,
): DestinoDoDocumento[] {
  const reescritas = new Set<string>();
  return atuais.flatMap((destino) => {
    const origem = destino.modalidadeOrigemCodigo;
    if (mesmosCodigos(lidas.get(origem), desejadas.get(origem))) return [destino];
    if (reescritas.has(origem)) return [];
    reescritas.add(origem);
    return destinosDaOrigem(origem, desejadas.get(origem) ?? []);
  });
}

/**
 * Só a origem cuja lista de destinos mudou é reescrita, e renumerada a partir de 1: os destinos
 * das demais voltam como estavam no documento, na mesma posição e com a mesma `ordem`. A origem
 * reescrita ocupa o lugar da primeira entrada que tinha, e a origem nova entra no fim.
 */
function destinosAtualizados(
  atuais: readonly DestinoDoDocumento[],
  matriz: MatrizDaCascata,
): DestinoDoDocumento[] {
  const lidas = codigosPorOrigem(ordensDoDocumento(atuais));
  const novas = matriz.ordens.filter(({ origem }) => !lidas.has(origem));
  return [
    ...entradasDasOrigensDoDocumento(atuais, lidas, codigosPorOrigem(matriz.ordens)),
    ...novas.flatMap(({ origem, destinos }) => destinosDaOrigem(origem, destinos)),
  ];
}

type Cascata = NonNullable<DocumentoDaConfiguracao['cascataRemanejamento']>;

function comRegraEReserva(
  cascata: Cascata,
  regra: RegraEscolhida | null,
  fallbackCodigo: string,
): Cascata {
  const comRegra = comCampo(cascata, 'regra', referenciaQueVale(cascata.regra, regra));
  const reserva = textoQueVale(cascata.fallbackCodigo, fallbackCodigo);
  return comCampo(comRegra, 'fallbackCodigo', reserva);
}

/**
 * Declara a cascata a partir da regra escolhida e da matriz dela. Matriz igual à que o documento
 * já traz deixa os destinos como estão.
 */
export function definirCascata(
  documento: DocumentoDaConfiguracao,
  regra: RegraEscolhida | null,
  matriz: MatrizDaCascata,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'cascataRemanejamento', (cascata) => {
    const comReserva = comRegraEReserva(cascata, regra, matriz.fallbackCodigo);
    return comLista(comReserva, 'destinos', destinosAtualizados(cascata.destinos ?? [], matriz));
  });
}

/** A cascata que decidiu não ter destinos declara a lista vazia; ausente é "ainda não decidiu". */
export function declararCascataSemDestinos(
  documento: DocumentoDaConfiguracao,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'cascataRemanejamento', (cascata) => comCampo(cascata, 'destinos', []));
}

/** Processo sem cascata: o bloco inteiro sai do documento. */
export function removerCascata(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  const { cascataRemanejamento, ...resto } = documento;
  return cascataRemanejamento === undefined ? documento : resto;
}
