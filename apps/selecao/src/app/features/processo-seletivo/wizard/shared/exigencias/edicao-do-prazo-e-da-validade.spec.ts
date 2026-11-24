import { describe, expect, it } from 'vitest';
import {
  escolherPrazo,
  escolherTipoDeReferencia,
  escolherValidade,
} from './edicao-do-prazo-e-da-validade';

describe('edição do prazo e da validade', () => {
  it('inicia a escolha do prazo sem detalhes', () => {
    expect(escolherPrazo('SEM_PRAZO')).toEqual({
      escolha: 'SEM_PRAZO',
      valor: null,
      unidade: null,
      referencia: null,
      efeitoForaDoPrazo: null,
    });
    expect(escolherPrazo('COM_PRAZO').valor).toBeNull();
  });

  it('inicia a escolha da validade sem detalhes', () => {
    expect(escolherValidade('NAO_EXIGE_DOCUMENTO_VALIDO')).toEqual({
      escolha: 'NAO_EXIGE_DOCUMENTO_VALIDO',
      referencia: null,
      efeitoDoVencimento: null,
    });
    expect(escolherValidade('EXIGE_DOCUMENTO_VALIDO').referencia).toBeNull();
  });

  it('descarta data e fase ao escolher outro tipo de referência', () => {
    expect(escolherTipoDeReferencia('FIM_DAS_INSCRICOES')).toEqual({
      tipo: 'FIM_DAS_INSCRICOES',
      data: null,
      faseCodigo: null,
      faseIdLido: null,
    });
  });
});
