import { PadraoDoEdital } from './padrao-do-edital';

export interface EntradaDaLeituraDoPadrao {
  readonly padrao: PadraoDoEdital;
  readonly modalidades: readonly { readonly codigo: string; readonly descricao: string | null }[];
  readonly referencias: readonly {
    readonly id: string;
    readonly censoReferencia: string | number;
    readonly ppiPercentual: string | number;
    readonly quilombolaPercentual: string | number;
    readonly pcdPercentual: string | number;
  }[];
  /** O catálogo foi lido? Quando não, o texto diz o motivo em vez de afirmar que o item não existe. */
  readonly catalogoLido: boolean;
  readonly motivoDaAusencia: string;
}

/**
 * O padrão da distribuição como o processo o gravou, em texto: o que a consulta lê no lugar dos
 * seletores. Regra sem código é regra não declarada, e o campo diz isso.
 */
export function leituraDoPadrao(entrada: EntradaDaLeituraDoPadrao) {
  const { padrao } = entrada;
  return {
    regraDeDistribuicao: regraEmTexto(
      padrao.regraDistribuicaoCodigo,
      padrao.regraDistribuicaoVersao,
    ),
    percentualDeReserva: padrao.pr,
    regraDeAjuste: regraEmTexto(padrao.regraAjusteCodigo, padrao.regraAjusteVersao),
    referenciaDemografica: referenciaEmTexto(entrada),
    modalidades: entrada.modalidades.map((modalidade) => modalidadeEmTexto(modalidade, entrada)),
  };
}

function regraEmTexto(codigo: string | null, versao: string | null): string | null {
  return codigo ? `${codigo} · versão ${versao ?? ''}` : null;
}

function modalidadeEmTexto(
  modalidade: EntradaDaLeituraDoPadrao['modalidades'][number],
  entrada: EntradaDaLeituraDoPadrao,
): string {
  if (modalidade.descricao !== '') return `${modalidade.codigo} — ${modalidade.descricao}`;
  return entrada.catalogoLido
    ? modalidade.codigo
    : `${modalidade.codigo} — descrição: o catálogo ${entrada.motivoDaAusencia}`;
}

function referenciaEmTexto(entrada: EntradaDaLeituraDoPadrao): string | null {
  const id = entrada.padrao.referenciaReservaDemograficaId;
  const referencia = entrada.referencias.find((item) => item.id === id);
  if (referencia) {
    return `Censo ${referencia.censoReferencia} — PPI ${referencia.ppiPercentual}% · quilombola ${referencia.quilombolaPercentual}% · PcD ${referencia.pcdPercentual}%`;
  }
  if (!id) return null;
  return entrada.catalogoLido
    ? 'Referência gravada fora do catálogo'
    : `Referência gravada, mas o catálogo ${entrada.motivoDaAusencia}`;
}
