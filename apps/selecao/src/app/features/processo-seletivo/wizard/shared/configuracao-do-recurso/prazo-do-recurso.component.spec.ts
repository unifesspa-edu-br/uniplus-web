import { describe, expect, it, vi } from 'vitest';

import {
  campoDaUnidade,
  campoDoValor,
  descritoPor,
  IDS,
  IDS_COM_AJUDA,
  montarPrazo,
  type FixtureDoPrazo,
} from './prazo-do-recurso.testing';

const codigosDaUnidade = (fixture: FixtureDoPrazo) =>
  Array.from(campoDaUnidade(fixture).options).map((opcao) => opcao.value);

describe('PrazoDoRecursoComponent: estrutura', () => {
  it('é um grupo nomeado pela legenda, com os dois campos ligados aos rótulos', () => {
    const fixture = montarPrazo();
    const nativo = fixture.nativeElement as HTMLElement;

    expect(nativo.querySelector('fieldset legend')?.textContent?.trim()).toBe(
      'Prazo de interposição',
    );
    expect(nativo.querySelector(`label[for="${IDS.valor}"]`)?.textContent?.trim()).toBe('Valor');
    expect(nativo.querySelector(`label[for="${IDS.unidade}"]`)?.textContent?.trim()).toBe(
      'Unidade',
    );
    expect(campoDoValor(fixture).getAttribute('inputmode')).toBe('decimal');
  });

  it('com texto de obrigatoriedade, a legenda termina com ele e os dois campos são obrigatórios', () => {
    const fixture = montarPrazo({ textoDeObrigatoriedade: '(obrigatório)' });

    expect(fixture.nativeElement.querySelector('legend').textContent.trim()).toBe(
      'Prazo de interposição (obrigatório)',
    );
    expect(campoDoValor(fixture).getAttribute('aria-required')).toBe('true');
    expect(campoDaUnidade(fixture).getAttribute('aria-required')).toBe('true');
  });

  it('sem texto de obrigatoriedade, a legenda fica só com o nome e nenhum campo é obrigatório', () => {
    const fixture = montarPrazo();

    expect(fixture.nativeElement.querySelector('legend').textContent.trim()).toBe(
      'Prazo de interposição',
    );
    expect(campoDoValor(fixture).hasAttribute('aria-required')).toBe(false);
    expect(campoDaUnidade(fixture).hasAttribute('aria-required')).toBe(false);
  });

  it('descreve os dois campos pela ajuda que a tela desenha fora do grupo', () => {
    const fixture = montarPrazo({ ids: IDS_COM_AJUDA });

    expect(descritoPor(campoDoValor(fixture))).toEqual([IDS_COM_AJUDA.ajuda]);
    expect(descritoPor(campoDaUnidade(fixture))).toEqual([IDS_COM_AJUDA.ajuda]);
  });

  it('desabilita os dois campos', () => {
    const fixture = montarPrazo({ desabilitado: true });

    expect(campoDoValor(fixture).disabled).toBe(true);
    expect(campoDaUnidade(fixture).disabled).toBe(true);
  });
});

describe('PrazoDoRecursoComponent: valor e unidade', () => {
  it.each([
    ['vazio', '', ''],
    ['zero', '0', 'horas'],
    ['fração em dias úteis', '1,5', 'diasUteis'],
    ['fração em horas', '1,5', 'horas'],
  ])('mostra o prazo %s como veio, sem conferir', (_nome, texto, codigo) => {
    const fixture = montarPrazo({ valor: texto, unidade: codigo });

    expect(campoDoValor(fixture).value).toBe(texto);
    expect(campoDaUnidade(fixture).value).toBe(codigo);
    expect(campoDoValor(fixture).hasAttribute('aria-invalid')).toBe(false);
    expect(campoDaUnidade(fixture).hasAttribute('aria-invalid')).toBe(false);
  });

  it('oferece a opção em branco e as unidades dadas, e nenhuma outra', () => {
    expect(codigosDaUnidade(montarPrazo())).toEqual(['', 'diasUteis', 'horas']);
  });

  it('diz na opção em branco o que a tela mandou, ou "Escolha a unidade"', () => {
    const textoEmBranco = (fixture: FixtureDoPrazo) =>
      campoDaUnidade(fixture).options[0]?.textContent?.trim();

    expect(textoEmBranco(montarPrazo())).toBe('Escolha a unidade');
    expect(textoEmBranco(montarPrazo({ opcaoEmBranco: 'Sem suspensividade' }))).toBe(
      'Sem suspensividade',
    );
  });

  it('mantém à vista e marcada a unidade gravada que o vocabulário não oferece', () => {
    const fixture = montarPrazo({ valor: '2', unidade: 'dias' });

    expect(codigosDaUnidade(fixture)).toEqual(['', 'diasUteis', 'horas', 'dias']);
    expect(campoDaUnidade(fixture).value).toBe('dias');
    expect(campoDaUnidade(fixture).selectedOptions[0]?.textContent?.trim()).toBe(
      'dias — não é mais oferecida',
    );
  });

  it('as unidades oferecidas não levam a marca de fora do vocabulário', () => {
    const fixture = montarPrazo({ unidade: 'horas' });

    expect(campoDaUnidade(fixture).selectedOptions[0]?.textContent?.trim()).toBe('horas');
  });

  it('avisa o valor digitado, inclusive fração, sem aceitar nem recusar', () => {
    const fixture = montarPrazo({ unidade: 'diasUteis' });
    const avisos = vi.fn();
    fixture.componentInstance.valorAlterado.subscribe(avisos);

    campoDoValor(fixture).value = '1,5';
    campoDoValor(fixture).dispatchEvent(new Event('input'));

    expect(avisos).toHaveBeenCalledExactlyOnceWith('1,5');
  });

  it('avisa a unidade escolhida e a em branco', () => {
    const fixture = montarPrazo({ unidade: 'horas' });
    const avisos = vi.fn();
    fixture.componentInstance.unidadeAlterada.subscribe(avisos);

    for (const codigo of ['diasUteis', '']) {
      campoDaUnidade(fixture).value = codigo;
      campoDaUnidade(fixture).dispatchEvent(new Event('change'));
    }

    expect(avisos.mock.calls).toEqual([['diasUteis'], ['']]);
  });
});
