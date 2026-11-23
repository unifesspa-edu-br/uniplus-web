import type { Page, Route } from '@playwright/test';
import type { RegraDeComprovacaoInformada } from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';
import { ID_DO_PROCESSO_COMPLETO } from '../fixtures/processo-publicado-completo';
import { CORS, SEM_CONTEUDO, problema, recusar } from './api-da-unidade-da-fase';

const ROTA_DAS_EXIGENCIAS = new RegExp(
  `/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}/documentos-exigidos$`,
);

export interface ExigenciasGravadas {
  readonly corpos: JsonDaApi<readonly RegraDeComprovacaoInformada[]>[];
  /** O código com que o servidor recusa o PUT; nulo, ele grava. */
  codigoDaRecusa: string | null;
  campoDaRecusa: string;
  mensagemDaRecusa: string;
}

async function gravarAsExigencias(route: Route, gravadas: ExigenciasGravadas): Promise<void> {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const corpo: JsonDaApi<readonly RegraDeComprovacaoInformada[]> = requisicao.postDataJSON();
  gravadas.corpos.push(corpo);
  if (gravadas.codigoDaRecusa === null) return route.fulfill(SEM_CONTEUDO);
  const erro = {
    field: gravadas.campoDaRecusa,
    code: gravadas.codigoDaRecusa,
    message: gravadas.mensagemDaRecusa,
  };
  return recusar(route, problema(422, 'uniplus.validacao', 'Validação', [erro]));
}

/**
 * Captura o `PUT /documentos-exigidos`. Registrada depois das rotas do processo, porque o
 * Playwright consulta as rotas da mais recente para a mais antiga.
 */
export async function capturarAsExigencias(page: Page): Promise<ExigenciasGravadas> {
  const gravadas: ExigenciasGravadas = {
    corpos: [],
    codigoDaRecusa: null,
    campoDaRecusa: '[0].documento.tipoDocumento.id',
    mensagemDaRecusa: 'x',
  };
  await page.route(ROTA_DAS_EXIGENCIAS, (route) => gravarAsExigencias(route, gravadas));
  return gravadas;
}
