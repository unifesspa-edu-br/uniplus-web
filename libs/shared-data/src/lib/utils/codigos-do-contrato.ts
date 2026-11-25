import { codigoDoContrato } from './codigo-do-contrato';

type Enum = Record<string, string>;

/**
 * Os tradutores do código em texto para o membro do enum gerado do contrato, um para o operador e
 * outro para o tipo de renderização; cada um devolve `null` quando o contrato não conhece o código.
 */
export interface CodigosDoContrato<Operadores extends Enum, TiposDeCampo extends Enum> {
  readonly operador: (codigo: string) => Operadores[keyof Operadores] | null;
  readonly tipoDeCampo: (codigo: string) => TiposDeCampo[keyof TiposDeCampo] | null;
}

/** Cada módulo da API tem os próprios enums, por isso eles vêm por argumento. */
export function codigosDoContrato<Operadores extends Enum, TiposDeCampo extends Enum>(
  operadores: Operadores,
  tiposDeCampo: TiposDeCampo,
): CodigosDoContrato<Operadores, TiposDeCampo> {
  return {
    operador: (codigo) => codigoDoContrato(operadores, codigo),
    tipoDeCampo: (codigo) => codigoDoContrato(tiposDeCampo, codigo),
  };
}
