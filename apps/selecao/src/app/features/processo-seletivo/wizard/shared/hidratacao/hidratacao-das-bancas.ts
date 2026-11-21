import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { BancaDaEtapa, BancaRequeridaDaFase } from '../../processo-seletivo.models';
import { regraDoDto } from '../deliberacao/regra-de-deliberacao-contrato';

type FaseDoDto = ProcessoSeletivoDto['cronogramaFases'][number];
type EtapaDoDto = ProcessoSeletivoDto['etapas'][number];

export function bancaRequeridaDe(
  banca: FaseDoDto['bancasRequeridas'][number],
): BancaRequeridaDaFase {
  return {
    ...identidadeDaBanca(banca),
    categoriasDocumentoIds: banca.candidatosAtendidos.map(
      (categoria) => categoria.categoriaDocumentoOrigemId,
    ),
    regraDeDeliberacao: regraDoDto(banca.regraDeDeliberacao),
  };
}

export function bancaDaEtapaDe(banca: EtapaDoDto['bancas'][number]): BancaDaEtapa {
  return {
    ...identidadeDaBanca(banca),
    regraDeDeliberacao: regraDoDto(banca.regraDeDeliberacao),
  };
}

function identidadeDaBanca(banca: EtapaDoDto['bancas'][number]) {
  return {
    id: banca.id,
    identificadorLocal: `banca-${banca.id}`,
    tipoBancaId: banca.tipoBancaOrigemId,
    posicaoNoTipo: banca.posicaoNoTipo,
    copiaDoTipo: {
      rotulo: banca.codigo.rotulo,
      papel: banca.papel,
      exigeDuasOuMaisBancas: banca.exigeDuasOuMaisBancas,
      encerraRecursoNaPrimeiraInstancia: banca.encerraRecursoNaPrimeiraInstancia,
    },
  };
}
