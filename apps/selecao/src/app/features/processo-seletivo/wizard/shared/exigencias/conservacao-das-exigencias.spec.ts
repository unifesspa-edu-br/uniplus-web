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

  it('conserva uma referência de prazo cuja fase não foi encontrada', () => {
    const idade = {
      valor: 3,
      unidade: 'DIAS',
      referenciaTipo: 'FASE',
      data: null,
      referenciaFaseId: 'fase-ausente',
    };
    const regra = exigenciaDaApi({ requisitos: { idadeMaximaEmissao: idade } });
    const documento = comando(exigenciasDe(detalheDaApi([regra])))[0].documento;
    expect(documento?.requisitos?.idadeMaximaEmissao).toEqual(idade);
  });

  it('conserva grupo sem documentos', () => {
    const regras = comando(exigenciasDe(detalheDaApi([grupoDaApi([])])));
    expect(regras).toHaveLength(1);
    expect(regras[0].itens).toEqual([]);
  });

  it('descreve os nomes dos formatos', () => {
    const formatos = {
      tipo: 'lista',
      itens: [{ formato: 'PDF', tamanhoMaximoBytes: 2048 }],
    } as const;
    expect(descreverArquivo(formatos, null)).toBe('PDF, sem limite de tamanho declarado');
  });
});
