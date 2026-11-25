import { test as base, Request, Response, Page } from '@playwright/test';
import {
  conferirPedido,
  conferirResposta,
  PedidoConferido,
  RegistroDeDivergencias,
  tipoAceitoEmSucesso,
} from '@uniplus/shared-testing/contrato';

function pertenceAApi(pedido: Request): boolean {
  return pedido.method() !== 'OPTIONS' && new URL(pedido.url()).pathname.startsWith('/api/');
}

function corpoDoPedido(pedido: Request): unknown {
  const texto = pedido.postData();
  if (!texto) return undefined;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return texto;
  }
}

async function conferirPedidoDaPagina(
  pedido: Request,
  registro: RegistroDeDivergencias,
): Promise<PedidoConferido> {
  const conferido = await conferirPedido({
    method: pedido.method(),
    path: pedido.url(),
    headers: pedido.headers(),
    body: corpoDoPedido(pedido),
  });
  registro.registrar(conferido.divergencias);
  return conferido;
}

async function corpoDaResposta(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return texto;
  }
}

async function conferirRespostaDaPagina(
  resposta: Response,
  pedido: Promise<PedidoConferido | undefined>,
  registro: RegistroDeDivergencias,
): Promise<void> {
  const codigo = resposta.status();
  const conteudo = resposta.headers()['content-type'];
  const aceito = resposta.request().headers()['accept'] ?? null;
  const [conferido, corpo] = await Promise.all([pedido, corpoDaResposta(resposta)]);
  if (!conferido) return;
  const tipo = conteudo ?? (conferido.operacao && tipoAceitoEmSucesso(conferido.operacao, aceito));
  registro.registrar(conferirResposta(conferido, { codigo, tipoDeConteudo: tipo, corpo }));
}

type PedidosPendentes = Map<Request, (resposta?: Response) => void>;

function criarObservadorDePedidos(pedidos: PedidosPendentes, registro: RegistroDeDivergencias) {
  return (pedido: Request) => {
    if (!pertenceAApi(pedido)) return;
    const conferido = registro.acompanhar(conferirPedidoDaPagina(pedido, registro));
    const resposta = new Promise<Response | undefined>((resolver) => pedidos.set(pedido, resolver));
    registro.acompanhar(
      resposta.then((recebida) =>
        recebida
          ? conferirRespostaDaPagina(recebida, conferido, registro)
          : conferido.then(() => undefined),
      ),
    );
  };
}

export function acompanharPagina(page: Page, registro: RegistroDeDivergencias): () => void {
  const pedidos: PedidosPendentes = new Map();
  const aoPedir = criarObservadorDePedidos(pedidos, registro);
  const concluir = (pedido: Request, resposta?: Response) => {
    pedidos.get(pedido)?.(resposta);
    pedidos.delete(pedido);
  };
  const aoResponder = (resposta: Response) => concluir(resposta.request(), resposta);
  const aoFalhar = (pedido: Request) => concluir(pedido);
  page.on('request', aoPedir);
  page.on('response', aoResponder);
  page.on('requestfailed', aoFalhar);
  return () => encerrarObservacao(page, { aoPedir, aoResponder, aoFalhar }, pedidos);
}

function encerrarObservacao(
  page: Page,
  observadores: {
    aoPedir: (pedido: Request) => void;
    aoResponder: (resposta: Response) => void;
    aoFalhar: (pedido: Request) => void;
  },
  pedidos: PedidosPendentes,
): void {
  page.off('request', observadores.aoPedir);
  page.off('response', observadores.aoResponder);
  page.off('requestfailed', observadores.aoFalhar);
  pedidos.forEach((resolver) => resolver());
  pedidos.clear();
}

export const test = base.extend<{ conferenciaDoContrato: void }>({
  conferenciaDoContrato: [
    async ({ page }, usar) => {
      const registro = new RegistroDeDivergencias();
      const parar = acompanharPagina(page, registro);
      try {
        await usar();
      } finally {
        parar();
        await registro.encerrar();
      }
    },
    { auto: true },
  ],
});
