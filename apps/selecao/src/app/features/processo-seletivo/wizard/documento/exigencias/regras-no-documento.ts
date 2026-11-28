import type {
  DocumentoDaConfiguracaoExigencia,
  DocumentoDaConfiguracaoRegraDeComprovacao,
} from '@uniplus/shared-data/selecao';
import { basesLegaisParaEnvio } from '@uniplus/shared-utils';

import type { ExigenciaDeDocumento, RegraDeComprovacao } from '../../modelos/exigencias.models';
import { comAlteracoes } from '../edicoes/partes-por-chave';
import { comCampo, comCodigo, comLista } from '../edicoes/secao-do-documento';
import {
  codigoOuAusente,
  comCamposAlterados,
  comoCodigo,
  itensPreservados,
  type Aplicacao,
} from './campos-alterados';
import { baseLegalNoDocumento, baseLegalNoEditor } from './criterios-do-comprovante';
import { camposDaRegraNoEditor, regraEditavel } from './exigencia-no-editor';

type Exigencia = DocumentoDaConfiguracaoExigencia;
type Regra = DocumentoDaConfiguracaoRegraDeComprovacao;

export interface ContextoDasRegras {
  /** As regras do documento lido em uma só ordem; a `origem` da tela é a posição nela. */
  readonly porOrigem: readonly Regra[];
  /** As origens que já têm regra na tela, para que uma origem repetida valha só uma vez. */
  readonly usadas: Set<number>;
  readonly exigencias: ReadonlyMap<string, Exigencia>;
  readonly chavePorDocumento: ReadonlyMap<ExigenciaDeDocumento, string>;
}

type AplicacaoDaRegra = Aplicacao<Regra, RegraDeComprovacao, ContextoDasRegras>;

function comBasesLegais(regra: Regra, atual: RegraDeComprovacao): Regra {
  if (atual.basesLegais === null) return comCampo(regra, 'basesLegais', undefined);
  const bases = basesLegaisParaEnvio(atual.basesLegais);
  return comLista(
    regra,
    'basesLegais',
    itensPreservados(regra.basesLegais, bases, baseLegalNoEditor, baseLegalNoDocumento),
  );
}

const APLICACOES: readonly AplicacaoDaRegra[] = [
  { campo: 'forma', aplicar: (d, a) => comCampo(d, 'forma', comoCodigo<Regra['forma']>(a.forma)) },
  {
    campo: 'quantidadeMinima',
    aplicar: (d, a) => comCampo(d, 'quantidadeMinima', a.quantidadeMinima ?? undefined),
  },
  {
    campo: 'consequencia',
    aplicar: (d, a) =>
      comCodigo(d, 'consequenciaDoDescumprimento', codigoOuAusente(a.consequencia), [
        'consequenciaDoDescumprimentoRotulo',
      ]),
  },
  {
    campo: 'abrePrazoParaReenvio',
    aplicar: (d, a) => comCampo(d, 'abrePrazoParaReenvio', a.abrePrazoParaReenvio),
  },
  { campo: 'basesLegais', aplicar: comBasesLegais },
  {
    campo: 'criterioDeDistincao',
    aplicar: (d, a) =>
      comCodigo(d, 'criterioDeDistincao', codigoOuAusente(a.criterioDeDistincao), [
        'criterioDeDistincaoRotulo',
      ]),
  },
  {
    campo: 'dataReferencia',
    aplicar: (d, a) => comCampo(d, 'dataReferencia', a.dataReferencia ?? undefined),
  },
  {
    campo: 'ocorrenciasEsperadas',
    aplicar: (d, a) => comCampo(d, 'ocorrenciasEsperadas', a.ocorrenciasEsperadas ?? undefined),
  },
  {
    campo: 'grupoDoFormularioParaRepeticao',
    aplicar: (d, a) =>
      comCampo(d, 'grupoDoFormularioParaRepeticao', a.grupoDoFormularioParaRepeticao ?? undefined),
  },
];

