import { glifosDoPrimeicons } from '@uniplus/shared-testing';
import { NAVEGACAO_DO_PORTAL } from './navegacao-do-portal';

it('todo item da navegação mostra um ícone que existe no PrimeIcons', () => {
  // Um glifo inexistente fica vazio sem apresentar erro.
  expect(
    NAVEGACAO_DO_PORTAL.filter((item) => !glifosDoPrimeicons().has(item.icon)).map(
      (item) => item.label,
    ),
  ).toEqual([]);
});
