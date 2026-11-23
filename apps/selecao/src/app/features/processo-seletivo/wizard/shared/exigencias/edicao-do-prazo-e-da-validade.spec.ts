import { describe, expect, it } from 'vitest';
import {
  escolherPrazo,
  escolherTipoDeReferencia,
  escolherValidade,
} from './edicao-do-prazo-e-da-validade';

describe('edição do prazo e da validade', () => {
  it('inicia a escolha do prazo sem detalhes', () => {
    expect(escolherPrazo('semPrazo')).toEqual({
      escolha: 'semPrazo',
      valor: null,
      unidade: null,
      referencia: null,
      efeitoForaDoPrazo: null,
    });
    expect(escolherPrazo('comPrazo').valor).toBeNull();
  });

  it('inicia a escolha da validade sem detalhes', () => {
    expect(escolherValidade('naoExigeDocumentoValido')).toEqual({
      escolha: 'naoExigeDocumentoValido',
      referencia: null,
      efeitoDoVencimento: null,
    });
    expect(escolherValidade('exigeDocumentoValido').referencia).toBeNull();
  });

  it('descarta data e fase ao escolher outro tipo de referência', () => {
    expect(escolherTipoDeReferencia('fimDasInscricoes')).toEqual({
      tipo: 'fimDasInscricoes',
      data: null,
      faseCodigo: null,
      faseIdLido: null,
    });
  });
});
