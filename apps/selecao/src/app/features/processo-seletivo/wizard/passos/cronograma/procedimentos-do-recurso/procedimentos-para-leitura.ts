import type { RegraCatalogoDto } from '@uniplus/shared-data/selecao';

import type {
  ItemDeAvaliacaoDaEtapa,
  ProcedimentoDeRecurso,
} from '../../../processo-seletivo.models';
import { regrasEscolhiveis } from '../../classificacao/regra-escolhivel';

/** Um procedimento declarado do recurso, em texto, com a sugestão do servidor ao lado quando veio. */
export interface ProcedimentoParaLeitura {
  readonly tipoDeDecisao: string;
  readonly alvo: string | null;
  readonly regra: string;
  readonly sugestao: string | null;
}

/**
 * Os procedimentos declarados em texto para leitura. O nome da regra declarada e o da sugerida
 * saem do mesmo formato do seletor de regras (`código — base legal`); sem a regra no catálogo
 * carregado, a sugestão aparece pelo código.
 */
export function procedimentosParaLeitura(
  procedimentos: readonly ProcedimentoDeRecurso[],
  catalogo: readonly RegraCatalogoDto[],
  itens: readonly ItemDeAvaliacaoDaEtapa[],
): readonly ProcedimentoParaLeitura[] {
  return procedimentos.map((procedimento) => ({
    tipoDeDecisao: procedimento.tipoDeDecisao,
    alvo: alvoEmTexto(procedimento.alvo, itens),
    regra: regraDeclaradaEmTexto(procedimento, catalogo),
    sugestao:
      procedimento.sugestao === null ? null : regraSugeridaEmTexto(procedimento.sugestao, catalogo),
  }));
}

function regraDeclaradaEmTexto(
  { regraCodigo, regraVersao }: ProcedimentoDeRecurso,
  catalogo: readonly RegraCatalogoDto[],
): string {
  const opcao = regrasEscolhiveis(catalogo, regraCodigo, regraVersao).find(
    (regra) => regra.selecionada,
  );
  return opcao?.rotulo ?? regraCodigo;
}

function regraSugeridaEmTexto(codigo: string, catalogo: readonly RegraCatalogoDto[]): string {
  const opcao = regrasEscolhiveis(catalogo, '', '').find((regra) => regra.codigo === codigo);
  return opcao?.rotulo ?? codigo;
}

function alvoEmTexto(
  alvo: ProcedimentoDeRecurso['alvo'],
  itens: readonly ItemDeAvaliacaoDaEtapa[],
): string | null {
  if (alvo === null) return null;
  if (alvo.itemDeAvaliacaoId !== null) {
    return itens.find((item) => item.id === alvo.itemDeAvaliacaoId)?.rotulo ?? 'item da etapa';
  }
  return alvo.areaDoEnem;
}
