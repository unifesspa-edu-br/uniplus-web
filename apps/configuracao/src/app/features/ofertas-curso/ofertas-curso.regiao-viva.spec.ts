import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  conferirAcessibilidade,
  regiaoVivaQueEnvolve,
  simularGeometriaDoDocumento,
} from '../../shared/acessibilidade/regiao-viva.testing';
import { valoresDaOferta } from './valores-da-oferta.testing';
import { Pagina, montarPagina } from './ofertas-curso.testing';

describe('OfertasCursoPage — região viva da base legal', () => {
  let p: Pagina;
  let restaurarDocumento: () => void;

  beforeEach(async () => {
    restaurarDocumento = simularGeometriaDoDocumento();
    p = await montarPagina([]);
    await p.abrirCadastro();
    p.preencher('programaDeOferta', valoresDaOferta.parfor.codigo);
    await p.propagar();
  });
  afterEach(() => {
    restaurarDocumento();
    p.encerrar();
  });

  const dentro = (raiz: HTMLElement, seletor: string): HTMLElement => {
    const encontrado = raiz.querySelector<HTMLElement>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as HTMLElement;
  };
  const grupo = (): HTMLElement => p.elemento('fieldset[aria-labelledby="cfg-oferta-base-legal"]');
  const rotuloDaBaseLegal = (): HTMLElement => p.campo('baseLegal').closest('label') as HTMLElement;
  const regiaoDoErro = (): HTMLElement => dentro(rotuloDaBaseLegal(), '.field__live');
  const recusarBaseLegal = async (): Promise<void> => {
    p.salvar().click();
    await p.propagar();
  };

  it('nenhuma região viva envolve o título, a etiqueta, o campo nem a dica do grupo', () => {
    const partes = [
      grupo(),
      p.elemento('#cfg-oferta-base-legal'),
      dentro(grupo(), '.tag--warning'),
      p.campo('baseLegal'),
      dentro(rotuloDaBaseLegal(), '.field__hint'),
    ];

    expect(partes.map((parte) => regiaoVivaQueEnvolve(parte))).toEqual(partes.map(() => null));
  });

  it('a região do erro já está montada e vazia antes de o erro aparecer', () => {
    expect(regiaoDoErro().getAttribute('aria-live')).toBe('polite');
    expect(regiaoDoErro().textContent?.trim()).toBe('');
    expect(p.campo('baseLegal').getAttribute('aria-invalid')).toBeNull();
  });

  it('o erro entra na mesma região e continua ligado ao campo', async () => {
    const regiao = regiaoDoErro();
    await recusarBaseLegal();

    const erro = dentro(regiao, '.field__error');
    expect(regiaoDoErro()).toBe(regiao);
    expect(regiaoVivaQueEnvolve(erro)).toBe(regiao);
    expect(p.campo('baseLegal').getAttribute('aria-invalid')).toBe('true');
    expect(p.campo('baseLegal').getAttribute('aria-describedby')).toContain(erro.id);
  });

  it('o formulário com o erro não tem violação de acessibilidade', async () => {
    await recusarBaseLegal();

    const { violations } = await conferirAcessibilidade(p.fixture.nativeElement);
    expect(violations.map((v) => v.id)).toEqual([]);
  });
});
