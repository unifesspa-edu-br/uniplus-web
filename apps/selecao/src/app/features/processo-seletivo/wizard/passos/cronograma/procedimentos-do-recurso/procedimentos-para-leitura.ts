import {
  rotuloDoTipoDeDecisao,
  TipoDeDecisaoDoDocumento,
  type RegraCatalogoDto,
  type DocumentoDaConfiguracaoProcedimentoDeRecurso,
  type DocumentoDaConfiguracaoItemDeAvaliacao,
} from '@uniplus/shared-data/selecao';

import type {
  ItemDeAvaliacaoDaEtapa,
  ProcedimentoDeRecurso,
} from '../../../processo-seletivo.models';
import { areaDoEnem } from '../../../documento/edicoes/procedimentos-de-recurso.edicao';
import { membroDoEnum } from '../../../documento/membro-do-enum';
import { regrasEscolhiveis } from '../../classificacao/regra-escolhivel';

import { rotuloDaAreaDoEnem } from './procedimentos-na-tela';

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
  procedimentos: readonly (ProcedimentoDeRecurso | DocumentoDaConfiguracaoProcedimentoDeRecurso)[],
  catalogo: readonly RegraCatalogoDto[],
  itens: readonly (ItemDeAvaliacaoDaEtapa | DocumentoDaConfiguracaoItemDeAvaliacao)[],
): readonly ProcedimentoParaLeitura[] {
  return procedimentos.map((procedimento) => ({
    tipoDeDecisao: rotuloDoTipoDeDecisao(procedimento.tipoDeDecisao),
    alvo: alvoEmTexto(procedimento.alvo ?? null, itens),
    regra: regraDeclaradaEmTexto(referenciaDoProcedimento(procedimento), catalogo),
    sugestao: sugestaoParaLeitura(procedimento, catalogo),
  }));
}

function referenciaDoProcedimento(
  procedimento: ProcedimentoDeRecurso | DocumentoDaConfiguracaoProcedimentoDeRecurso,
): { readonly codigo: string; readonly versao: string } {
  return 'regra' in procedimento
    ? { codigo: procedimento.regra.codigo ?? '', versao: procedimento.regra.versao ?? '' }
    : { codigo: procedimento.regraCodigo, versao: procedimento.regraVersao };
}

function sugestaoParaLeitura(
  procedimento: ProcedimentoDeRecurso | DocumentoDaConfiguracaoProcedimentoDeRecurso,
  catalogo: readonly RegraCatalogoDto[],
): string | null {
  return 'sugestao' in procedimento && procedimento.sugestao !== null
    ? regraSugeridaEmTexto(procedimento.sugestao, catalogo)
    : null;
}

function regraDeclaradaEmTexto(
  { codigo, versao }: { readonly codigo: string; readonly versao: string },
  catalogo: readonly RegraCatalogoDto[],
): string {
  return (
    regrasEscolhiveis(catalogo, codigo, versao).find((regra) => regra.selecionada)?.rotulo ?? codigo
  );
}

/** O texto da regra que o servidor sugere, ou o código dela quando o catálogo não a tem. */
export function regraSugeridaEmTexto(
  codigo: string,
  catalogo: readonly RegraCatalogoDto[],
): string {
  const opcao = regrasEscolhiveis(catalogo, '', '').find((regra) => regra.codigo === codigo);
  return opcao?.rotulo ?? codigo;
}

function alvoEmTexto(
  alvo: ProcedimentoDeRecurso['alvo'] | DocumentoDaConfiguracaoProcedimentoDeRecurso['alvo'],
  itens: readonly (ItemDeAvaliacaoDaEtapa | DocumentoDaConfiguracaoItemDeAvaliacao)[],
): string | null {
  if (alvo == null || Object.keys(alvo).length === 0) return null;
  if ('areaDoEnem' in alvo)
    return alvo.areaDoEnem === undefined ? null : rotuloDaAreaDoEnem(alvo.areaDoEnem);
  return rotuloDoItem(alvo, itens);
}

function rotuloDoItem(
  alvo: NonNullable<
    ProcedimentoDeRecurso['alvo'] | DocumentoDaConfiguracaoProcedimentoDeRecurso['alvo']
  >,
  itens: readonly (ItemDeAvaliacaoDaEtapa | DocumentoDaConfiguracaoItemDeAvaliacao)[],
): string {
  const encontrado = itens.find((item) => {
    if ('chave' in item && 'itemDeAvaliacaoChave' in alvo)
      return item.chave === alvo.itemDeAvaliacaoChave;
    return 'id' in item && 'itemDeAvaliacaoId' in alvo && item.id === alvo.itemDeAvaliacaoId;
  });
  return encontrado?.rotulo ?? 'item da etapa';
}

/** Adapta a declaração anterior à mesma identidade usada pelos controles do documento. */
export function procedimentoParaDocumento(
  procedimento: ProcedimentoDeRecurso | DocumentoDaConfiguracaoProcedimentoDeRecurso,
  itens: readonly (ItemDeAvaliacaoDaEtapa | DocumentoDaConfiguracaoItemDeAvaliacao)[],
): DocumentoDaConfiguracaoProcedimentoDeRecurso | undefined {
  if ('regra' in procedimento) return procedimento;
  const tipoDeDecisao = membroDoEnum(TipoDeDecisaoDoDocumento, procedimento.tipoDeDecisao);
  const alvo = alvoParaDocumento(procedimento.alvo, itens);
  if (tipoDeDecisao === undefined || alvo === undefined) return undefined;
  return {
    tipoDeDecisao,
    ...(alvo !== null && { alvo }),
    regra: { codigo: procedimento.regraCodigo, versao: procedimento.regraVersao },
  };
}

function alvoParaDocumento(
  alvo: ProcedimentoDeRecurso['alvo'],
  itens: readonly (ItemDeAvaliacaoDaEtapa | DocumentoDaConfiguracaoItemDeAvaliacao)[],
): DocumentoDaConfiguracaoProcedimentoDeRecurso['alvo'] | null {
  if (alvo === null) return null;
  if ('itemDeAvaliacaoId' in alvo) {
    const item = itens.find((atual) => 'id' in atual && atual.id === alvo.itemDeAvaliacaoId);
    return item?.chave === undefined ? undefined : { itemDeAvaliacaoChave: item.chave };
  }
  const area = areaDoEnem(alvo.areaDoEnem);
  return area === undefined ? undefined : { areaDoEnem: area };
}
