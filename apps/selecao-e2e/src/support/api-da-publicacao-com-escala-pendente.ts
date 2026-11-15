import type { Page, Route } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { FUNDAMENTOS_DE_ISENCAO, TIPOS_DE_PROCESSO } from '../fixtures/consulta-da-medicina';
import {
  FASES_CANONICAS,
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
} from '../fixtures/processo-publicado-completo';
import { CORS_HEADERS, mockarTiposAto } from './api-da-revisao';
import { leituraDoProcessoCompleto } from './leituras-do-processo-completo';
import { PERMISSOES_DO_LEANDRO } from './permissoes';

const CORS_DE_ESCRITA = {
  ...CORS_HEADERS,
  'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
  'access-control-allow-headers': '*',
};

const ROTA_DO_PROCESSO_COMPLETO = new RegExp(
  `/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}`,
);

const FATOS_DO_FORMULARIO = ['DATA_NASCIMENTO', 'OPTOU_PELAS_COTAS_DA_LEI', 'MODALIDADE'].map(
  (codigo) => ({
    id: `fato-${codigo}`,
    codigo,
    nome: codigo,
    descricao: null,
    dominio: codigo === 'DATA_NASCIMENTO' ? 'DATA' : 'BOOLEANO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: null,
    pontoResolucao: 'INSCRICAO',
    binding: `CAMPO_INSCRICAO:${codigo}`,
    valoresDominioDeclarados: null,
  }),
);

const PENDENCIA_DA_ESCALA = {
  codigo: 'classificacao_escala_nota_final_nao_declarada',
  dimensao: 'classificacao',
  mensagem: 'Escala da nota final (fórmula local)',
};

const PRODUTO_DEFINITIVO = {
  id: '01960000-0000-7000-0000-0000000009d1',
  atoCodigo: 'RESULTADO_DEFINITIVO',
  papel: 'DEFINITIVO',
};

type FaseDoProcesso = (typeof PROCESSO_PUBLICADO_COMPLETO.cronogramaFases)[number];

/** O que o servidor recebeu: a classificação gravada (PUT) e se a publicação foi aceita. */
export interface PublicacaoRecebida {
  classificacao: Record<string, unknown> | null;
  publicou: boolean;
}

/**
 * O fixture chama de COLETA_INSCRICAO a fase que o catálogo de fatos situa em INSCRICAO: o teste
 * unifica o código para o cronograma ter a fase em que a modalidade é conhecida.
 */
function comFaseDeInscricao<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor).replaceAll('COLETA_INSCRICAO', 'INSCRICAO'));
}

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_DE_ESCRITA,
    ...(corpo === undefined
      ? {}
      : { contentType: 'application/json', body: JSON.stringify(corpo) }),
  });
}

async function servir(page: Page, rota: RegExp, corpo: unknown): Promise<void> {
  await page.route(rota, (route) => responder(route, 200, corpo));
}

async function mockarCatalogos(page: Page): Promise<void> {
  await servir(page, /\/api\//, []);
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
  await servir(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_DE_PROCESSO);
  await servir(
    page,
    /\/api\/configuracao\/fases-canonicas(\?.*)?$/,
    comFaseDeInscricao(FASES_CANONICAS),
  );
  await servir(page, /\/api\/selecao\/fundamentos-isencao(\?.*)?$/, FUNDAMENTOS_DE_ISENCAO);
  await servir(page, /\/api\/configuracao\/fatos-candidato(\?.*)?$/, FATOS_DO_FORMULARIO);
  await mockarTiposAto(page);
}

const comProdutoDefinitivo = (fase: FaseDoProcesso) => ({
  ...fase,
  produtos: [...fase.produtos, PRODUTO_DEFINITIVO],
});

function detalheDoProcesso(recebido: PublicacaoRecebida): unknown {
  const escala = recebido.classificacao?.['escalaNotaFinal'] ?? null;
  return comFaseDeInscricao({
    ...PROCESSO_PUBLICADO_COMPLETO,
    atendimentoEspecializado: null,
    cascata: null,
    cronogramaFases: PROCESSO_PUBLICADO_COMPLETO.cronogramaFases.map(comProdutoDefinitivo),
    status: recebido.publicou ? 'publicado' : 'rascunho',
    classificacao: {
      ...PROCESSO_PUBLICADO_COMPLETO.classificacao,
      regrasEliminacao: [],
      escalaNotaFinal: escala,
    },
  });
}

async function ler(route: Route, recebido: PublicacaoRecebida, caminho: string): Promise<void> {
  const corpo = caminho.endsWith(ID_DO_PROCESSO_COMPLETO)
    ? detalheDoProcesso(recebido)
    : leituraDoProcessoCompleto(caminho);
  if (corpo === undefined) await responder(route, 404);
  else await responder(route, 200, corpo);
}

async function recusarPorEscalaPendente(route: Route): Promise<void> {
  await route.fulfill({
    status: 422,
    contentType: 'application/problem+json',
    headers: { ...CORS_HEADERS, 'access-control-allow-headers': '*' },
    body: JSON.stringify({
      type: 'about:blank',
      title: 'O processo tem pendências estruturais',
      status: 422,
      code: 'uniplus.selecao.processo_seletivo.conformidade_insuficiente',
      traceId: 'trace-e2e',
      pendencias: [PENDENCIA_DA_ESCALA],
    }),
  });
}

async function publicar(route: Route, recebido: PublicacaoRecebida): Promise<void> {
  if (recebido.classificacao?.['escalaNotaFinal'] == null) {
    await recusarPorEscalaPendente(route);
    return;
  }
  recebido.publicou = true;
  await responder(route, 201);
}

async function gravarClassificacao(route: Route, recebido: PublicacaoRecebida): Promise<void> {
  recebido.classificacao = route.request().postDataJSON();
  await responder(route, 204);
}

async function escrever(
  route: Route,
  recebido: PublicacaoRecebida,
  caminho: string,
): Promise<void> {
  const metodo = route.request().method();
  if (metodo === 'PUT' && caminho.endsWith('/classificacao')) {
    return gravarClassificacao(route, recebido);
  }
  if (metodo === 'POST' && caminho.endsWith('/distribuicao-vagas/simulacao')) {
    return responder(route, 200, PROCESSO_PUBLICADO_COMPLETO.distribuicaoVagas);
  }
  if (metodo === 'POST' && caminho.endsWith('/publicacao')) return publicar(route, recebido);
  return responder(route, 204);
}

async function atenderOProcesso(route: Route, recebido: PublicacaoRecebida): Promise<void> {
  const request = route.request();
  const caminho = new URL(request.url()).pathname;
  if (request.method() === 'OPTIONS') return responder(route, 204);
  if (request.method() === 'GET') return ler(route, recebido, caminho);
  return escrever(route, recebido, caminho);
}

/**
 * O processo completo em rascunho, sem a escala na classificação: a publicação é recusada com a
 * pendência da escala enquanto a classificação gravada (PUT) não a declara, e aceita depois.
 * Devolve o que o servidor recebeu, para o teste conferir o corpo.
 */
export async function mockarPublicacaoComEscalaPendente(page: Page): Promise<PublicacaoRecebida> {
  const recebido: PublicacaoRecebida = { classificacao: null, publicou: false };
  await mockarCatalogos(page);
  await page.route(ROTA_DO_PROCESSO_COMPLETO, (route) => atenderOProcesso(route, recebido));
  return recebido;
}
