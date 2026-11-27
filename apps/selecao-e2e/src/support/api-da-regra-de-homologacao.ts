import type { Page, Route } from '@playwright/test';
import type {
  CondicaoDeHomologacaoDto,
  FaseCronogramaDto,
  RegraDeHomologacaoDto,
} from '@uniplus/shared-data/selecao';
import { comProdutoNaFase, comRegraDeHomologacaoNaFase } from '../fixtures/cronograma-do-servidor';
import {
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
} from '../fixtures/processo-publicado-completo';
import { situacaoDoProcesso } from '../fixtures/valor-do-enum';
import { CORS, mockarCatalogos, PRODUTO_DEFINITIVO, SEM_CONTEUDO } from './api-da-unidade-da-fase';
import { formulariosNaFase } from './formularios-na-fase';
import { leituraDoProcessoCompleto } from './leituras-do-processo-completo';
import { responder, responderCom } from './responder';

const ROTA_DO_CADASTRO_DE_MOTIVOS = /\/api\/selecao\/motivos-de-decisao(\?.*)?$/;
const ROTA_DO_PROCESSO = new RegExp(`/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}`);

type Enquadramento = NonNullable<CondicaoDeHomologacaoDto['enquadramento']>;
type CondicaoDoEnquadramento = Enquadramento[number][number];

/** O operador de igualdade como a API o devolve na leitura. */
export const IGUAL = 'IGUAL' as CondicaoDoEnquadramento['operador'];

/**
 * A regra que a fase declara: duas alternativas, a primeira com duas condições que valem juntas e
 * uma delas com enquadramento em duas cláusulas. Os valores são os que a API devolve na leitura.
 */
export const REGRA_DE_HOMOLOGACAO_DO_CENARIO: RegraDeHomologacaoDto = {
  resultadoAtoCodigo: 'RESULTADO_FINAL',
  alternativas: [
    {
      condicoes: [
        {
          tipo: 'RESULTADO_NO_RETORNO_DO_INEP',
          edicaoDoExame: 2025,
          motivoDesfavoravelCodigo: 'SEM_RESULTADO_INEP',
          enquadramento: [
            [{ fato: 'MODALIDADE', operador: IGUAL, valor: 'AC' }],
            [{ fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: IGUAL, valor: true }],
          ],
        },
        {
          tipo: 'RESULTADO_NO_RETORNO_DO_INEP',
          edicaoDoExame: 2024,
          motivoDesfavoravelCodigo: null,
          enquadramento: null,
        },
      ],
    },
    {
      condicoes: [
        {
          tipo: 'RESULTADO_NO_RETORNO_DO_INEP',
          edicaoDoExame: 2023,
          motivoDesfavoravelCodigo: 'SEM_RESULTADO_INEP',
          enquadramento: null,
        },
      ],
    },
  ],
};

/** As edições que a regra do cenário cita: o processo precisa declará-las para gravar a regra. */
const EDICOES_DA_REGRA_DO_CENARIO = ['2023', '2024', '2025'];

/** O que o servidor simulado guarda e o que a tela lhe enviou. */
export interface ServidorDaRegraDeHomologacao {
  fase: FaseCronogramaDto;
  /** As edições do ENEM que o processo declara na Fórmula, pela ordem declarada. */
  edicoesDoEnem: readonly string[];
  /** O cadastro de motivos de homologação e os que o processo escolheu, como a API os devolve. */
  readonly motivos: { cadastro: readonly unknown[]; escolhidos: readonly unknown[] };
  readonly cronogramasEnviados: { regraDeHomologacao: unknown }[][];
  readonly publicacoesEnviadas: unknown[];
  publicado: boolean;
}

/** O processo do cenário em rascunho, com a regra já declarada na única fase. */
export function novoServidorDaRegraDeHomologacao(): ServidorDaRegraDeHomologacao {
  const [primeira] = PROCESSO_PUBLICADO_COMPLETO.cronogramaFases;
  const comResultado = comProdutoNaFase(primeira, PRODUTO_DEFINITIVO);
  return {
    fase: comRegraDeHomologacaoNaFase(comResultado, REGRA_DE_HOMOLOGACAO_DO_CENARIO),
    edicoesDoEnem: EDICOES_DA_REGRA_DO_CENARIO,
    motivos: { cadastro: [], escolhidos: [] },
    cronogramasEnviados: [],
    publicacoesEnviadas: [],
    publicado: false,
  };
}

