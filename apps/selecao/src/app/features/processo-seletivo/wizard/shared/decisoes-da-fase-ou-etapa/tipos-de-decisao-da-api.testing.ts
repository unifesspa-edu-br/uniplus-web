import { HttpHeaders } from '@angular/common/http';
import type { Provider } from '@angular/core';
import { of, type Observable } from 'rxjs';
import { apiOk, type ApiResult } from '@uniplus/shared-core/http';
import {
  criarVocabulario,
  TiposDeDecisaoApi,
  VOCABULARIO_DE_TIPOS_DE_DECISAO,
  type TipoDeDecisao,
} from '@uniplus/shared-data/configuracao';
import {
  TipoMotivoDeDecisaoCodigo as Codigo,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { faseDoServidor } from '../cronograma-do-servidor.testing';
import { dtoComCronograma } from '../hidratacao.testing';

/** A resposta do vocabulário de tipos de decisão da API, com os rótulos que ela devolve. */
export const VOCABULARIO_DA_API: readonly { codigo: Codigo; rotulo: string }[] = [
  { codigo: Codigo.ISENCAO_DA_TAXA, rotulo: 'Isenção da taxa' },
  { codigo: Codigo.HOMOLOGACAO_DAS_INSCRICOES, rotulo: 'Homologação das inscrições' },
  { codigo: Codigo.ANALISE_DOCUMENTAL, rotulo: 'Análise documental' },
  { codigo: Codigo.HETEROIDENTIFICACAO, rotulo: 'Heteroidentificação' },
  { codigo: Codigo.AVALIACAO_BIOPSICOSSOCIAL, rotulo: 'Avaliação biopsicossocial' },
  { codigo: Codigo.CLASSIFICACAO, rotulo: 'Classificação' },
  { codigo: Codigo.GABARITO_DA_PROVA, rotulo: 'Gabarito da prova' },
  { codigo: Codigo.NOTA_DA_ETAPA, rotulo: 'Nota da etapa' },
];

/** O que a API responde quando o vocabulário é lido com sucesso. */
export const RESPOSTA_DO_VOCABULARIO: Observable<ApiResult<readonly TipoDeDecisao[]>> = of(
  apiOk(VOCABULARIO_DA_API, 200, new HttpHeaders()),
);

/**
 * O vocabulário que a tela lê, já pedido à resposta dada: sem argumento, carregado na hora com os
 * rótulos da API. Uma resposta que não termina deixa a leitura pendente; uma que erra, em falha.
 */
export function provideTiposDeDecisaoDaApi(
  resposta: Observable<ApiResult<readonly TipoDeDecisao[]>> = RESPOSTA_DO_VOCABULARIO,
): Provider {
  return {
    provide: VOCABULARIO_DE_TIPOS_DE_DECISAO,
    useFactory: () => {
      const vocabulario = criarVocabulario(
        () => resposta,
        'Não foi possível carregar os tipos de decisão.',
      );
      vocabulario.carregar();
      return vocabulario;
    },
  };
}

/**
 * A API de tipos de decisão que responde com o vocabulário. Serve a quem monta a página do
 * processo: ela fornece o próprio vocabulário no `providers` e o lê desta API.
 */
export function provideApiDosTiposDeDecisao(): Provider {
  return { provide: TiposDeDecisaoApi, useValue: { listar: () => RESPOSTA_DO_VOCABULARIO } };
}

/** O rótulo que a API dá ao código, ou o próprio código quando o vocabulário não o conhece. */
export function rotuloDaApi(codigo: string): string {
  return VOCABULARIO_DA_API.find((tipo) => tipo.codigo === codigo)?.rotulo ?? codigo;
}

/** O tipo de decisão como as respostas da API o trazem: o código e o rótulo do vocabulário. */
export function umTipoDeDecisaoDaApi(codigo: `${Codigo}`): { codigo: Codigo; rotulo: string } {
  const tipo = VOCABULARIO_DA_API.find((item) => item.codigo === codigo);
  if (tipo === undefined)
    throw new Error(`Tipo de decisão fora do vocabulário de teste: ${codigo}`);
  return tipo;
}

/**
 * O processo lido que declara todos os tipos de decisão do vocabulário de teste: é dele que a
 * consulta tira o nome de cada tipo, sem ler o vocabulário.
 */
export function umProcessoLidoComOsTiposDeDecisao(): ProcessoSeletivoDto {
  const fase = faseDoServidor({ publicacoes: { tiposDeDecisao: VOCABULARIO_DA_API } });
  return dtoComCronograma({ cronogramaFases: [fase], etapas: [] });
}

/** A store que já leu o processo com os tipos de decisão do vocabulário de teste. */
export function provideProcessoLidoComOsTiposDeDecisao(): Provider {
  return {
    provide: ProcessoSeletivoStore,
    useFactory: () => {
      const store = new ProcessoSeletivoStore();
      store.remoteSnapshot.set(umProcessoLidoComOsTiposDeDecisao());
      return store;
    },
  };
}
