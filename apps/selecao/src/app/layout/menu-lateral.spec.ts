import { glifosDoPrimeicons } from '@uniplus/shared-testing';
import { MENU_LATERAL } from './menu-lateral';

it('todo item do menu lateral mostra um ícone que existe no PrimeIcons', () => {
  // Um glifo inexistente fica vazio sem apresentar erro.
  expect(
    MENU_LATERAL.flatMap((grupo) => grupo.items)
      .filter((item) => !glifosDoPrimeicons().has(item.icon))
      .map((item) => item.label),
  ).toEqual([]);
});
