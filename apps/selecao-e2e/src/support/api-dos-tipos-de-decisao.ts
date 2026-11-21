import type { Page, Route } from '@playwright/test';
import type { EtapaProcessoDto, FaseCronogramaDto } from '@uniplus/shared-data/selecao';
import {
  comProdutoNaFase,
  comTiposDeDecisaoNaEtapa,
  comTiposDeDecisaoNaFase,
} from '../fixtures/cronograma-do-servidor';
import {
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
} from '../fixtures/processo-publicado-completo';
import {
  CORS,
  mockarCatalogos,
  PRODUTO_DEFINITIVO,
  problema,
  recusar,
  SEM_CONTEUDO,
} from './api-da-unidade-da-fase';
import { leituraDoProcessoCompleto } from './leituras-do-processo-completo';
import { responderCom } from './responder';
import { TIPO_RECUSADO } from './tipos-do-cenario-fora-do-vocabulario';

const ROTA_DO_PROCESSO = new RegExp(`/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}`);

/** O que o servidor simulado guarda e o que a tela lhe enviou. */
export interface ServidorDosTiposDeDecisao {
  fase: FaseCronogramaDto;
  etapa: EtapaProcessoDto;
  situacao: 'rascunho' | 'publicado';
  readonly cronogramasEnviados: { tiposDeDecisao: string[] }[][];
  readonly etapasEnviadas: { tiposDeDecisao: string[] }[][];
}

/**
 * O processo do cenário com os tipos de decisão que a fase e a etapa já declaram, nenhum por padrão.
 * A fase publica também o resultado definitivo: sem ele a conferência local do cronograma cobra a
 * fase que conclui o ciclo recursal e a gravação não chega ao servidor.
 */
export function novoServidorDosTiposDeDecisao(
  situacao: 'rascunho' | 'publicado',
  tiposDaFase: readonly string[] = [],
  tiposDaEtapa: readonly string[] = [],
): ServidorDosTiposDeDecisao {
  const [fase] = PROCESSO_PUBLICADO_COMPLETO.cronogramaFases;
  const [etapa] = PROCESSO_PUBLICADO_COMPLETO.etapas;
  return {
    fase: comTiposDeDecisaoNaFase(comProdutoNaFase(fase, PRODUTO_DEFINITIVO), tiposDaFase),
    etapa: comTiposDeDecisaoNaEtapa(etapa, tiposDaEtapa),
    situacao,
    cronogramasEnviados: [],
    etapasEnviadas: [],
  };
}

/** O servidor guarda e devolve os tipos em ordem alfabética do código. */
const emOrdemAlfabetica = (tipos: readonly string[]): string[] => [...new Set(tipos)].sort();

function detalheDoProcesso(servidor: ServidorDosTiposDeDecisao) {
  return {
    ...PROCESSO_PUBLICADO_COMPLETO,
    status: servidor.situacao,
    cronogramaFases: [servidor.fase],
    etapas: [servidor.etapa],
    atendimentoEspecializado: null,
    raizesExigencia: PROCESSO_PUBLICADO_COMPLETO.raizesExigencia.slice(0, 1),
    classificacao: { ...PROCESSO_PUBLICADO_COMPLETO.classificacao, regrasEliminacao: [] },
  };
}

async function ler(route: Route, servidor: ServidorDosTiposDeDecisao, caminho: string) {
  const corpo = caminho.endsWith(ID_DO_PROCESSO_COMPLETO)
    ? detalheDoProcesso(servidor)
    : leituraDoProcessoCompleto(caminho);
  if (corpo === undefined) await route.fulfill({ status: 404, headers: CORS });
  else await responderCom(route, corpo, CORS);
}

async function recusarTipoNaoReconhecido(route: Route, campo: string): Promise<void> {
  const erro = {
    field: campo,
    code: 'uniplus.selecao.motivo_de_decisao.tipo_invalido',
    message: 'Um tipo de decisão enviado não é reconhecido pelo servidor.',
  };
  await recusar(route, problema(422, 'uniplus.validacao', 'Validação', [erro]));
}

async function gravarCronograma(
  route: Route,
  servidor: ServidorDosTiposDeDecisao,
  corpo: { tiposDeDecisao: string[] }[],
): Promise<void> {
  servidor.cronogramasEnviados.push(corpo);
  const [fase] = corpo;
  if (fase.tiposDeDecisao.includes(TIPO_RECUSADO.codigo)) {
    return recusarTipoNaoReconhecido(route, 'fases[0].tiposDeDecisao[0]');
  }
  servidor.fase = comTiposDeDecisaoNaFase(servidor.fase, emOrdemAlfabetica(fase.tiposDeDecisao));
  await route.fulfill(SEM_CONTEUDO);
}

async function gravarEtapas(
  route: Route,
  servidor: ServidorDosTiposDeDecisao,
  corpo: { tiposDeDecisao: string[] }[],
): Promise<void> {
  servidor.etapasEnviadas.push(corpo);
  servidor.etapa = comTiposDeDecisaoNaEtapa(
    servidor.etapa,
    emOrdemAlfabetica(corpo[0].tiposDeDecisao),
  );
  await route.fulfill(SEM_CONTEUDO);
}

async function escrever(route: Route, servidor: ServidorDosTiposDeDecisao, caminho: string) {
  const corpo = route.request().postDataJSON();
  if (caminho.endsWith('/cronograma-fases')) return gravarCronograma(route, servidor, corpo);
  if (caminho.endsWith('/etapas')) return gravarEtapas(route, servidor, corpo);
  return route.fulfill(SEM_CONTEUDO);
}

async function atender(route: Route, servidor: ServidorDosTiposDeDecisao): Promise<void> {
  const requisicao = route.request();
  const caminho = new URL(requisicao.url()).pathname;
  if (requisicao.method() === 'OPTIONS') return route.fulfill(SEM_CONTEUDO);
  if (requisicao.method() === 'GET') return ler(route, servidor, caminho);
  return escrever(route, servidor, caminho);
}

/** Serve o processo do cenário e guarda o que a tela grava, devolvendo-o nas leituras seguintes. */
export async function mockarServidorDosTiposDeDecisao(
  page: Page,
  servidor: ServidorDosTiposDeDecisao,
): Promise<void> {
  await mockarCatalogos(page);
  await page.route(ROTA_DO_PROCESSO, (route: Route) => atender(route, servidor));
}
