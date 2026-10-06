import { nullIfBlank } from '../formulario';

/** Item de vocabulário identificado por código, com o rótulo que a tela mostra. */
export interface CodigoERotulo {
  readonly codigo: string;
  readonly rotulo: string;
}

type CodigoERotuloDaApi = { readonly codigo?: string | null; readonly rotulo?: string | null };

/**
 * O item com um rótulo que se pode mostrar: sem rótulo (ausente, vazio ou só espaços), o
 * código ainda identifica o item para o operador; sem nenhum dos dois, o rótulo fica
 * vazio, e cabe à tela mostrar o traço de "não informado".
 */
export function comRotuloExibivel<T extends CodigoERotuloDaApi>(item: T): T & CodigoERotulo {
  const codigo = item.codigo?.trim() ?? '';
  const rotulo = nullIfBlank(item.rotulo) ?? codigo;
  return { ...item, codigo, rotulo };
}

/** O item com o código aparado: o ponto de entrada do vocabulário, para chave, opção,
 *  comparação e payload usarem todos o mesmo valor. */
export function comCodigoAparado<T extends CodigoERotuloDaApi>(item: T): T {
  return item.codigo == null ? item : { ...item, codigo: item.codigo.trim() };
}

/** Item com código que se pode gravar (já aparado, ver `comCodigoAparado`). */
export function temCodigoUtilizavel(item: CodigoERotuloDaApi): boolean {
  return nullIfBlank(item.codigo) !== null;
}

/** O que a tela mostra de um item de vocabulário: o rótulo, ou o código, ou o traço de
 *  "não informado" — só para exibição, nunca para opção selecionável ou payload. */
export function textoExibivel(item: CodigoERotuloDaApi | null | undefined): string {
  return nullIfBlank(item?.rotulo) ?? nullIfBlank(item?.codigo) ?? '—';
}
