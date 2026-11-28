import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  conferirAcessibilidade,
  regiaoVivaQueEnvolve,
  simularGeometriaDoDocumento,
} from '../../shared/acessibilidade/regiao-viva.testing';
import { PaginaDaModalidade } from './modalidade-form.page.testing';

describe('ModalidadeFormPage — região viva do resumo das escolhas', () => {
  let pagina: PaginaDaModalidade;
  let restaurarDocumento: () => void;

  beforeEach(async () => {
    restaurarDocumento = simularGeometriaDoDocumento();
    pagina = new PaginaDaModalidade();
    await pagina.montar();
  });
  afterEach(() => {
    restaurarDocumento();
    pagina.verificar();
  });

  const tela = (): HTMLElement => pagina.fixture.nativeElement;
  const resumo = (): HTMLElement =>
    tela().querySelector('aside[aria-label="Resumo das escolhas"]') as HTMLElement;

  it('o resumo é só apoio visual: nem ele nem o que há dentro dele é região viva', () => {
    const itens = [resumo(), ...resumo().querySelectorAll('h2, li')];

    expect(resumo()).not.toBeNull();
    expect(itens.map((item) => regiaoVivaQueEnvolve(item))).toEqual(itens.map(() => null));
    expect(resumo().querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it('o formulário não tem violação de acessibilidade', async () => {
    const { violations } = await conferirAcessibilidade(tela());
    expect(violations.map((v) => v.id)).toEqual([]);
  });
});
