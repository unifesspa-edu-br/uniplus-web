import { describe, expect, it, vi } from 'vitest';
import { buscarEsquemaNoRegistro, DecodificadorAvro } from './decodificar-avro';

const esquema = JSON.stringify({
  type: 'record',
  name: 'Exemplo',
  fields: [{ name: 'valor', type: 'string' }],
});
const mensagem = Buffer.from([0, 0, 0, 1, 2, 6, 97, 98, 99]);

describe('DecodificadorAvro', () => {
  it('lê o identificador de quatro bytes, decodifica e reaproveita o esquema', async () => {
    const buscar = vi.fn(async () => esquema);
    const decodificador = new DecodificadorAvro(buscar);
    const resultado = await decodificador.decodificar(mensagem);
    await decodificador.decodificar(mensagem);
    expect(resultado.registro).toEqual({ valor: 'abc' });
    expect(resultado.bytes).toEqual(mensagem);
    expect(buscar).toHaveBeenCalledExactlyOnceWith(258);
  });

  it.each([Buffer.alloc(4), Buffer.from([1, 0, 0, 0, 1])])(
    'recusa cabeçalho inválido',
    async (bytes) => {
      const buscar = vi.fn(async () => esquema);
      await expect(new DecodificadorAvro(buscar).decodificar(bytes)).rejects.toThrow(
        'Cabeçalho Avro inválido',
      );
      expect(buscar).not.toHaveBeenCalled();
    },
  );

  it('informa o identificador ausente sem expor a mensagem', async () => {
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 404 }));
    try {
      await expect(
        new DecodificadorAvro(buscarEsquemaNoRegistro).decodificar(mensagem),
      ).rejects.toThrow('Esquema 258 não encontrado no registro.');
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
});
