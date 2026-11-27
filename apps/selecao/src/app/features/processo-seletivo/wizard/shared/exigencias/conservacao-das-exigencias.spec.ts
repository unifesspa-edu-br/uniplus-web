import { describe, expect, it } from 'vitest';
import { descreverArquivo } from '../documentos-exigidos';
import { comando, detalheDaApi, exigenciaDaApi, grupoDaApi } from './exigencias.testing';
import { exigenciasDe } from './leitura-das-exigencias';

describe('Conservação das exigências', () => {
  it('conserva a fase ausente, os fatos e os formatos de cada documento', () => {
    const formatos = [{ formato: 'PDF', tamanhoMaximoBytesMax: 2048 }];
    const regra = exigenciaDaApi({
      faseId: 'fase-ausente',
      fatosComprovados: ['ESCOLARIDADE'],
      requisitos: { formatosPermitidos: formatos },
    });
    const documento = comando(exigenciasDe(detalheDaApi([regra])))[0].documento;
    expect(documento?.momento?.faseId).toBe('fase-ausente');
    expect(documento?.fatosComprovados).toEqual(['ESCOLARIDADE']);
    expect(documento?.requisitos?.formatosPermitidos).toEqual(formatos);
  });

  it('conserva grupo sem documentos', () => {
    const regras = comando(exigenciasDe(detalheDaApi([grupoDaApi([])])));
    expect(regras).toHaveLength(1);
    expect(regras[0].itens).toEqual([]);
  });

  it('conserva o prazo para reenvio do grupo na leitura e na gravação', () => {
    const grupo = grupoDaApi([exigenciaDaApi()]);
    const lido = exigenciasDe(
      detalheDaApi([
        {
          ...grupo,
          indeferimento: { ...grupo.indeferimento, abrePrazoParaReenvio: true },
        } as typeof grupo,
      ]),
    );
    expect(lido.regrasDeComprovacao.find((regra) => regra.itens !== null)).toMatchObject({
      abrePrazoParaReenvio: true,
    });
    expect(comando(lido)[0].indeferimento?.abrePrazoParaReenvio).toBe(true);
  });

  it('descreve os nomes dos formatos', () => {
    const formatos = {
      tipo: 'lista',
      itens: [{ formato: 'PDF', tamanhoMaximoBytes: 2048 }],
    } as const;
    expect(descreverArquivo(formatos, null)).toBe(
      'PDF (até 2,0 KB), sem limite geral de tamanho declarado',
    );
    expect(descreverArquivo(formatos, 4096)).toBe('PDF (até 2,0 KB), até 4,0 KB');
  });
});
