import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoColeta,
  DocumentoDaConfiguracaoCalculoDoDado,
  TipoDaReferenciaTemporal,
} from '@uniplus/shared-data/selecao';

import { textoQueVale } from '../valor-que-vale';
import { comAlteracoes } from './partes-por-chave';
import { comCampo, comEscolha, comLista, naSecao } from './secao-do-documento';

type Referencia = NonNullable<DocumentoDaConfiguracaoColeta['referenciaTemporalDosDados']>;

/** A data a que os fatos do candidato se referem, como o formulário a tem. */
export interface ReferenciaTemporalDoFormulario {
  readonly tipo: TipoDaReferenciaTemporal | '';
  readonly data: string;
  readonly faseChave: string;
}

function referenciaComValores(
  atual: Referencia | undefined,
  valores: ReferenciaTemporalDoFormulario,
): Referencia {
  return comAlteracoes(
    atual ?? {},
    (referencia) => comEscolha(referencia, 'tipo', valores.tipo),
    (referencia) => comCampo(referencia, 'data', textoQueVale(referencia.data, valores.data)),
    (referencia) =>
      comCampo(referencia, 'faseChave', textoQueVale(referencia.faseChave, valores.faseChave)),
  );
}

/** `null` retira a referência temporal; ela só nasce quando a pessoa a declara. */
export function definirReferenciaTemporal(
  documento: DocumentoDaConfiguracao,
  referencia: ReferenciaTemporalDoFormulario | null,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'coleta', (coleta) =>
    comCampo(
      coleta,
      'referenciaTemporalDosDados',
      referencia === null
        ? undefined
        : referenciaComValores(coleta.referenciaTemporalDosDados, referencia),
    ),
  );
}

type Derivacao = DocumentoDaConfiguracaoCalculoDoDado;

function posicaoDoFato(atuais: readonly Derivacao[], codigo: string, ocorrencia: number) {
  return atuais.flatMap((entrada, indice) => (entrada.codigoDoDado === codigo ? [indice] : []))[
    ocorrencia
  ];
}

function comRegrasDoFato(
  atuais: readonly Derivacao[],
  fatoCodigo: string,
  regras: Derivacao['regras'],
  ocorrencia: number,
): Derivacao[] {
  const posicao = posicaoDoFato(atuais, fatoCodigo, ocorrencia);
  if (posicao === undefined)
    return ocorrencia === 0
      ? [...atuais, { codigoDoDado: fatoCodigo, ...(regras !== undefined && { regras }) }]
      : [...atuais];
  return atuais.map((entrada, indice) =>
    indice === posicao ? comCampo(entrada, 'regras', regras) : entrada,
  );
}

/**
 * As regras de derivação do fato: a lista inteira que a tela edita substitui a do fato, e o fato
 * que ainda não tinha regra ganha a entrada ao fim. As regras dos outros fatos não são tocadas.
 */
export function definirRegrasDeDerivacao(
  documento: DocumentoDaConfiguracao,
  fatoCodigo: string,
  regras: Derivacao['regras'],
  ocorrencia = 0,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'coleta', (coleta) =>
    comLista(
      coleta,
      'calculosDosDados',
      comRegrasDoFato(coleta.calculosDosDados ?? [], fatoCodigo, regras, ocorrencia),
    ),
  );
}
