import type { NoExigenciaDto, PreVisualizacaoDoProcessoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';
import { resultadoDoProcesso } from './pre-visualizacao-do-processo';

const no = (campos: Partial<NoExigenciaDto>): NoExigenciaDto => ({ documento: null, filhos: [], repetePorEntidade: null, ...campos }) as NoExigenciaDto;
const folha = (id: string): NoExigenciaDto => no({ documento: { id } as NoExigenciaDto['documento'] });
const documento = (exigenciaId: string) =>
  ({ exigenciaId, tipoDocumentoNome: 'RG', obrigatorio: true, faseId: 'f', etapaId: null, situacao: 'EXIGIDO', entidadeId: null, alternativas: [] }) as unknown as PreVisualizacaoDoProcessoDto['documentos'][number];

describe('resultado da pré-visualização do processo', () => {
  it('a exigência repetida por ocorrência leva o grupo do ancestral mais próximo que repete', () => {
    const arvore = [no({ filhos: [no({ repetePorEntidade: 'MEMBROS', filhos: [no({ filhos: [folha('e-rg')] })] }), folha('e-edital')] })];

    const { documentos } = resultadoDoProcesso(
      { formularios: [], documentos: [documento('e-rg'), documento('e-edital')] },
      { cronogramaFases: [], etapas: [], raizesExigencia: arvore },
      new Map(),
    );

    expect(documentos?.map((avaliado) => avaliado.grupo)).toEqual(['MEMBROS', null]);
  });
});
