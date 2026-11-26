export { conferirPedido, conferirPedidoNoDocumento } from './conferir-pedido.testing';
export type { PedidoConferido } from './conferir-pedido.testing';
export { conferirResposta, tipoAceitoEmSucesso } from './conferir-resposta.testing';
export type { RespostaDoContrato } from './conferir-resposta.testing';
export { criarConferidor } from './documentos-do-contrato.testing';
export { mensagemDasDivergencias } from './divergencia-do-contrato.testing';
export type { DivergenciaDoContrato } from './divergencia-do-contrato.testing';
export { RegistroDeDivergencias } from './registro-de-divergencias.testing';

export function codigoComRotulo<const Codigo extends string>(codigo: Codigo, rotulo: string) {
  return { codigo, rotulo };
}
