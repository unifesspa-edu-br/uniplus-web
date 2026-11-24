import type { JsonDaApi } from '@uniplus/shared-e2e';
import type { Page, Route } from '@playwright/test';
import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { responder, responderPreflight, servirLeitura } from './escritas-retidas';

/** API mockada da Fase canônica para os specs que só leem a lista e capturam a atualização. */

/** A fase sem nada admitido nem coletado; o teste troca só o que mede. */
const FASE_SEM_SINALIZADORES: JsonDaApi<FaseCanonicaDto> = {
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: false,
  permiteComplementacao: false,
  admiteAgruparEtapas: false,
  admiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: { codigo: 'NO_EDITAL', rotulo: 'Definida no edital' },
  criadoEm: '2026-06-10T12:00:00Z',
};

export function faseCanonica(
  parcial: Partial<JsonDaApi<FaseCanonicaDto>> = {},
): JsonDaApi<FaseCanonicaDto> {
  return { ...FASE_SEM_SINALIZADORES, ...parcial };
}

/** O catálogo de fases da API, na ordem dela: as que os specs de precedência escolhem. */
const CATALOGO_DE_FASES = [
  { codigo: 'INSCRICAO', nome: 'Inscrição' },
  { codigo: 'HOMOLOGACAO', nome: 'Homologação' },
  { codigo: 'AVALIACAO', nome: 'Avaliação' },
  { codigo: 'CLASSIFICACAO', nome: 'Classificação' },
  { codigo: 'RESULTADO_FINAL', nome: 'Resultado final' },
];

/** Serve o catálogo de fases que a página de precedências lê a cada abertura. */
export const mockCatalogoDeFases = (page: Page): Promise<void> =>
  servirLeitura(page, /\/api\/configuracao\/vocabularios\/fases-canonicas$/, CATALOGO_DE_FASES);

function aoAtualizar(atualizacoes: unknown[]) {
  return (route: Route): Promise<void> => {
    if (route.request().method() === 'OPTIONS') return responderPreflight(route);
    atualizacoes.push(route.request().postDataJSON());
    return responder(route, { status: 204 });
  };
}

/** Serve `fases` e a lista vazia de unidades; devolve o corpo de cada atualização recebida. */
export async function mockApiDeFasesCanonicas(
  page: Page,
  fases: readonly JsonDaApi<FaseCanonicaDto>[],
): Promise<unknown[]> {
  const atualizacoes: unknown[] = [];
  await servirLeitura(page, /\/api\/configuracao\/fases-canonicas(\?.*)?$/, fases);
  await servirLeitura(page, /\/api\/organizacao\/unidades(\?.*)?$/, []);
  await page.route(
    /\/api\/configuracao\/admin\/fases-canonicas\/[^/?]+$/,
    aoAtualizar(atualizacoes),
  );
  return atualizacoes;
}
