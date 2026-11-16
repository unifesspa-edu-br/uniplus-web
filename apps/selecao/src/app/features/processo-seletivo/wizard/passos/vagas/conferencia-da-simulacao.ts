import type { ConfiguracaoDistribuicaoVagasDto } from '@uniplus/shared-data/selecao';

type Conferencia = NonNullable<ConfiguracaoDistribuicaoVagasDto['conferenciaDaReservaLegal']>;
type AjusteFixado = NonNullable<ConfiguracaoDistribuicaoVagasDto['ajusteDoQuadroFixado']>;

export interface ReservaAcimaDoPercentual {
  readonly ofertaCursoId: string;
  readonly reservaLegalNominal: number;
  readonly reservaLegalEfetiva: number;
}

export interface VagasCortadasPorEscassez {
  readonly ofertaCursoId: string;
  readonly quantidade: number;
}

export interface VagasRetiradasPeloAjuste {
  readonly ofertaCursoId: string;
  readonly total: number;
  readonly porModalidade: readonly {
    readonly modalidadeCodigo: string;
    readonly quantidade: number;
  }[];
}

/**
 * O que o servidor informou ao simular o quadro além das quantidades: a reserva legal acima do
 * percentual, as vagas cortadas por escassez e o que o ajuste retirou do quadro fixado no edital.
 * Cada grupo só tem a oferta que traz o dado; o que vem ausente ou zerado não é conferência.
 */
export interface ConferenciaDaSimulacao {
  readonly reservaAcimaDoPercentual: readonly ReservaAcimaDoPercentual[];
  readonly vagasCortadasPorEscassez: readonly VagasCortadasPorEscassez[];
  readonly vagasRetiradasPeloAjuste: readonly VagasRetiradasPeloAjuste[];
}

export function haConferencia(conferencia: ConferenciaDaSimulacao): boolean {
  return (
    conferencia.reservaAcimaDoPercentual.length > 0 ||
    conferencia.vagasCortadasPorEscassez.length > 0 ||
    conferencia.vagasRetiradasPeloAjuste.length > 0
  );
}

export function conferenciaDaSimulacao(
  calculadas: readonly ConfiguracaoDistribuicaoVagasDto[],
): ConferenciaDaSimulacao {
  return {
    reservaAcimaDoPercentual: calculadas.flatMap(reservaAcimaDe),
    vagasCortadasPorEscassez: calculadas.flatMap(cortadasPorEscassezDe),
    vagasRetiradasPeloAjuste: calculadas.flatMap(retiradasPeloAjusteDe),
  };
}

/** O item só entra com excedente e com a reserva efetiva diferente da nominal. */
function reservaAcimaDe(calculada: ConfiguracaoDistribuicaoVagasDto): ReservaAcimaDoPercentual[] {
  const conferencia = calculada.conferenciaDaReservaLegal;
  if (conferencia === null || !reservaPassouDoNominal(conferencia)) return [];

  return [
    {
      ofertaCursoId: calculada.ofertaCursoOrigemId,
      reservaLegalNominal: conferencia.reservaLegalNominal,
      reservaLegalEfetiva: conferencia.reservaLegalEfetiva,
    },
  ];
}

function reservaPassouDoNominal(conferencia: Conferencia): boolean {
  return (
    conferencia.excedenteSobreAReservaLegal > 0 &&
    conferencia.reservaLegalEfetiva !== conferencia.reservaLegalNominal
  );
}

function cortadasPorEscassezDe(
  calculada: ConfiguracaoDistribuicaoVagasDto,
): VagasCortadasPorEscassez[] {
  const quantidade = calculada.conferenciaDaReservaLegal?.vagasCortadasPorEscassez ?? 0;
  return quantidade > 0 ? [{ ofertaCursoId: calculada.ofertaCursoOrigemId, quantidade }] : [];
}

function retiradasPeloAjusteDe(
  calculada: ConfiguracaoDistribuicaoVagasDto,
): VagasRetiradasPeloAjuste[] {
  const ajuste: AjusteFixado | null = calculada.ajusteDoQuadroFixado;
  if (ajuste === null || ajuste.totalDeVagasRetiradas <= 0) return [];

  return [
    {
      ofertaCursoId: calculada.ofertaCursoOrigemId,
      total: ajuste.totalDeVagasRetiradas,
      porModalidade: ajuste.vagasRetiradas.filter((retirada) => retirada.quantidade > 0),
    },
  ];
}
