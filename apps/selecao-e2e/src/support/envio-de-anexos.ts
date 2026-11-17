import type { Page, Route } from '@playwright/test';
import {
  ARMAZENAMENTO,
  documentoConfirmadoDoEnvio,
  idDoDocumentoEnviado,
  iniciacaoDoEnvio,
} from '../fixtures/envio-de-anexos';
import { PROCESSO_ID } from '../fixtures/processo-da-revisao';
import { responderCom } from './responder';

const CABECALHOS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type, idempotency-key',
  'access-control-expose-headers': 'ETag',
};

const ROTA_DOS_DOCUMENTOS = new RegExp(
  `/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-a-publicar(/.*)?$`,
);
const ROTA_DO_ARMAZENAMENTO = `${ARMAZENAMENTO}/anexos/*`;

interface PedidoDeIniciacao {
  readonly nomeArquivo: string;
  readonly tipoDeMidia: string;
}

/** O PUT que o storage recebeu: de qual arquivo e com qual content type. */
export interface BytesRecebidos {
  readonly nomeArquivo: string;
  readonly contentType: string;
}

/**
 * Os três passos do envio de um anexo (iniciação, PUT na URL assinada, confirmação), respondidos
 * sem API nem storage, e o registro do que cada passo recebeu, na ordem em que chegou.
 *
 * Instale depois de `mockarProcesso`: a leitura da lista de documentos cai nele (`fallback`), e
 * só os POSTs de iniciação e confirmação são daqui.
 */
export class EnvioDeAnexosMockado {
  readonly iniciados: string[] = [];
  readonly recebidos: BytesRecebidos[] = [];
  readonly confirmados: string[] = [];

  private readonly pedidos = new Map<string, PedidoDeIniciacao>();

  async instalar(page: Page): Promise<void> {
    await page.route(ROTA_DOS_DOCUMENTOS, (route) => this.atenderApi(route));
    await page.route(ROTA_DO_ARMAZENAMENTO, (route) => this.atenderStorage(route));
  }

  private async atenderApi(route: Route): Promise<void> {
    const requisicao = route.request();
    const caminho = new URL(requisicao.url()).pathname;
    if (requisicao.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CABECALHOS });
    } else if (requisicao.method() !== 'POST') {
      await route.fallback();
    } else if (caminho.endsWith('/confirmacao')) {
      await this.confirmar(route, idDoCaminho(caminho, 2));
    } else {
      await this.iniciar(route);
    }
  }

  private async iniciar(route: Route): Promise<void> {
    const pedido = route.request().postDataJSON() as PedidoDeIniciacao;
    const id = idDoDocumentoEnviado(this.pedidos.size);
    this.pedidos.set(id, pedido);
    this.iniciados.push(pedido.nomeArquivo);
    await responderCom(route, iniciacaoDoEnvio(id, pedido.tipoDeMidia), CABECALHOS);
  }

  private async confirmar(route: Route, id: string): Promise<void> {
    const pedido = this.pedidos.get(id);
    if (pedido === undefined) {
      await route.fulfill({ status: 404, headers: CABECALHOS });
      return;
    }
    this.confirmados.push(pedido.nomeArquivo);
    const documento = documentoConfirmadoDoEnvio(id, pedido.nomeArquivo, pedido.tipoDeMidia);
    await responderCom(route, documento, CABECALHOS);
  }

  private async atenderStorage(route: Route): Promise<void> {
    const requisicao = route.request();
    const pedido = this.pedidos.get(idDoCaminho(new URL(requisicao.url()).pathname, 1));
    if (requisicao.method() === 'PUT' && pedido !== undefined) {
      const contentType = requisicao.headers()['content-type'] ?? '';
      this.recebidos.push({ nomeArquivo: pedido.nomeArquivo, contentType });
      await route.fulfill({ status: 200, headers: { ...CABECALHOS, etag: '"etag-do-anexo"' } });
      return;
    }
    await route.fulfill({
      status: requisicao.method() === 'OPTIONS' ? 204 : 404,
      headers: CABECALHOS,
    });
  }
}

/** O segmento do caminho que identifica o documento, contado do fim. */
function idDoCaminho(caminho: string, posicaoDoFim: number): string {
  return caminho.split('/').at(-posicaoDoFim) ?? '';
}
