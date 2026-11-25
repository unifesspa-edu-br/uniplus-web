import { EventEmitter } from 'node:events';
import { Page, Request, Response } from '@playwright/test';
import { RegistroDeDivergencias } from '@uniplus/shared-testing/contrato';
import { expect, it, vi } from 'vitest';
import { acompanharPagina } from './conferencia-do-contrato.testing';

function pedidoSimulado(): Request {
  return {
    method: () => 'GET',
    url: () => 'http://localhost/api/modulo-inexistente/unidades',
    headers: () => ({}),
    postData: () => null,
  } as Request;
}

function respostaSimulada(pedido: Request, aoLer: () => void): Response {
  return {
    request: () => pedido,
    status: () => 200,
    headers: () => ({ 'content-type': 'application/vnd.uniplus.unidade.v1+json' }),
    text: async () => {
      aoLer();
      return '{}';
    },
  } as unknown as Response;
}

function iniciarConferencia() {
  const pagina = new EventEmitter();
  const registro = new RegistroDeDivergencias();
  const parar = acompanharPagina(pagina as unknown as Page, registro);
  const pedido = pedidoSimulado();
  pagina.emit('request', pedido);
  return { pagina, registro, parar, pedido };
}

it('aguarda resposta tardia e remove os listeners ao encerrar', async () => {
  const { pagina, registro, parar, pedido } = iniciarConferencia();
  const terminou = vi.fn(parar);
  const encerramento = registro.encerrar().finally(terminou);
  await Promise.resolve();
  expect(terminou).not.toHaveBeenCalled();
  const leuResposta = vi.fn();
  const resposta = respostaSimulada(pedido, leuResposta);
  pagina.emit('response', resposta);
  await expect(encerramento).rejects.toThrow('módulo sem contrato disponível');
  expect(leuResposta).toHaveBeenCalledOnce();
  verificarListenersRemovidos(pagina);
  await expect(registro.encerrar()).resolves.toBeUndefined();
});

function verificarListenersRemovidos(pagina: EventEmitter): void {
  expect(pagina.listenerCount('request')).toBe(0);
  expect(pagina.listenerCount('response')).toBe(0);
  expect(pagina.listenerCount('requestfailed')).toBe(0);
}

it('libera a espera quando o pedido falha', async () => {
  const { pagina, registro, parar, pedido } = iniciarConferencia();
  const encerramento = registro.encerrar();
  pagina.emit('requestfailed', pedido);
  await expect(encerramento).rejects.toThrow('módulo sem contrato disponível');
  parar();
  expect(pagina.listenerCount('request')).toBe(0);
});

it('descarta a resposta ausente e mantém a conferência do pedido', async () => {
  const { pagina, registro, parar } = iniciarConferencia();
  parar();
  verificarListenersRemovidos(pagina);
  await expect(registro.encerrar()).rejects.toThrow('módulo sem contrato disponível');
  await expect(registro.encerrar()).resolves.toBeUndefined();
});

it('aguarda a leitura de uma resposta recebida antes do encerramento', async () => {
  const { pagina, registro, parar, pedido } = iniciarConferencia();
  const { resposta, liberar } = respostaComLeituraPendente(pedido);
  pagina.emit('response', resposta);
  parar();
  const terminou = vi.fn();
  const encerramento = registro.encerrar().finally(terminou);
  await Promise.resolve();
  expect(terminou).not.toHaveBeenCalled();
  liberar('{}');
  await expect(encerramento).rejects.toThrow('módulo sem contrato disponível');
});

function respostaComLeituraPendente(pedido: Request) {
  let liberar: (texto: string) => void = () => undefined;
  const leitura = new Promise<string>((resolver) => {
    liberar = resolver;
  });
  const resposta = respostaSimulada(pedido, () => undefined);
  resposta.text = () => leitura;
  return { resposta, liberar };
}
