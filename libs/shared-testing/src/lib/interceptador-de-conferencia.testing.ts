import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { tap } from 'rxjs';
import { provedoresDeHttpComEnvelope } from '@uniplus/shared-core/http/interceptor-testing';
import {
  conferirPedido,
  conferirResposta,
  PedidoConferido,
  RegistroDeDivergencias,
  RespostaDoContrato,
} from './contrato/index.testing';

const registro = new RegistroDeDivergencias();

function cabecalhos(pedido: HttpRequest<unknown>): Record<string, string> {
  return Object.fromEntries(
    pedido.headers.keys().map((nome) => [nome, pedido.headers.get(nome) ?? '']),
  );
}

function copiarPedido(pedido: HttpRequest<unknown>) {
  return structuredClone({
    method: pedido.method,
    path: pedido.urlWithParams,
    headers: cabecalhos(pedido),
    body: pedido.body,
  });
}

function conferir(pedido: HttpRequest<unknown>): Promise<PedidoConferido | undefined> {
  try {
    const copia = copiarPedido(pedido);
    return registro.acompanhar(
      conferirPedido(copia).then((resultado) => {
        registro.registrar(resultado.divergencias);
        return resultado;
      }),
    );
  } catch {
    return registro.acompanhar(Promise.reject());
  }
}

function copiarResposta(resposta: HttpResponse<unknown> | HttpErrorResponse): RespostaDoContrato {
  return structuredClone({
    codigo: resposta.status,
    tipoDeConteudo: resposta.headers.get('Content-Type'),
    corpo: resposta instanceof HttpResponse ? resposta.body : resposta.error,
  });
}

function registrarResposta(
  pedido: Promise<PedidoConferido | undefined>,
  resposta: HttpResponse<unknown> | HttpErrorResponse,
): void {
  try {
    const copia = copiarResposta(resposta);
    registro.acompanhar(
      pedido.then((conferido) => {
        if (conferido) registro.registrar(conferirResposta(conferido, copia));
      }),
    );
  } catch {
    registro.acompanhar(Promise.reject());
  }
}

function observarResposta(pedido: Promise<PedidoConferido | undefined>) {
  return {
    next: (evento: HttpEvent<unknown>) => {
      if (evento instanceof HttpResponse) registrarResposta(pedido, evento);
    },
    error: (erro: unknown) => {
      if (erro instanceof HttpErrorResponse) registrarResposta(pedido, erro);
    },
  };
}

export const interceptadorDeConferencia: HttpInterceptorFn = (pedido, proximo) => {
  if (!new URL(pedido.url, 'http://localhost').pathname.startsWith('/api/')) return proximo(pedido);
  const conferido = conferir(pedido);
  return proximo(pedido).pipe(tap(observarResposta(conferido)));
};

export function provedoresDeHttpComConferencia() {
  return provedoresDeHttpComEnvelope(interceptadorDeConferencia);
}

export function encerrarConferenciaDoContrato(): Promise<void> {
  return registro.encerrar();
}
