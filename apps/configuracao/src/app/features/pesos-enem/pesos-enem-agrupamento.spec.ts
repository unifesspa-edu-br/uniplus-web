import { describe, expect, it } from 'vitest';
import { agruparPorResolucao, resolucoesDaMaisRecente, slug } from './pesos-enem-agrupamento';
import { RES_750, RES_805, grupo, linha } from './pesos-enem.testing';

describe('agrupamento das resoluções', () => {
  it('ordena as linhas pela ordem dos grupos da API e manda o grupo desconhecido ao fim', () => {
    const linhas = [
      linha({ id: '1', resolucao: RES_805, grupoCurso: grupo('SAUDE_E_BIOLOGICAS') }),
      linha({ id: '2', resolucao: RES_805, grupoCurso: { codigo: 'NOVO', rotulo: 'Novo' } }),
      linha({ id: '3', resolucao: RES_805, grupoCurso: grupo('TECNOLOGICA') }),
    ];
    const ordem = new Map([
      ['TECNOLOGICA', 0],
      ['SAUDE_E_BIOLOGICAS', 1],
    ]);

    const agrupadas = agruparPorResolucao(linhas, ordem);

    expect(agrupadas.get(RES_805)?.map((l) => l.id)).toEqual(['3', '1', '2']);
  });

  it('põe a resolução mais recente primeiro e desempata pelo identificador', () => {
    const mapa = new Map([
      [
        RES_750,
        [
          linha({
            id: 'a',
            resolucao: RES_750,
            grupoCurso: grupo('TECNOLOGICA'),
            criadoEm: '2025-01-01T00:00:00Z',
          }),
        ],
      ],
      [RES_805, [linha({ id: 'b', resolucao: RES_805, grupoCurso: grupo('TECNOLOGICA') })]],
      [
        'Res. 900/2026',
        [linha({ id: 'c', resolucao: 'Res. 900/2026', grupoCurso: grupo('TECNOLOGICA') })],
      ],
    ]);

    expect(resolucoesDaMaisRecente(mapa)).toEqual(['Res. 900/2026', RES_805, RES_750]);
  });

  it('o slug tira acento e símbolos para servir de id', () => {
    expect(slug('Res. 805/2024')).toBe('res-805-2024');
    expect(slug('Câmara Única')).toBe('camara-unica');
  });
});
