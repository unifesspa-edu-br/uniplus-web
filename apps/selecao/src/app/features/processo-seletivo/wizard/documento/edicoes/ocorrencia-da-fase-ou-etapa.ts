import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

import { comLista, naSecao, type EdicaoDoDocumento } from './secao-do-documento';

function posicaoDaOcorrencia(
  partes: readonly { readonly chave: string }[],
  chave: string,
  ocorrencia: number,
): number {
  return (
    partes.map((parte, indice) => ({ parte, indice })).filter(({ parte }) => parte.chave === chave)[
      ocorrencia
    ]?.indice ?? -1
  );
}

export function editarOcorrenciaDaFase(
  documento: DocumentoDaConfiguracao,
  chave: string,
  ocorrencia: number,
  editar: EdicaoDoDocumento,
): DocumentoDaConfiguracao {
  const fases = documento.cronograma?.fases ?? [];
  const posicao = posicaoDaOcorrencia(fases, chave, ocorrencia);
  if (posicao < 0) return documento;
  const isolado = comFases(documento, [fases[posicao]]);
  const fase = editar(isolado).cronograma?.fases?.[0];
  if (fase === undefined || fase === fases[posicao]) return documento;
  return comFases(documento, substituir(fases, posicao, fase));
}

export function editarOcorrenciaDaEtapa(
  documento: DocumentoDaConfiguracao,
  chave: string,
  ocorrencia: number,
  editar: EdicaoDoDocumento,
): DocumentoDaConfiguracao {
  const etapas = documento.etapas ?? [];
  const posicao = posicaoDaOcorrencia(etapas, chave, ocorrencia);
  if (posicao < 0) return documento;
  const isolado = comLista(documento, 'etapas', [etapas[posicao]]);
  const etapa = editar(isolado).etapas?.[0];
  if (etapa === undefined || etapa === etapas[posicao]) return documento;
  return comLista(documento, 'etapas', substituir(etapas, posicao, etapa));
}

function substituir<T>(itens: readonly T[], posicao: number, novo: T): T[] {
  return itens.map((item, indice) => (indice === posicao ? novo : item));
}

function comFases(
  documento: DocumentoDaConfiguracao,
  fases: NonNullable<NonNullable<DocumentoDaConfiguracao['cronograma']>['fases']>,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'cronograma', (cronograma) => comLista(cronograma, 'fases', fases));
}
