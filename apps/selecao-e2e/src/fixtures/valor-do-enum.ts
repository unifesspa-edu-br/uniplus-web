import type { EtapaProcessoDto, FaseCronogramaDto } from '@uniplus/shared-data/selecao';

export function valorDoEnum<Codigo extends string>(codigo: Codigo, rotulo: string) {
  return { codigo, rotulo };
}

export function situacaoDoProcesso(status: string) {
  return valorDoEnum(status.toUpperCase(), status === 'rascunho' ? 'Rascunho' : 'Publicado');
}

export const ORIGEM_NO_EDITAL = valorDoEnum(
  'NO_EDITAL' as FaseCronogramaDto['faseCanonica']['origemData']['codigo'],
  'No edital',
);
export const PAPEL_PRELIMINAR = valorDoEnum(
  'PRELIMINAR' as NonNullable<
    FaseCronogramaDto['publicacoes']['produtos'][number]['papel']
  >['codigo'],
  'Preliminar',
);
export const PAPEL_DEFINITIVO = valorDoEnum(
  'DEFINITIVO' as NonNullable<
    FaseCronogramaDto['publicacoes']['produtos'][number]['papel']
  >['codigo'],
  'Definitivo',
);
export const PUBLICACAO_DO_ATO = valorDoEnum(
  'PUBLICACAO_DO_ATO' as EtapaProcessoDto['publicacoes']['recursos'][number]['ancora']['codigo'],
  'Publicação do ato',
);
