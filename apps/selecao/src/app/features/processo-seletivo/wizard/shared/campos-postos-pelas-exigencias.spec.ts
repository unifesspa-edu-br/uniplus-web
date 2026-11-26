import { describe, expect, it } from 'vitest';
import { CamposPostosPelasExigencias } from './campos-postos-pelas-exigencias';

describe('CamposPostosPelasExigencias', () => {
  it('começa vazia e consulta os códigos', () => {
    expect(CamposPostosPelasExigencias.vazia().contem('PCD')).toBe(false);
  });

  it('acrescenta códigos sem alterar o valor anterior, mesmo com repetição', () => {
    const anterior = CamposPostosPelasExigencias.vazia().comOsQueEntraram(['PCD']);
    const atual = anterior.comOsQueEntraram(['PCD', 'RENDA', 'RENDA']);
    expect(atual).not.toBe(anterior);
    expect(atual.contem('PCD')).toBe(true);
    expect(atual.contem('RENDA')).toBe(true);
    expect(anterior.contem('RENDA')).toBe(false);
  });

  it('mantém a identidade quando nenhum código novo entra', () => {
    const campos = CamposPostosPelasExigencias.vazia().comOsQueEntraram(['PCD']);
    expect(campos.comOsQueEntraram([])).toBe(campos);
    expect(campos.comOsQueEntraram(['PCD', 'PCD'])).toBe(campos);
    const vazios = CamposPostosPelasExigencias.vazia();
    expect(vazios.comOsQueEntraram([])).toBe(vazios);
  });

  it('mantém somente os presentes sem alterar o valor anterior', () => {
    const anterior = CamposPostosPelasExigencias.vazia().comOsQueEntraram(['PCD', 'RENDA']);
    const atual = anterior.soOsPresentes(new Set(['PCD', 'OUTRO']));
    expect(atual).not.toBe(anterior);
    expect(atual.contem('PCD')).toBe(true);
    expect(atual.contem('RENDA')).toBe(false);
    expect(anterior.contem('RENDA')).toBe(true);
    expect(anterior.soOsPresentes(new Set()).contem('PCD')).toBe(false);
    expect(
      CamposPostosPelasExigencias.vazia()
        .soOsPresentes(new Set(['PCD']))
        .contem('PCD'),
    ).toBe(false);
  });

  it('esvazia sem alterar o valor anterior', () => {
    const anterior = CamposPostosPelasExigencias.vazia().comOsQueEntraram(['PCD']);
    const atual = anterior.esvaziada();
    expect(atual).not.toBe(anterior);
    expect(atual.contem('PCD')).toBe(false);
    expect(anterior.contem('PCD')).toBe(true);
    expect(atual.esvaziada()).not.toBe(atual);
  });
});
