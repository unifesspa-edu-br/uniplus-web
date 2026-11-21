import type { Page, Route } from '@playwright/test';
import type { NoExigenciaInput } from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';
import { ID_DO_PROCESSO_COMPLETO } from '../fixtures/processo-publicado-completo';
import { CORS, SEM_CONTEUDO, problema, recusar } from './api-da-unidade-da-fase';

const ROTA_DAS_EXIGENCIAS = new RegExp(
  `/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}/documentos-exigidos$`,
);

export interface ExigenciasGravadas {
  readonly corpos: JsonDaApi<readonly NoExigenciaInput[]>[];
  /** O código com que o servidor recusa o PUT; nulo, ele grava. */
  codigoDaRecusa: string | null;
}

async function gravarAsExigencias(route: Route, gravadas: ExigenciasGravadas): Promise<void> {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const corpo: JsonDaApi<readonly NoExigenciaInput[]> = requisicao.postDataJSON();
  gravadas.corpos.push(corpo);
  if (gravadas.codigoDaRecusa === null) return route.fulfill(SEM_CONTEUDO);
  const erro = {
    field: '[0].documento.tipoDocumento.id',
    code: gravadas.codigoDaRecusa,
    message: 'x',
  };
  return recusar(route, problema(422, 'uniplus.validacao', 'Validação', [erro]));
}

/**
 * Captura o `PUT /documentos-exigidos`. Registrada depois das rotas do processo, porque o
 * Playwright consulta as rotas da mais recente para a mais antiga.
 */
export async function capturarAsExigencias(page: Page): Promise<ExigenciasGravadas> {
  const gravadas: ExigenciasGravadas = { corpos: [], codigoDaRecusa: null };
  await page.route(ROTA_DAS_EXIGENCIAS, (route) => gravarAsExigencias(route, gravadas));
  return gravadas;
}
