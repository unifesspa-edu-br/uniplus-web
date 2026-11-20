import type { CodigoComRotulo } from '../codigo-com-rotulo';
import type { UiSelectOption } from './select';

/**
 * As opções vêm sempre do vocabulário da API, nunca do enum gerado: o web não escreve rótulo nem
 * monta opção a partir dos códigos do tipo. Uma opção que não é código do enum, como "Todas" num
 * filtro, a tela acrescenta pelo `placeholderText` do `ui-select`. O `ui-select` entrega '' ao
 * controle quando ela é escolhida, e é a tela que, nesse caso, não envia o parâmetro na consulta:
 * só o parâmetro ausente significa sem filtro.
 */
export function opcoesDosCodigos<C extends string>(
  valores: ReadonlyArray<CodigoComRotulo<C> & { readonly descricao?: string }>,
): readonly UiSelectOption<C>[] {
  return valores.map(({ codigo, rotulo, descricao }) => ({
    value: codigo,
    label: rotulo,
    ...(descricao === undefined ? {} : { description: descricao }),
  }));
}
