import { PAPEL_DEFINITIVO } from '../fixtures/valor-do-enum';
import type { Page, Route } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import type { FaseCronogramaDto } from '@uniplus/shared-data/selecao';
import { comProdutoNaFase } from '../fixtures/cronograma-do-servidor';
import { FUNDAMENTOS_DE_ISENCAO, TIPOS_DE_PROCESSO } from '../fixtures/consulta-da-medicina';
import {
  FASES_CANONICAS,
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
} from '../fixtures/processo-publicado-completo';
import { CORS_HEADERS, mockarTiposAto } from './api-da-revisao';
import { leituraDoProcessoCompleto } from './leituras-do-processo-completo';
import { PERMISSOES_DO_LEANDRO } from './permissoes';
import {
  ROTA_DO_VOCABULARIO_DE_TIPOS_DE_DECISAO,
  VOCABULARIO_DE_TIPOS_DE_DECISAO,
} from './vocabulario-de-tipos-de-decisao';

const CORS_DE_ESCRITA = {
  ...CORS_HEADERS,
  'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
  'access-control-allow-headers': '*',
};

const ROTA_DO_PROCESSO_COMPLETO = new RegExp(
  `/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}`,
);

const IGUALDADE = [
  { codigo: 'IGUAL', rotulo: 'é' },
  { codigo: 'DIFERENTE', rotulo: 'não é' },
];

const FATO_DECLARADO = {
  descricao: null,
  origem: { codigo: 'DECLARADO', rotulo: 'Declarado' },
  cardinalidade: { codigo: 'VALOR_UNICO', rotulo: 'Valor único' },
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  valoresDominioDeclarados: null,
};

const DOMINIO_DATA = { codigo: 'DATA', rotulo: 'Data' };
const DOMINIO_SIM_OU_NAO = { codigo: 'SIM_OU_NAO', rotulo: 'Sim ou não' };

/** A data não é citável em regra: a API devolve a lista de operadores vazia. */
function fatoDoFormulario(codigo: string) {
  const data = codigo === 'DATA_NASCIMENTO';
  return {
    fato: {
      ...FATO_DECLARADO,
      id: `fato-${codigo}`,
      codigo,
      nome: codigo,
      dominio: data ? DOMINIO_DATA : DOMINIO_SIM_OU_NAO,
      binding: `CAMPO_INSCRICAO:${codigo}`,
    },
    operadoresAdmitidos: data ? [] : IGUALDADE,
  };
}

const FATOS_DO_FORMULARIO = ['DATA_NASCIMENTO', 'OPTOU_PELAS_COTAS_DA_LEI', 'MODALIDADE'].map(
  fatoDoFormulario,
);

const ITEM_DA_ESCALA_PENDENTE = {
  codigo: 'classificacao_escala_nota_final_nao_declarada',
  dimensao: 'classificacao',
  mensagem: 'Escala da nota final (fórmula local)',
  ok: false,
};

/** A causa que a recusa traz em `errors[]`: o ponteiro do campo, sem ligação com o item do checklist. */
export const CAUSA_DA_ESCALA_PENDENTE = {
  field: '/classificacao/escalaNotaFinal',
  code: 'uniplus.selecao.processo_seletivo.conformidade_insuficiente',
  message: 'A escala da nota final não foi declarada.',
};

const PRODUTO_DEFINITIVO = {
  id: '01960000-0000-7000-0000-0000000009d1',
  atoCodigo: 'RESULTADO_DEFINITIVO',
  papel: PAPEL_DEFINITIVO,
};

/**
 * O que o servidor recebeu: a classificação gravada (PUT), se alguma publicação foi tentada e se
 * ela foi aceita.
 */
export interface PublicacaoRecebida {
  classificacao: Record<string, unknown> | null;
  tentouPublicar: boolean;
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
  await servir(page, ROTA_DO_VOCABULARIO_DE_TIPOS_DE_DECISAO, VOCABULARIO_DE_TIPOS_DE_DECISAO);
  await mockarTiposAto(page);
}

const comProdutoDefinitivo = (fase: FaseCronogramaDto) =>
  comProdutoNaFase(fase, PRODUTO_DEFINITIVO);

function detalheDoProcesso(recebido: PublicacaoRecebida): unknown {
  return comFaseDeInscricao({
    ...PROCESSO_PUBLICADO_COMPLETO,
    atendimentoEspecializado: null,
    cascata: null,
    cronogramaFases: PROCESSO_PUBLICADO_COMPLETO.cronogramaFases.map(comProdutoDefinitivo),
    situacao: recebido.publicou
      ? { codigo: 'PUBLICADO', rotulo: 'Publicado' }
      : { codigo: 'RASCUNHO', rotulo: 'Rascunho' },
    classificacao: classificacaoComEscala(recebido),
  });
}

function classificacaoComEscala(recebido: PublicacaoRecebida) {
  return {
    ...PROCESSO_PUBLICADO_COMPLETO.classificacao,
    regrasEliminacao: [],
    escalaNotaFinal: recebido.classificacao?.['escalaNotaFinal'] ?? null,
  };
}

/**
 * O checklist estrutural: sem pendência até a primeira tentativa de publicar, e depois dela, com a
 * escala pendente enquanto a classificação gravada não a declara. É o servidor que mudou de estado
 * entre a leitura da tela e a publicação, e só uma releitura mostra o item.
 */
function checklistEstrutural(recebido: PublicacaoRecebida): unknown {
  const escalaPendente =
    recebido.tentouPublicar && recebido.classificacao?.['escalaNotaFinal'] == null;
  return {
    processoSeletivoId: ID_DO_PROCESSO_COMPLETO,
    itens: escalaPendente ? [ITEM_DA_ESCALA_PENDENTE] : [],
    avisos: [],
  };
}

function leitura(recebido: PublicacaoRecebida, caminho: string): unknown {
  if (caminho.endsWith(ID_DO_PROCESSO_COMPLETO)) return detalheDoProcesso(recebido);
  if (caminho.endsWith('/conformidade')) return checklistEstrutural(recebido);
  return leituraDoProcessoCompleto(caminho);
}

async function ler(route: Route, recebido: PublicacaoRecebida, caminho: string): Promise<void> {
  const corpo = leitura(recebido, caminho);
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
      errors: [CAUSA_DA_ESCALA_PENDENTE],
    }),
  });
}

async function publicar(route: Route, recebido: PublicacaoRecebida): Promise<void> {
  recebido.tentouPublicar = true;
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
 * O processo completo em rascunho, sem a escala na classificação: a publicação é recusada, com a
 * causa em `errors[]`, enquanto a classificação gravada (PUT) não declara a escala, e aceita
 * depois. O checklist só traz a escala pendente depois da primeira tentativa de publicar. Devolve
 * o que o servidor recebeu, para o teste conferir o corpo.
 */
export async function mockarPublicacaoComEscalaPendente(page: Page): Promise<PublicacaoRecebida> {
  const recebido: PublicacaoRecebida = {
    classificacao: null,
    tentouPublicar: false,
    publicou: false,
  };
  await mockarCatalogos(page);
  await page.route(ROTA_DO_PROCESSO_COMPLETO, (route) => atenderOProcesso(route, recebido));
  return recebido;
}
