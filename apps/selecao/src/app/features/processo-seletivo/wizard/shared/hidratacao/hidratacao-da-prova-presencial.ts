import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { DeclaracaoDaProvaPresencial } from '../../passos/prova-presencial/declaracao-da-prova-presencial';

export function provaPresencialDe(dto: ProcessoSeletivoDto): DeclaracaoDaProvaPresencial {
  const prova = dto.provaPresencial;
  if (prova == null) return { temProvaPresencial: null, municipios: [] };
  return {
    temProvaPresencial: prova.temProvaPresencial,
    municipios: prova.municipios.map(({ codigoIbge, uf, nome }) => ({ codigoIbge, uf, nome })),
  };
}
