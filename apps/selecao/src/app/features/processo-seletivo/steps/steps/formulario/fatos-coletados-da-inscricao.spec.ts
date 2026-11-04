import { describe, expect, it } from 'vitest';

import { fatosCitadosPelasExigencias } from './fatos-coletados-da-inscricao';
import {
  ID_TITULO,
  ID_RESERVISTA,
  exigenciaCom,
  rascunhoCom,
} from './formulario-de-inscricao.testing';

describe('os fatos que as exigências citam', () => {
  it('reúne os fatos de todas as condições, de todas as exigências', () => {
    const citados = fatosCitadosPelasExigencias(
      rascunhoCom(
        exigenciaCom(ID_TITULO, [
          { fato: 'NACIONALIDADE', operador: 'DIFERENTE', valor: '"ESTRANGEIRO"' },
          { fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' },
        ]),
        exigenciaCom(ID_RESERVISTA, [{ fato: 'SEXO', operador: 'IGUAL', valor: '"MASCULINO"' }]),
      ),
    );

    expect([...citados].sort()).toEqual(['NACIONALIDADE', 'SEXO']);
  });
});
