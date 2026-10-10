import { describe, expect, it } from 'vitest';
import type {
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
} from '@uniplus/shared-data/selecao';

import { municipiosDoComprovante } from './comprovante-da-inscricao';

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
      pressupostos: [{ fatoCodigo: 'MUNICIPIO_RESIDENCIA', tipoRenderizacao: 'MUNICIPIO' }],
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
