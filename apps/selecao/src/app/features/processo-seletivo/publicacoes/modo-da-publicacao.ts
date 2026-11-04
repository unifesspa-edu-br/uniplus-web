import type { AtoDoProcessoDto, ProdutoPrevistoDto } from '@uniplus/shared-data/selecao';

import { rotuloDoAto } from './apresentacao-do-ato';
import type { PoliticaParaConfirmar } from './previstos-do-edital';

/**
 * O que o formulário publica: um documento novo, a correção de um ato já publicado ou um item que
 * o edital declara — a primeira publicação dele ou a correção da publicação mais recente.
 */
export type ModoDaPublicacao =
  | { readonly tipo: 'avulso' }
  | { readonly tipo: 'correcao'; readonly ato: AtoDoProcessoDto }
  | {
      readonly tipo: 'previsto';
      readonly item: ProdutoPrevistoDto;
      /** A política do certame a confirmar; `null` quando o item não é resultado. */
      readonly politica: PoliticaParaConfirmar | null;
      /** O ato que a publicação corrige; `null` na primeira publicação do item. */
      readonly corrigido: AtoDoProcessoDto | null;
    };

/** O ato que a publicação corrige, quando o modo já o fixa; `null` quando não fixa nenhum. */
export function atoDaCorrecao(modo: ModoDaPublicacao | null): AtoDoProcessoDto | null {
  if (modo?.tipo === 'correcao') return modo.ato;
  return modo?.tipo === 'previsto' ? modo.corrigido : null;
}

/** O item do edital que se publica; `null` fora do modo dos itens previstos. */
export function itemDo(modo: ModoDaPublicacao | null): ProdutoPrevistoDto | null {
  return modo?.tipo === 'previsto' ? modo.item : null;
}

/** A política a confirmar antes de enviar; só o item que é resultado a traz. */
export function politicaDo(modo: ModoDaPublicacao | null): PoliticaParaConfirmar | null {
  return modo?.tipo === 'previsto' ? modo.politica : null;
}

/** O tipo do ato é escolhido na tela, salvo no item do edital, que já o traz. */
export function escolheOTipo(modo: ModoDaPublicacao | null): boolean {
  return modo?.tipo !== 'previsto';
}

/** O título do formulário: a correção nomeia o ato corrigido, e o item, o tipo que publica. */
export function tituloDa(modo: ModoDaPublicacao | null): string {
  const corrigido = atoDaCorrecao(modo);
  if (corrigido !== null) return `Corrigir ${rotuloDoAto(corrigido)}`;
  const item = itemDo(modo);
  return item === null ? 'Publicar documento' : `Publicar ${item.tipoNome ?? item.tipoCodigo}`;
}