/** A regra do documento com o que a tela mudou; a regra nova nasce só com a forma. */
function regraNoDocumento(
  original: Regra | undefined,
  atual: RegraDeComprovacao,
  contexto: ContextoDasRegras,
): Regra {
  const base = original ?? { forma: comoCodigo<Regra['forma']>(atual.forma) };
  const mudanca = { atual, lido: camposDaRegraNoEditor(base), contexto };
  return comAlteracoes(
    comCamposAlterados(base, mudanca, APLICACOES),
    (regra) => comExigenciaCitada(regra, atual, contexto),
    (regra) => comItens(regra, atual, contexto),
  );
}

function comExigenciaCitada(
  regra: Regra,
  atual: RegraDeComprovacao,
  { chavePorDocumento }: ContextoDasRegras,
): Regra {
  if (atual.forma !== 'DOCUMENTO') return comCampo(regra, 'exigenciaChave', undefined);
  const chave = atual.documento === null ? undefined : chavePorDocumento.get(atual.documento);
  return chave === undefined ? regra : comCampo(regra, 'exigenciaChave', chave);
}

function comItens(regra: Regra, atual: RegraDeComprovacao, contexto: ContextoDasRegras): Regra {
  if (atual.itens === null) return comCampo(regra, 'itens', undefined);
  return comLista(regra, 'itens', regrasNoDocumento(regra.itens, atual.itens, contexto));
}

interface RegraNaPosicao {
  readonly posicao: number | null;
  readonly regra: Regra;
}

/** A regra do documento de onde a da tela foi lida; cada uma vale uma vez só, em qualquer grupo. */
function originalDe(atual: RegraDeComprovacao, { porOrigem, usadas }: ContextoDasRegras) {
  const origem = atual.origem;
  if (origem === undefined || usadas.has(origem)) return undefined;
  usadas.add(origem);
  return porOrigem[origem];
}

function convertidas(
  lista: readonly Regra[],
  atuais: readonly RegraDeComprovacao[],
  contexto: ContextoDasRegras,
): RegraNaPosicao[] {
  return atuais.map((atual) => {
    const original = originalDe(atual, contexto);
    const posicao = original === undefined ? -1 : lista.indexOf(original);
    return {
      posicao: posicao < 0 ? null : posicao,
      regra: regraNoDocumento(original, atual, contexto),
    };
  });
}

/**
 * As regras da tela sobre as do documento, pareadas pela posição em que foram lidas no documento inteiro, de modo que a regra movida para outro grupo continua a mesma. A regra que
 * a tela não edita (cita exigência que não existe) fica onde estava: entra antes da primeira regra
 * da tela que a seguia no documento.
 */
export function regrasNoDocumento(
  originais: readonly Regra[] | undefined,
  atuais: readonly RegraDeComprovacao[],
  contexto: ContextoDasRegras,
): Regra[] {
  const lista = originais ?? [];
  const preservadas = lista.flatMap((regra, posicao) =>
    regraEditavel(regra, contexto.exigencias) ? [] : [{ posicao, regra }],
  );
  return intercalar(convertidas(lista, atuais, contexto), preservadas);
}

type Preservada = { readonly posicao: number; readonly regra: Regra };

function intercalar(
  convertidasNaOrdem: readonly RegraNaPosicao[],
  preservadas: readonly Preservada[],
): Regra[] {
  const emitidas = new Set<Preservada>();
  const regras = convertidasNaOrdem.flatMap(({ posicao, regra }) => {
    const anteriores = preservadas.filter(
      (preservada) => posicao !== null && preservada.posicao < posicao && !emitidas.has(preservada),
    );
    anteriores.forEach((preservada) => emitidas.add(preservada));
    return [...anteriores.map((preservada) => preservada.regra), regra];
  });
  const restantes = preservadas.filter((preservada) => !emitidas.has(preservada));
  return [...regras, ...restantes.map((preservada) => preservada.regra)];
}

/** As chaves de exigência que as regras citam, em qualquer profundidade. */
export function chavesCitadas(regras: readonly Regra[]): ReadonlySet<string> {
  return new Set(
    regras.flatMap((regra) => [
      ...(regra.exigenciaChave === undefined ? [] : [regra.exigenciaChave]),
      ...chavesCitadas(regra.itens ?? []),
    ]),
  );
}
