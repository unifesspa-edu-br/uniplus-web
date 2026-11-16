import { describe, expect, it } from 'vitest';

import { federal } from './distribuicao-de-vagas.testing';
import { padraoAposTrocarDeRegra } from './edicao-do-padrao';
import { PadraoDoEdital } from './padrao-do-edital';

const PADRAO: PadraoDoEdital = {
  regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
  regraDistribuicaoVersao: '1.0',
  ramoDaDistribuicao: 'LEI_DE_COTAS',
  regraAjusteCodigo: 'AJUSTE-ART-11',
  regraAjusteVersao: '1.0',
  referenciaReservaDemograficaId: 'ref-1',
  modalidades: federal().modalidades,
  pr: '0,5',
};

const TROCA = { codigo: 'OUTRA', versao: '2.0', rol: null, catalogo: [] };

describe('padraoAposTrocarDeRegra', () => {
  it('guarda o ramo que a regra escolhida declara', () => {
    const padrao = padraoAposTrocarDeRegra(PADRAO, { ...TROCA, ramo: 'LEI_DE_COTAS' });

    expect(padrao.ramoDaDistribuicao).toBe('LEI_DE_COTAS');
    expect(padrao.regraAjusteCodigo).toBeUndefined();
    expect(padrao.pr).toBeUndefined();
  });

  it('tira ajuste, referência demográfica e percentual ao sair da Lei de Cotas', () => {
    const padrao = padraoAposTrocarDeRegra(PADRAO, { ...TROCA, ramo: 'QUADRO_FIXADO_NO_EDITAL' });

    expect(padrao).toMatchObject({
      ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
      regraAjusteCodigo: null,
      regraAjusteVersao: null,
      referenciaReservaDemograficaId: null,
      pr: '',
    });
  });

  it('não presume a Lei de Cotas quando a regra não declara o ramo', () => {
    const padrao = padraoAposTrocarDeRegra(PADRAO, { ...TROCA, ramo: null });

    expect(padrao.ramoDaDistribuicao).toBeNull();
    expect(padrao.referenciaReservaDemograficaId).toBeNull();
  });
});
