import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

/** A regra de aplicabilidade que o processo congelou para uma modalidade ofertada. */
export interface RegraDaModalidadeOfertada {
  readonly codigo: string;
  readonly descricao: string | null;
  /** O predicado na forma do contrato: cláusulas ligadas por "ou", cada uma com as suas condições. */
  readonly regra: ProcessoSeletivoDto['distribuicaoVagas'][number]['modalidades'][number]['regraDeAplicabilidade'];
}

/**
 * As modalidades que o processo oferta, uma por código, com a regra que o servidor congelou ao
 * gravar o quadro de vagas. A mesma modalidade tem a mesma regra em todas as ofertas: o servidor
 * recusa a cópia divergente.
 */
export function regrasDasModalidadesOfertadas(
  processo: ProcessoSeletivoDto | null,
): readonly RegraDaModalidadeOfertada[] {
  const porCodigo = new Map<string, RegraDaModalidadeOfertada>();
  for (const distribuicao of processo?.distribuicaoVagas ?? []) {
    for (const modalidade of distribuicao.modalidades) {
      if (!porCodigo.has(modalidade.codigo)) {
        porCodigo.set(modalidade.codigo, {
          codigo: modalidade.codigo,
          descricao: modalidade.descricao,
          regra: modalidade.regraDeAplicabilidade,
        });
      }
    }
  }
  return [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}
