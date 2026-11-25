import { OpenAPIBackend, Operation, Request } from 'openapi-backend';
import { DivergenciaDoContrato } from './divergencia-do-contrato.testing';
import { contratoDoCaminho } from './documentos-do-contrato.testing';

export interface PedidoConferido {
  readonly conferidor?: OpenAPIBackend;
  readonly operacao?: Operation;
  readonly divergencias: readonly DivergenciaDoContrato[];
}

function divergencia(pedido: Request, caminho: string, regra: string): DivergenciaDoContrato {
  return { metodo: pedido.method.toUpperCase(), caminho, campo: 'pedido', regra };
}

export function conferirPedidoNoDocumento(
  conferidor: OpenAPIBackend,
  pedido: Request,
): PedidoConferido {
  const operacao = conferidor.matchOperation(pedido);
  if (!operacao)
    return { divergencias: [divergencia(pedido, '/api/{...}', 'operação não encontrada')] };
  if (!operacao.operationId) {
    return { divergencias: [divergencia(pedido, operacao.path, 'operação sem operationId')] };
  }
  return resultadoDoPedido(conferidor, pedido, operacao);
}

function resultadoDoPedido(
  conferidor: OpenAPIBackend,
  pedido: Request,
  operacao: Operation,
): PedidoConferido {
  const valido = conferidor.validateRequest(pedido, operacao).valid;
  const tipoValido = tipoDeConteudoDeclarado(pedido, operacao);
  const divergencias: DivergenciaDoContrato[] = [];
  if (!valido) divergencias.push(divergencia(pedido, operacao.path, 'pedido fora do contrato'));
  if (!tipoValido)
    divergencias.push(divergencia(pedido, operacao.path, 'tipo de conteúdo não declarado'));
  return { conferidor, operacao, divergencias };
}

function tipoDeConteudoDeclarado(pedido: Request, operacao: Operation): boolean {
  const corpo = operacao.requestBody;
  if (pedido.body == null || !corpo || !('content' in corpo) || !corpo.content) return true;
  const cabecalho = Object.entries(pedido.headers).find(
    ([nome]) => nome.toLowerCase() === 'content-type',
  );
  const valor = cabecalho?.[1];
  const tipo = normalizarTipo((Array.isArray(valor) ? valor[0] : valor) ?? '');
  return Object.keys(corpo.content).some((declarado) => normalizarTipo(declarado) === tipo);
}

function normalizarTipo(tipo: string): string {
  return tipo.split(';')[0].trim().toLowerCase();
}

export async function conferirPedido(pedido: Request): Promise<PedidoConferido> {
  const contrato = contratoDoCaminho(pedido.path);
  if (!contrato) {
    return {
      divergencias: [divergencia(pedido, '/api/{módulo}/{...}', 'módulo sem contrato disponível')],
    };
  }
  try {
    return conferirPedidoNoDocumento(await contrato, pedido);
  } catch {
    return {
      divergencias: [divergencia(pedido, '/api/{...}', 'não foi possível conferir o pedido')],
    };
  }
}
