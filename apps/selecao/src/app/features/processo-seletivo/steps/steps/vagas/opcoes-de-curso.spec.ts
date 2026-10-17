import { describe, expect, it } from 'vitest';
import { mockProblemDetails } from '@uniplus/shared-core/http';

import {
  erroDasOpcoes,
  numeroDeOpcoesPrimeiro,
  recusadoPorOpcoesAcimaDasOfertas,
  TEXTO_OPCOES_ACIMA_DAS_OFERTAS,
} from './opcoes-de-curso';

describe('erroDasOpcoes', () => {
  it('com 2 opções, exige pelo menos dois cursos', () => {
    expect(erroDasOpcoes('2', 1)).toBe(TEXTO_OPCOES_ACIMA_DAS_OFERTAS);
    expect(erroDasOpcoes('2', 2)).toBeNull();
  });

  it('com 1 opção, um curso basta', () => {
    expect(erroDasOpcoes('1', 1)).toBeNull();
  });

  it('exige o número declarado', () => {
    expect(erroDasOpcoes('', 3)).not.toBeNull();
  });
});

describe('numeroDeOpcoesPrimeiro', () => {
  it('baixa o número antes quando a nova lista tem menos ofertas que o número gravado', () => {
    expect(numeroDeOpcoesPrimeiro(2, 1)).toBe(true);
  });

  it('grava a distribuição antes quando a lista cobre o número gravado', () => {
    expect(numeroDeOpcoesPrimeiro(1, 2)).toBe(false);
    expect(numeroDeOpcoesPrimeiro(2, 2)).toBe(false);
  });

  it('na primeira gravação, não há número a baixar', () => {
    expect(numeroDeOpcoesPrimeiro(null, 1)).toBe(false);
  });
});

describe('recusadoPorOpcoesAcimaDasOfertas', () => {
  const CODIGO = 'uniplus.selecao.processo_seletivo.opcoes_de_curso_acima_das_ofertas';

  it('reconhece o código na raiz e no erro de campo', () => {
    expect(recusadoPorOpcoesAcimaDasOfertas(mockProblemDetails({ code: CODIGO }))).toBe(true);
    expect(
      recusadoPorOpcoesAcimaDasOfertas(
        mockProblemDetails({
          code: 'uniplus.validation',
          errors: [{ field: 'numero', code: CODIGO, message: 'x' }],
        }),
      ),
    ).toBe(true);
  });

  it('não confunde outra recusa', () => {
    expect(
      recusadoPorOpcoesAcimaDasOfertas(
        mockProblemDetails({ code: 'uniplus.selecao.processo_seletivo.opcoes_de_curso_invalido' }),
      ),
    ).toBe(false);
  });
});
