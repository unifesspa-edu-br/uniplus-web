import { expectTypeOf, it } from 'vitest';

import type { ModalidadeDoFormulario } from './distribuicao-de-vagas.edicao';

it('exige origem explícita para distinguir modalidade existente de nova', () => {
  expectTypeOf<ModalidadeDoFormulario>().toHaveProperty('origem').toEqualTypeOf<number | null>();
});
