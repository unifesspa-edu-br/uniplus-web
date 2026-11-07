import type { CategoriaDocumentoDto } from '@uniplus/shared-data/configuracao';

/** O que o campo Categoria do formulário precisa saber do catálogo de categorias. */
export interface CategoriasDoFormulario {
  readonly opcoes: readonly CategoriaDocumentoDto[];
  readonly pendente: boolean;
  /** O código escolhido que o catálogo não oferece, para o `select` não renderizar em branco. */
  readonly foraDasOpcoes: string | null;
  /** O texto da opção do código fora do catálogo: sem rótulo inventado enquanto o catálogo não chega. */
  readonly rotuloForaDasOpcoes: string;
  readonly dica: string;
}

interface LeituraDoCatalogo {
  readonly opcoes: readonly CategoriaDocumentoDto[];
  readonly pendente: boolean;
  readonly comErro: boolean;
}

function dicaDaCategoria(leitura: LeituraDoCatalogo, foraDasOpcoes: string | null): string {
  if (leitura.pendente) return 'Carregando as categorias do cadastro…';
  // Sem o catálogo, nada indica que a categoria saiu do cadastro: o aviso do campo explica a falta.
  if (foraDasOpcoes !== null && !leitura.comErro) {
    return 'A categoria atual não está mais no cadastro. Escolha uma das vigentes para substituí-la.';
  }
  return 'Vem do cadastro de categorias. Congelada no snapshot do edital.';
}

/**
 * O estado do campo Categoria a partir do catálogo e da categoria escolhida. O código que o
 * catálogo não oferece continua como opção: sem ela o campo renderizaria em branco enquanto o
 * controle guarda o código, e salvar reenviaria uma categoria que a pessoa nunca viu na tela.
 */
export function categoriasDoFormulario(
  leitura: LeituraDoCatalogo,
  escolhida: string,
): CategoriasDoFormulario {
  const conhecida = leitura.opcoes.some((categoria) => categoria.codigo === escolhida);
  const foraDasOpcoes = escolhida === '' || conhecida ? null : escolhida;
  return {
    ...leitura,
    foraDasOpcoes,
    rotuloForaDasOpcoes: leitura.pendente ? 'Carregando…' : (foraDasOpcoes ?? ''),
    dica: dicaDaCategoria(leitura, foraDasOpcoes),
  };
}
