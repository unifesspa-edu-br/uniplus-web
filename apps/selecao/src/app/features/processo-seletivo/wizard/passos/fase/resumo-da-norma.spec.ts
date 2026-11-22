import { describe, expect, it } from 'vitest';

import { descreverNorma, normaComum } from './resumo-da-exigencia';

describe('normas da exigência', () => {
  it('descreve a norma pelo alcance e pela identificação', () => {
    expect(
      descreverNorma({
        referencia: ' Lei 12.711/2012, art. 3º ',
        abrangencia: 'FEDERAL',
        situacao: 'PENDENTE',
        observacao: '',
      }),
    ).toEqual({
      referencia: 'Lei 12.711/2012, art. 3º',
      detalhe: 'Lei federal · Pendente',
      observacao: '',
    });
    expect(
      descreverNorma({
        referencia: '',
        abrangencia: 'INTERNA_EDITAL',
        situacao: 'RESOLVIDO',
        observacao: '',
      }).referencia,
    ).toBe('Sem referência declarada');
  });

  describe('norma comum da fase', () => {
    const norma = {
      referencia: 'Edital nº 1/2027, Anexo III',
      abrangencia: 'INTERNA_EDITAL',
      situacao: 'RESOLVIDO',
      observacao: '',
    };

    it('é a norma única e resolvida de todas as exigências', () => {
      expect(
        normaComum([[norma], [{ ...norma, referencia: ' Edital nº 1/2027, Anexo III ' }]]),
      ).toBe(norma);
    });

    it('não existe quando alguma exigência tem outra norma, duas ou nenhuma', () => {
      expect(normaComum([[norma], [{ ...norma, referencia: 'Anexo IV' }]])).toBeNull();
      expect(normaComum([[norma], [norma, norma]])).toBeNull();
      expect(normaComum([[norma], []])).toBeNull();
      expect(normaComum([])).toBeNull();
    });

    /** A pendente continua acusada em cada linha que a publicação recusaria. */
    it('não sobe a norma pendente, mesmo igual em todas', () => {
      const pendente = { ...norma, situacao: 'PENDENTE' };

      expect(normaComum([[pendente], [pendente]])).toBeNull();
    });
  });
});
