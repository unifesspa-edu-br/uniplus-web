import type { ConfiguracaoDistribuicaoVagasDto } from '@uniplus/shared-data/selecao';

type Conferencia = NonNullable<ConfiguracaoDistribuicaoVagasDto['conferenciaDaReservaLegal']>;
type AjusteFixado = NonNullable<ConfiguracaoDistribuicaoVagasDto['ajusteDoQuadroFixado']>;

const SIMULACAO_SEM_CONFERENCIA: Omit<
  ConfiguracaoDistribuicaoVagasDto,
  'id' | 'ofertaCursoOrigemId'
> = {
  vagasOfertadasBase: 40,
  percentualDaReservaLegal: null,
  regraDistribuicao: { codigo: 'DISTRIB-VAGAS-INSTITUCIONAL', versao: 'v1', hash: 'hash-1' },
  ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
  regraAjuste: null,
  ajusteDoQuadro: null,
  referenciaDemografica: null,
  grupoAreaEnem: null,
  modalidades: [],
  quadro: [],
  totalDeVagasDoEdital: 40,
  conferenciaDaReservaLegal: null,
  ajusteDoQuadroFixado: null,
};

/** O resultado da simulação de uma oferta, sem conferência nem ajuste até o teste pedir. */
export function simulada(
  ofertaCursoOrigemId: string,
  parcial: Partial<ConfiguracaoDistribuicaoVagasDto> = {},
): ConfiguracaoDistribuicaoVagasDto {
  const id = `snapshot-${ofertaCursoOrigemId}`;
  return { ...SIMULACAO_SEM_CONFERENCIA, id, ofertaCursoOrigemId, ...parcial };
}

/** A quantidade que o servidor calculou para uma modalidade da oferta. */
export function quantidadeSimulada(
  modalidadeOrigemId: string,
  modalidadeCodigo: string,
  quantidade: number,
): ConfiguracaoDistribuicaoVagasDto['quadro'][number] {
  return { id: `snapshot-${modalidadeOrigemId}`, modalidadeOrigemId, modalidadeCodigo, quantidade };
}

export function reservaConferida(parcial: Partial<Conferencia> = {}): Conferencia {
  return {
    reservaLegalNominal: 20,
    reservaLegalEfetiva: 20,
    excedenteSobreAReservaLegal: 0,
    vagasCortadasPorEscassez: 0,
    ...parcial,
  };
}

export function ajusteFixado(parcial: Partial<AjusteFixado> = {}): AjusteFixado {
  return { vagasRetiradas: [], totalDeVagasRetiradas: 0, ...parcial };
}
