import Ajv2020 from 'ajv/dist/2020';
import { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { Operation, OpenAPIBackend } from 'openapi-backend';
import { DivergenciaDoContrato } from './divergencia-do-contrato.testing';
import { PedidoConferido } from './conferir-pedido.testing';

export interface RespostaDoContrato {
  readonly codigo: number;
  readonly tipoDeConteudo?: string | null;
  readonly corpo: unknown;
}

function conteudoDaResposta(operacao: Operation, codigo: string) {
  const resposta = operacao.responses?.[codigo];
  return resposta && !('$ref' in resposta) ? resposta.content : undefined;
}

export function tipoAceitoEmSucesso(
  operacao: Operation,
  aceito: string | null,
): string | undefined {
  if (!aceito) return undefined;
  const tipos = aceito.split(',').map((tipo) => tipo.split(';')[0].trim());
  return Object.keys(operacao.responses ?? {})
    .filter((codigo) => codigo.startsWith('2'))
    .flatMap((codigo) => Object.keys(conteudoDaResposta(operacao, codigo) ?? {}))
    .find((tipo) => tipos.includes(tipo));
}

function esquemaDaResposta(operacao: Operation, resposta: RespostaDoContrato) {
  const tipo = resposta.tipoDeConteudo?.split(';')[0].trim().toLowerCase();
  return tipo ? conteudoDaResposta(operacao, String(resposta.codigo))?.[tipo]?.schema : undefined;
}

const validadores = new WeakMap<
  OpenAPIBackend,
  { ajv: Ajv2020; esquemas: WeakMap<object, ValidateFunction | null> }
>();

function validadoresDoDocumento(conferidor: OpenAPIBackend) {
  const existente = validadores.get(conferidor);
  if (existente) return existente;
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const criado = { ajv, esquemas: new WeakMap<object, ValidateFunction | null>() };
  validadores.set(conferidor, criado);
  return criado;
}

function corpoValido(conferidor: OpenAPIBackend, esquema: object, corpo: unknown): boolean {
  const { ajv, esquemas } = validadoresDoDocumento(conferidor);
  let validar = esquemas.get(esquema);
  try {
    if (validar === undefined) {
      validar = ajv.compile({ ...esquema, components: conferidor.definition.components });
      esquemas.set(esquema, validar);
    }
    return validar ? validar(corpo) : false;
  } catch {
    esquemas.set(esquema, null);
    return false;
  }
}

export function conferirResposta(
  pedido: PedidoConferido,
  resposta: RespostaDoContrato,
): DivergenciaDoContrato[] {
  const { conferidor, operacao } = pedido;
  if (!conferidor || !operacao) return [];
  const esquema = esquemaDaResposta(operacao, resposta);
  const regra = respostaSemConteudo(operacao, resposta)
    ? undefined
    : regraDaResposta(conferidor, esquema, resposta.corpo);
  return regra
    ? [{ metodo: operacao.method.toUpperCase(), caminho: operacao.path, campo: 'resposta', regra }]
    : [];
}

function respostaSemConteudo(operacao: Operation, resposta: RespostaDoContrato): boolean {
  const declaracao = operacao.responses?.[String(resposta.codigo)];
  return !!declaracao && !('$ref' in declaracao) && !declaracao.content && resposta.corpo == null;
}

function regraDaResposta(
  conferidor: OpenAPIBackend,
  esquema: object | undefined,
  corpo: unknown,
): string | undefined {
  if (!esquema) return 'esquema de resposta não declarado';
  return corpoValido(conferidor, esquema, corpo) ? undefined : 'corpo fora do contrato';
}
