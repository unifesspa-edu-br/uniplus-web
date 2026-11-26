import type { Page, Request, Route } from '@playwright/test';
import type {
  MinhaInscricaoDto,
  MotivoDasInscricoesFechadasCodigo,
  SituacaoInscricaoCodigo,
} from '@uniplus/shared-data/selecao';

const ROTULO_DO_MOTIVO = {
  PERIODO_ENCERRADO: 'Período de inscrição encerrado',
  PERIODO_NAO_INICIADO: 'Período de inscrição não iniciado',
} as const;

export interface CursoEscolhido {
  readonly nome: string;
  readonly grau: string;
}

export interface RascunhoSemContinuar {
  readonly indice: number;
  readonly nomeDoProcesso: string;
  readonly motivo: keyof typeof ROTULO_DO_MOTIVO;
  readonly cursos: readonly CursoEscolhido[];
}

const SEM_ACOES: MinhaInscricaoDto['acoes'] = {
  podeContinuar: false,
  podeCorrigir: false,
  podeCancelar: false,
  podeDescartar: false,
};

function opcoesDeCurso(cursos: readonly CursoEscolhido[]): MinhaInscricaoDto['opcoesDeCurso'] {
  return cursos.map(({ nome, grau }, posicao) => ({
    ordem: posicao + 1,
    cursoNome: nome,
    cursoGrau: grau,
  }));
}

function motivoInformado(
  motivo: RascunhoSemContinuar['motivo'],
): MinhaInscricaoDto['motivoDasInscricoesFechadas'] {
  return {
    codigo: motivo as MotivoDasInscricoesFechadasCodigo,
    rotulo: ROTULO_DO_MOTIVO[motivo],
  };
}

function identificacaoDaInscricao(
  indice: number,
): Pick<MinhaInscricaoDto, 'inscricaoId' | 'processoSeletivoId'> {
  const sufixo = String(indice).padStart(12, '0');
  return {
    inscricaoId: `01960000-0000-7000-0001-${sufixo}`,
    processoSeletivoId: `01960000-0000-7000-0002-${sufixo}`,
  };
}

/**
 * O rascunho que a API não deixa continuar, com o motivo que ela informa. Os enums do contrato só
 * entram como tipo: importá-los como valor carrega o Angular no processo do Playwright.
 */
export function rascunhoSemContinuar(dados: RascunhoSemContinuar): MinhaInscricaoDto {
  return {
    ...identificacaoDaInscricao(dados.indice),
    nomeDoProcesso: dados.nomeDoProcesso,
    numeroInscricao: null,
    situacao: { codigo: 'RASCUNHO' as SituacaoInscricaoCodigo, rotulo: 'Rascunho' },
    opcoesDeCurso: opcoesDeCurso(dados.cursos),
    canceladaEm: null,
    motivoDoCancelamento: null,
    acoes: SEM_ACOES,
    motivoDasInscricoesFechadas: motivoInformado(dados.motivo),
    numeroDoUltimoComprovante: null,
  };
}

const CAMINHO_DA_LISTA = /\/api\/selecao\/minhas-inscricoes(\?.*)?$/;

/**
 * A API fica em outra origem e a requisição leva o token: a pré-checagem do navegador recebe de
 * volta os mesmos cabeçalhos que pediu, para a simulação não depender de quais o portal envia.
 */
function cabecalhosDeCors(pedido: Request): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers':
      pedido.headers()['access-control-request-headers'] ?? 'authorization, accept',
  };
}

/** Só a leitura da lista e a pré-checagem são simuladas; qualquer outro método segue à rede. */
function responderLista(rota: Route, inscricoes: readonly MinhaInscricaoDto[]): Promise<void> {
  const metodo = rota.request().method();
  if (metodo !== 'GET' && metodo !== 'OPTIONS') return rota.fallback();
  const headers = cabecalhosDeCors(rota.request());
  if (metodo === 'OPTIONS') return rota.fulfill({ status: 204, headers });
  return rota.fulfill({
    status: 200,
    contentType: 'application/vnd.uniplus.minhas-inscricoes.v1+json',
    headers,
    body: JSON.stringify(inscricoes),
  });
}

/** Responde `GET /api/selecao/minhas-inscricoes` com as inscrições informadas. */
export async function simularMinhasInscricoes(
  page: Page,
  inscricoes: readonly MinhaInscricaoDto[],
): Promise<void> {
  await page.route(CAMINHO_DA_LISTA, (rota) => responderLista(rota, inscricoes));
}
