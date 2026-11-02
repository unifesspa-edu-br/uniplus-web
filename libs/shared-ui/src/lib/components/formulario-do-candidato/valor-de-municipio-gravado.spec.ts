import { describe, expect, it } from 'vitest';

import {
  chaveDaResposta,
  lerMunicipio,
  rotuloGravadoDa,
  separarMunicipiosGravados,
} from './valor-de-municipio-gravado';

describe('lerMunicipio', () => {
  it('lê o código do rascunho e o código com o nome gravado da inscrição enviada', () => {
    expect(lerMunicipio('2927408')).toEqual({ codigo: '2927408', rotulo: null });
    expect(lerMunicipio({ codigo: '2927408', rotulo: 'Salvador' })).toEqual({
      codigo: '2927408',
      rotulo: 'Salvador',
    });
  });

  it('não lê como município o que não traz código', () => {
    expect(lerMunicipio({ cep: '40020000', cidade: { codigoIbge: '2927408' } })).toBeNull();
    expect(lerMunicipio('')).toBeNull();
    expect(lerMunicipio(null)).toBeNull();
  });
});

describe('separarMunicipiosGravados', () => {
  const formulario = {
    fatosColetados: [
      { fatoCodigo: 'NATURALIDADE_MUNICIPIO', tipoRenderizacao: 'MUNICIPIO' },
      { fatoCodigo: 'ENDERECO_RESIDENCIAL', tipoRenderizacao: 'ENDERECO' },
    ],
    grupos: [
      {
        codigo: 'FAMILIA',
        subitens: [{ fatoCodigo: 'MUNICIPIO_DO_INTEGRANTE', tipoRenderizacao: 'MUNICIPIO' }],
      },
    ],
  };
  const endereco = { cep: '40020000', cidade: { codigoIbge: '2927408', nome: 'Salvador' } };

  it('reduz o município das respostas e dos grupos ao código e guarda o nome de cada resposta', () => {
    const separado = separarMunicipiosGravados(formulario, {
      respostas: {
        NATURALIDADE_MUNICIPIO: { codigo: '2927408', rotulo: 'Salvador' },
        ENDERECO_RESIDENCIAL: endereco,
      },
      grupos: {
        FAMILIA: [
          { id: 'a', respostas: { MUNICIPIO_DO_INTEGRANTE: { codigo: '1501402', rotulo: 'Belém' } } },
        ],
      },
    });

    expect(separado.respostas).toEqual({
      NATURALIDADE_MUNICIPIO: '2927408',
      ENDERECO_RESIDENCIAL: endereco,
    });
    expect(separado.grupos['FAMILIA']?.[0].respostas).toEqual({ MUNICIPIO_DO_INTEGRANTE: '1501402' });
    expect(separado.gravados).toEqual({
      NATURALIDADE_MUNICIPIO: { codigo: '2927408', rotulo: 'Salvador' },
      'FAMILIA.a.MUNICIPIO_DO_INTEGRANTE': { codigo: '1501402', rotulo: 'Belém' },
    });
    expect(separado.semNome).toEqual([]);
  });

  it('aponta os códigos do rascunho, que chegam sem nome gravado', () => {
    const separado = separarMunicipiosGravados(formulario, {
      respostas: { NATURALIDADE_MUNICIPIO: '2927408' },
      grupos: { FAMILIA: [{ id: 'a', respostas: { MUNICIPIO_DO_INTEGRANTE: '2927408' } }] },
    });

    expect(separado.gravados).toEqual({});
    expect(separado.semNome).toEqual(['2927408', '2927408']);
  });
});

describe('rotuloGravadoDa', () => {
  const gravados = { NATURALIDADE_MUNICIPIO: { codigo: '2927408', rotulo: 'Salvador' } };
  const chave = chaveDaResposta('NATURALIDADE_MUNICIPIO');

  it('mostra o nome gravado com a UF do código enquanto o código for o gravado', () => {
    expect(rotuloGravadoDa(gravados, chave, '2927408')).toBe('Salvador (BA)');
  });

  it('deixa de valer quando o candidato escolhe outro município', () => {
    expect(rotuloGravadoDa(gravados, chave, '1501402')).toBeNull();
  });
});
