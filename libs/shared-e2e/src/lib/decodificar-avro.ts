import { Type } from 'avsc';

export interface MensagemDecodificada {
  readonly registro: unknown;
  readonly bytes: Buffer;
}

type BuscaDeEsquema = (identificador: number) => Promise<string>;

/** Lê o envelope Confluent e guarda os esquemas consultados por identificador. */
export class DecodificadorAvro {
  private readonly esquemas = new Map<number, Type>();

  constructor(private readonly buscarEsquema: BuscaDeEsquema) {}

  async decodificar(bytes: Buffer): Promise<MensagemDecodificada> {
    if (bytes.length < 5 || bytes[0] !== 0) {
      throw new Error('Cabeçalho Avro inválido.');
    }
    const identificador = bytes.readUInt32BE(1);
    const esquema = await this.obterEsquema(identificador);
    const registro: unknown = esquema.fromBuffer(bytes.subarray(5));
    return { registro, bytes };
  }

  private async obterEsquema(identificador: number): Promise<Type> {
    const existente = this.esquemas.get(identificador);
    if (existente) return existente;
    const texto = await this.buscarEsquema(identificador);
    const esquema = Type.forSchema(JSON.parse(texto) as Parameters<typeof Type.forSchema>[0]);
    this.esquemas.set(identificador, esquema);
    return esquema;
  }
}

/** Consulta a mesma API de compatibilidade usada pelo produtor da API. */
export async function buscarEsquemaNoRegistro(identificador: number): Promise<string> {
  const endereco = (process.env['E2E_SCHEMA_REGISTRY_URL'] ?? 'http://localhost:8081').replace(
    /\/$/,
    '',
  );
  const resposta = await fetch(`${endereco}/apis/ccompat/v7/schemas/ids/${identificador}`);
  if (resposta.status === 404)
    throw new Error(`Esquema ${identificador} não encontrado no registro.`);
  if (!resposta.ok)
    throw new Error(`Falha ao consultar esquema ${identificador}: HTTP ${resposta.status}.`);
  return extrairEsquema(await resposta.json(), identificador);
}

function extrairEsquema(corpo: unknown, identificador: number): string {
  if (
    typeof corpo !== 'object' ||
    corpo === null ||
    !('schema' in corpo) ||
    typeof corpo.schema !== 'string'
  ) {
    throw new Error(`Resposta inválida para o esquema ${identificador}.`);
  }
  return corpo.schema;
}
