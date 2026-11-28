import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { exemploDoContrato } from '../exemplos.testing';
import { valoresDoFormulario } from './vagas.adaptador';

const CATALOGOS = {
  ofertas: catalogoPorCodigo([]),
  modalidades: catalogoPorCodigo([{ codigo: 'PCD', rotulo: 'Pessoa com deficiência' }]),
};

function rotuloDaPrimeiraModalidade(nome: string | undefined, codigo: string): string {
  const documento = exemploDoContrato('inscricao-pelo-sistema');
  const [oferta] = documento.distribuicaoVagas ?? [];
  const [modalidade] = oferta.modalidades ?? [];
  const alterado = {
    ...documento,
    distribuicaoVagas: [{ ...oferta, modalidades: [{ ...modalidade, codigo, nome }] }],
  };
  return valoresDoFormulario(alterado, CATALOGOS).ofertas[0].modalidades[0].rotulo;
}

describe('adaptador do passo Vagas — rótulo da modalidade', () => {
  it('mostra o código e o nome que o processo gravou', () => {
    expect(rotuloDaPrimeiraModalidade('Modalidade de teste Alfa', 'ZZ_TESTE')).toBe(
      'ZZ_TESTE — Modalidade de teste Alfa',
    );
  });

  it('sem nome gravado, usa o nome do catálogo vivo', () => {
    expect(rotuloDaPrimeiraModalidade(undefined, 'PCD')).toBe('PCD — Pessoa com deficiência');
  });

  it('sem nome gravado nem no catálogo, mostra só o código', () => {
    expect(rotuloDaPrimeiraModalidade(undefined, 'ZZ_TESTE')).toBe('ZZ_TESTE');
  });
});
