import type { BancaDoCampo } from './campo-da-banca';

/** Os `id` que a tela dá ao que uma banca mostra, na grafia da lista em que ela está. */
export interface IdsDaBanca {
  readonly grupo: (identificador: string) => string;
  readonly controle: (identificador: string, controle: string) => string;
  /** As categorias que a banca atende; só a lista de bancas que as tem declara este `id`. */
  readonly categorias?: (identificador: string) => string;
  readonly secao: string;
}

function alvoDasCategorias(identificador: string, ids: IdsDaBanca): readonly string[] {
  const alvo = ids.categorias?.(identificador);
  return alvo === undefined ? [] : [alvo];
}

/**
 * O controle que a recusa aponta e, para o campo da regra, o seletor do modo: ele fica de reserva
 * porque o controle recusado some da tela quando a regra, o critério ou os integrantes não o pedem.
 */
function alvosDoControle(
  identificador: string,
  controle: string | null,
  ids: IdsDaBanca,
): readonly string[] {
  if (controle === null) return [];
  if (controle === 'categoriasDocumentoIds') return alvoDasCategorias(identificador, ids);
  const modo = ids.controle(identificador, 'modo');
  return controle === 'regra' || controle === 'modo'
    ? [modo]
    : [ids.controle(identificador, controle), modo];
}

/**
 * Os elementos que podem receber o foco quando a recusa é a de uma banca, do preferido ao de
 * reserva: o controle que ela aponta, o modo da regra quando o controle não está à vista, o
 * grupo da banca e o bloco das recusas da seção.
 */
export function alvosDaBanca(banca: BancaDoCampo, ids: IdsDaBanca): readonly string[] {
  return [
    ...alvosDoControle(banca.identificador, banca.controle, ids),
    ids.grupo(banca.identificador),
    ids.secao,
  ];
}