function opcoesDasEdicoes(servidor: ServidorDaRegraDeHomologacao) {
  if (servidor.edicoesDoEnem.length === 0) return PROCESSO_PUBLICADO_COMPLETO.opcoesDeclaradas;
  const opcoes = servidor.edicoesDoEnem.map((ano, ordem) => ({
    codigo: ano,
    rotulo: `ENEM ${ano}`,
    ordem,
  }));
  return [{ fatoCodigo: 'EDICAO_ENEM', opcoes }];
}

function detalheDoProcesso(servidor: ServidorDaRegraDeHomologacao) {
  return {
    ...PROCESSO_PUBLICADO_COMPLETO,
    situacao: situacaoDoProcesso(servidor.publicado ? 'publicado' : 'rascunho'),
    cronogramaFases: [servidor.fase],
    formularios: formulariosNaFase(servidor.fase.id),
    opcoesDeclaradas: opcoesDasEdicoes(servidor),
    atendimentoEspecializado: null,
    regrasDeComprovacao: PROCESSO_PUBLICADO_COMPLETO.regrasDeComprovacao.slice(0, 1),
    classificacao: { ...PROCESSO_PUBLICADO_COMPLETO.classificacao, regrasEliminacao: [] },
  };
}

function corpoDaLeitura(servidor: ServidorDaRegraDeHomologacao, caminho: string): unknown {
  return caminho.endsWith(ID_DO_PROCESSO_COMPLETO)
    ? detalheDoProcesso(servidor)
    : leituraDoProcessoCompleto(caminho);
}

async function ler(route: Route, servidor: ServidorDaRegraDeHomologacao, caminho: string) {
  const corpo = caminho.endsWith('/motivos-de-decisao')
    ? servidor.motivos.escolhidos
    : corpoDaLeitura(servidor, caminho);
  if (corpo === undefined) await route.fulfill({ status: 404, headers: CORS });
  else await responderCom(route, corpo, CORS);
}

/** O servidor guarda a regra que recebeu: a que a tela mandar é a que a leitura seguinte devolve. */
async function gravarCronograma(
  route: Route,
  servidor: ServidorDaRegraDeHomologacao,
  corpo: { regraDeHomologacao: unknown }[],
): Promise<void> {
  servidor.cronogramasEnviados.push(corpo);
  const regra = corpo[0]?.regraDeHomologacao as RegraDeHomologacaoDto | null | undefined;
  servidor.fase = comRegraDeHomologacaoNaFase(servidor.fase, regra ?? null);
  await route.fulfill(SEM_CONTEUDO);
}

async function escrever(route: Route, servidor: ServidorDaRegraDeHomologacao, caminho: string) {
  const corpo = route.request().postDataJSON();
  if (caminho.endsWith('/cronograma-fases')) return gravarCronograma(route, servidor, corpo);
  if (caminho.endsWith('/publicacao')) {
    servidor.publicacoesEnviadas.push(corpo);
    servidor.publicado = true;
    return route.fulfill(SEM_CONTEUDO);
  }
  if (caminho.endsWith('/distribuicao-vagas/simulacao')) {
    return responderCom(route, PROCESSO_PUBLICADO_COMPLETO.distribuicaoVagas, CORS);
  }
  return route.fulfill(SEM_CONTEUDO);
}

async function atender(route: Route, servidor: ServidorDaRegraDeHomologacao): Promise<void> {
  const requisicao = route.request();
  const caminho = new URL(requisicao.url()).pathname;
  if (requisicao.method() === 'OPTIONS') return route.fulfill(SEM_CONTEUDO);
  if (requisicao.method() === 'GET') return ler(route, servidor, caminho);
  return escrever(route, servidor, caminho);
}

/** Serve o processo do cenário e guarda o que a tela grava e publica, devolvendo-o nas leituras. */
export async function mockarServidorDaRegraDeHomologacao(
  page: Page,
  servidor: ServidorDaRegraDeHomologacao,
): Promise<void> {
  await mockarCatalogos(page);
  await responder(page, ROTA_DO_CADASTRO_DE_MOTIVOS, () => servidor.motivos.cadastro, CORS);
  await page.route(ROTA_DO_PROCESSO, (route: Route) => atender(route, servidor));
}
