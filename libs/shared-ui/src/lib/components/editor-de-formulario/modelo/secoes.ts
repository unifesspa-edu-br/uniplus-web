import { conferirOrdem } from './conferencia-de-ordem';
import { BLOCO_REVISAO_E_ACEITE, SECAO_DADOS_BASICOS, paginaNova } from './constantes';
import { TrocaComAVizinha, entradasDaSecao, paginasEmOrdem, renumerar } from './ordem-das-entradas';
import {
  ConteudoDoFormulario,
  PaginaDoFormulario,
  OpcaoDoFormulario,
  ResultadoDaEdicao,
} from './tipos';

/** Troca a página pela editada, sem mexer na ordem. */
export function comPagina(
  conteudo: ConteudoDoFormulario,
  editada: PaginaDoFormulario,
): ConteudoDoFormulario {
  return {
    ...conteudo,
    paginas: (conteudo.paginas ?? []).map((pagina) =>
      pagina.codigo === editada.codigo ? editada : pagina,
    ),
  };
}

/** Uma seção nova, vazia, logo antes da revisão e aceite — que é sempre a última página. */
export function acrescentarSecao(
  conteudo: ConteudoDoFormulario,
  titulo: string,
): ConteudoDoFormulario {
  return acrescentarPaginaAntesDaRevisao(conteudo, paginaNova(codigoDaSecaoNova(conteudo), titulo));
}

function codigoDaSecaoNova(conteudo: ConteudoDoFormulario): string {
  const codigos = new Set((conteudo.paginas ?? []).map((pagina) => pagina.codigo));
  let numero = 1;
  while (codigos.has(`SECAO_${numero}`)) numero++;
  return `SECAO_${numero}`;
}

/** Um bloco do sistema, logo antes da revisão e aceite. O código do bloco é o próprio token. */
export function acrescentarBloco(
  conteudo: ConteudoDoFormulario,
  bloco: OpcaoDoFormulario,
): ConteudoDoFormulario {
  return acrescentarPaginaAntesDaRevisao(
    conteudo,
    paginaNova(bloco.valor, bloco.rotulo, bloco.valor),
  );
}

/** Se a página fica onde está: os dados básicos abrem o formulário, e a revisão e aceite o fecha. */
export function paginaFixa(pagina: Pick<PaginaDoFormulario, 'codigo' | 'bloco'>): boolean {
  return pagina.codigo === SECAO_DADOS_BASICOS || pagina.bloco === BLOCO_REVISAO_E_ACEITE;
}

/** A página e a vizinha na direção dada, se as duas podem trocar de lugar. */
function paginaEVizinha(
  conteudo: ConteudoDoFormulario,
  codigo: string,
  direcao: -1 | 1,
): TrocaComAVizinha<PaginaDoFormulario> | null {
  const paginas = paginasEmOrdem(conteudo);
  const indice = paginas.findIndex((pagina) => pagina.codigo === codigo);
  const atual = paginas[indice];
  const vizinha = paginas[indice + direcao];
  if (atual === undefined || vizinha === undefined) return null;
  return paginaFixa(atual) || paginaFixa(vizinha) ? null : { atual, vizinha };
}

/** Se a página pode trocar de lugar com a vizinha na direção dada. */
export function podeMoverPagina(
  conteudo: ConteudoDoFormulario,
  codigo: string,
  direcao: -1 | 1,
): boolean {
  return paginaEVizinha(conteudo, codigo, direcao) !== null;
}

/**
 * Troca a página de lugar com a vizinha, levando os itens dela junto. Recusa o movimento que põe
 * um item antes de um fato que ele cita.
 */
export function moverPagina(
  conteudo: ConteudoDoFormulario,
  codigo: string,
  direcao: -1 | 1,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  const troca = paginaEVizinha(conteudo, codigo, direcao);
  if (troca === null) return { ok: false, recusa: 'Não há para onde mover nessa direção.' };
  return conferirOrdem(comPaginasTrocadas(conteudo, troca), nomes);
}

function comPaginasTrocadas(
  conteudo: ConteudoDoFormulario,
  { atual, vizinha }: TrocaComAVizinha<PaginaDoFormulario>,
): ConteudoDoFormulario {
  const ordemTrocada = (pagina: PaginaDoFormulario): PaginaDoFormulario => {
    if (pagina.codigo === atual.codigo) return { ...pagina, ordem: vizinha.ordem };
    return pagina.codigo === vizinha.codigo ? { ...pagina, ordem: atual.ordem } : pagina;
  };
  return renumerar({ ...conteudo, paginas: (conteudo.paginas ?? []).map(ordemTrocada) });
}

/** Remove a página. A seção com itens não sai: os itens ficariam sem seção. */
export function removerPagina(conteudo: ConteudoDoFormulario, codigo: string): ResultadoDaEdicao {
  const recusa = recusaDaRemocaoDaPagina(conteudo, codigo);
  if (recusa !== null) return { ok: false, recusa };
  return {
    ok: true,
    conteudo: renumerar({
      ...conteudo,
      paginas: (conteudo.paginas ?? []).filter((e) => e.codigo !== codigo),
    }),
  };
}

function recusaDaRemocaoDaPagina(conteudo: ConteudoDoFormulario, codigo: string): string | null {
  const pagina = (conteudo.paginas ?? []).find((e) => e.codigo === codigo);
  if (pagina === undefined || paginaFixa(pagina))
    return 'Esta parte do formulário não pode ser removida.';
  if (entradasDaSecao(conteudo, codigo).length === 0) return null;
  return `Remova ou mova os campos de “${pagina.apresentacao.titulo}” antes de remover a seção.`;
}

function acrescentarPaginaAntesDaRevisao(
  conteudo: ConteudoDoFormulario,
  nova: PaginaDoFormulario,
): ConteudoDoFormulario {
  const revisao = (conteudo.paginas ?? []).find(
    (pagina) => pagina.bloco === BLOCO_REVISAO_E_ACEITE,
  );
  const ordem = revisao === undefined ? Number.MAX_SAFE_INTEGER : revisao.ordem - 0.5;
  return renumerar({ ...conteudo, paginas: [...(conteudo.paginas ?? []), { ...nova, ordem }] });
}
