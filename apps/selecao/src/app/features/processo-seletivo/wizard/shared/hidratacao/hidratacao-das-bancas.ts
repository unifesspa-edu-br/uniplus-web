import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { BancaDaEtapa, BancaRequeridaDaFase } from '../../processo-seletivo.models';
import { regraDoDto } from '../deliberacao/regra-de-deliberacao-contrato';

type FaseDoDto = ProcessoSeletivoDto['cronogramaFases'][number];
type EtapaDoDto = ProcessoSeletivoDto['etapas'][number];

export function bancaRequeridaDe(
  banca: FaseDoDto['bancasRequeridas'][number],
): BancaRequeridaDaFase {
  return {
    tipoBancaId: banca.tipoBancaOrigemId,
    categoriasDocumentoIds: banca.candidatosAtendidos.map(
      (categoria) => categoria.categoriaDocumentoOrigemId,
    ),
    regraDeDeliberacao: regraDoDto(banca.regraDeDeliberacao),
  };
}

export function bancaDaEtapaDe(banca: EtapaDoDto['bancas'][number]): BancaDaEtapa {
  return {
    tipoBancaId: banca.tipoBancaOrigemId,
    regraDeDeliberacao: regraDoDto(banca.regraDeDeliberacao),
  };
}
