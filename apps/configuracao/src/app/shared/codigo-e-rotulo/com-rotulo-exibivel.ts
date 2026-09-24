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
  const codigo = item.codigo ?? '';
  const rotulo = nullIfBlank(item.rotulo) ?? codigo.trim();
  return { ...item, codigo, rotulo };
}
