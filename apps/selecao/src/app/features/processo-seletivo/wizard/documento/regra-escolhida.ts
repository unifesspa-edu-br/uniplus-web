import type { DocumentoDaConfiguracaoReferenciaDeRegra } from '@uniplus/shared-data/selecao';

import { textoPreenchido } from './texto-do-campo';

/** A regra do catálogo que o formulário mostra: o código e a versão congelada. */
export interface RegraEscolhida {
  readonly codigo: string;
  readonly versao: string;
}

export function regraEscolhida(
  referencia: DocumentoDaConfiguracaoReferenciaDeRegra | null | undefined,
): RegraEscolhida | null {
  return referencia ? { codigo: referencia.codigo ?? '', versao: referencia.versao ?? '' } : null;
}

/** Regra sem código nem versão não é regra escolhida: não vai ao documento. */
export function referenciaDaRegra(
  regra: RegraEscolhida | null,
): DocumentoDaConfiguracaoReferenciaDeRegra | undefined {
  const codigo = textoPreenchido(regra?.codigo ?? '');
  const versao = textoPreenchido(regra?.versao ?? '');
  if (codigo === undefined && versao === undefined) return undefined;
  return { ...(codigo !== undefined && { codigo }), ...(versao !== undefined && { versao }) };
}

/**
 * A referência que vale depois da edição. O esquema admite a referência sem código nem versão, que
 * o formulário lê como regra vazia: a que o documento já traz volta a mesma enquanto a escolha não
 * mudou, e só sai quando a pessoa limpa a escolha.
 */
export function referenciaQueVale(
  atual: DocumentoDaConfiguracaoReferenciaDeRegra | null | undefined,
  regra: RegraEscolhida | null,
): DocumentoDaConfiguracaoReferenciaDeRegra | undefined {
  const lida = regraEscolhida(atual);
  const inalterada = lida !== null && lida.codigo === regra?.codigo && lida.versao === regra.versao;
  return atual && inalterada ? atual : referenciaDaRegra(regra);
}
