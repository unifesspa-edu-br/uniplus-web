import { StatusProcesso, type ProcessoSeletivoResumoDto } from '@uniplus/shared-data/selecao';

function vestibular(id: string, nome: string): ProcessoSeletivoResumoDto {
  return {
    id,
    nome,
    tipoProcesso: {
      origemId: '019f41cf-69fd-759a-ac6d-09acabc1b028',
      codigo: 'VESTIBULAR',
      nome: 'Vestibular',
    },
    status: StatusProcesso.rascunho,
    criadoEm: '2026-08-20T13:23:42.707136+00:00',
  };
}

export const VESTIBULAR_2026 = vestibular(
  '019f41cf-69fd-759a-ac6d-09acabc1b027',
  'Vestibular 2026',
);
export const VESTIBULAR_2027 = vestibular(
  '019f41cf-69fd-759a-ac6d-09acabc1b029',
  'Vestibular 2027',
);
