import { describe, expect, it } from 'vitest';
import type {
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
} from '@uniplus/shared-data/selecao';

import { derivadosDoComprovante, municipiosDoComprovante } from './comprovante-da-inscricao';

const municipio = (fatoCodigo: string) => ({
  fatoCodigo,
  ordem: 0,
  rotulo: fatoCodigo,
  tipoRenderizacao: 'MUNICIPIO',
});

describe('municipiosDoComprovante', () => {
  it('reúne os códigos distintos dos campos de município, nos itens, nos grupos e nos derivados', () => {
    const formulario = {
      fatosColetados: [
        municipio('NATURALIDADE_MUNICIPIO'),
        { ...municipio('UF'), tipoRenderizacao: 'SELECAO_UNICA' },
      ],
      grupos: [{ codigo: 'DEPENDENTES', subitens: [municipio('MUNICIPIO_DO_DEPENDENTE')] }],
      // O derivado do sistema vem com o rótulo e o tipo que a versão congelou do catálogo.
      pressupostos: [
        {
          fatoCodigo: 'MUNICIPIO_RESIDENCIA',
          rotulo: 'Município de residência',
          tipoRenderizacao: 'MUNICIPIO',
          formato: null,
          valoresSelecionaveis: null,
          calculadoDe: ['ENDERECO_RESIDENCIAL'],
        },
      ],
    } as unknown as FormularioRenderizavelDto;
    const comprovante = {
      respostas: { NATURALIDADE_MUNICIPIO: '5002704', UF: 'MS' },
      grupos: {
        DEPENDENTES: [
          { id: 'm1', respostas: { MUNICIPIO_DO_DEPENDENTE: '3550308' } },
          { id: 'm2', respostas: { MUNICIPIO_DO_DEPENDENTE: '5002704' } },
        ],
      },
      derivados: { MUNICIPIO_RESIDENCIA: '1504208' },
    } as unknown as ComprovanteInscricaoDto;

    expect(municipiosDoComprovante(formulario, comprovante)).toEqual([
      '5002704',
      '3550308',
      '1504208',
    ]);
  });
});

describe('derivadosDoComprovante', () => {
  const formulario = {
    pressupostos: [
      {
        fatoCodigo: 'MUNICIPIO_RESIDENCIA',
        rotulo: 'Município de residência',
        tipoRenderizacao: 'MUNICIPIO',
        formato: null,
        valoresSelecionaveis: null,
        calculadoDe: ['ENDERECO_RESIDENCIAL'],
      },
    ],
  } as unknown as FormularioRenderizavelDto;

  it('mostra o derivado que o formulário descreve, pelo rótulo e com o nome do município', () => {
    const comprovante = {
      derivados: { MUNICIPIO_RESIDENCIA: '5002704' },
    } as unknown as ComprovanteInscricaoDto;

    expect(
      derivadosDoComprovante(formulario, comprovante, new Map([['5002704', 'Campo Grande — MS']])),
    ).toEqual([{ rotulo: 'Município de residência', valor: 'Campo Grande — MS' }]);
  });

  it('não mostra o derivado que nenhuma regra do processo cita, nem pelo código do fato', () => {
    const comprovante = {
      derivados: { MUNICIPIO_RESIDENCIA: '5002704', UF_RESIDENCIA: 'MS' },
    } as unknown as ComprovanteInscricaoDto;

    expect(derivadosDoComprovante(formulario, comprovante).map((d) => d.rotulo)).toEqual([
      'Município de residência',
    ]);
  });
});
