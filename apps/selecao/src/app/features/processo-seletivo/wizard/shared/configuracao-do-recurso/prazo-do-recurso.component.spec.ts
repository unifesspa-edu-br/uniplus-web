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
    ['zero', '0', 'HORAS'],
    ['fração em dias úteis', '1,5', 'DIAS_UTEIS'],
    ['fração em horas', '1,5', 'HORAS'],
  ])('mostra o prazo %s como veio, sem conferir', (_nome, texto, codigo) => {
    const fixture = montarPrazo({ valor: texto, unidade: codigo });

    expect(campoDoValor(fixture).value).toBe(texto);
    expect(campoDaUnidade(fixture).value).toBe(codigo);
    expect(campoDoValor(fixture).hasAttribute('aria-invalid')).toBe(false);
    expect(campoDaUnidade(fixture).hasAttribute('aria-invalid')).toBe(false);
  });

  it('oferece a opção em branco e as unidades dadas, e nenhuma outra', () => {
    expect(codigosDaUnidade(montarPrazo())).toEqual(['', 'DIAS_UTEIS', 'HORAS']);
  });

  it('diz na opção em branco o que a tela mandou, ou "Escolha a unidade"', () => {
    const textoEmBranco = (fixture: FixtureDoPrazo) =>
      campoDaUnidade(fixture).options[0]?.textContent?.trim();

    expect(textoEmBranco(montarPrazo())).toBe('Escolha a unidade');
    expect(textoEmBranco(montarPrazo({ opcaoEmBranco: 'Sem unidade definida' }))).toBe(
      'Sem unidade definida',
    );
  });

  it('mantém à vista e marcada a unidade gravada que o vocabulário não oferece', () => {
    const fixture = montarPrazo({ valor: '2', unidade: 'DIAS' });

    expect(codigosDaUnidade(fixture)).toEqual(['', 'DIAS_UTEIS', 'HORAS', 'DIAS']);
    expect(campoDaUnidade(fixture).value).toBe('DIAS');
    expect(campoDaUnidade(fixture).selectedOptions[0]?.textContent?.trim()).toBe(
      'DIAS — não é mais oferecida',
    );
  });

  it('as unidades oferecidas não levam a marca de fora do vocabulário', () => {
    const fixture = montarPrazo({ unidade: 'HORAS' });

    expect(campoDaUnidade(fixture).selectedOptions[0]?.textContent?.trim()).toBe('horas');
  });

  it('avisa o valor digitado, inclusive fração, sem aceitar nem recusar', () => {
    const fixture = montarPrazo({ unidade: 'DIAS_UTEIS' });
    const avisos = vi.fn();
    fixture.componentInstance.valorAlterado.subscribe(avisos);

    campoDoValor(fixture).value = '1,5';
    campoDoValor(fixture).dispatchEvent(new Event('input'));

    expect(avisos).toHaveBeenCalledExactlyOnceWith('1,5');
  });

  it('avisa a unidade escolhida e a em branco', () => {
    const fixture = montarPrazo({ unidade: 'HORAS' });
    const avisos = vi.fn();
    fixture.componentInstance.unidadeAlterada.subscribe(avisos);

    for (const codigo of ['DIAS_UTEIS', '']) {
      campoDaUnidade(fixture).value = codigo;
      campoDaUnidade(fixture).dispatchEvent(new Event('change'));
    }

    expect(avisos.mock.calls).toEqual([['DIAS_UTEIS'], ['']]);
  });
});

describe('PrazoDoRecursoComponent: sem unidade para escolher', () => {
  it.each([
    ['carregando', 'Carregando as opções…'],
    ['falhou', 'As opções não carregaram. Use "Tentar de novo" no aviso do topo do passo.'],
    ['pronta', 'Nenhuma opção disponível.'],
  ] as const)('com a leitura %s, desabilita a unidade e diz por quê', (situacao, texto) => {
    const fixture = montarPrazo({ unidades: [], situacao });
    const paragrafo = fixture.nativeElement.querySelector(`#${IDS.situacao}`) as HTMLElement;

    expect(campoDaUnidade(fixture).disabled).toBe(true);
    expect(paragrafo.textContent?.trim()).toBe(texto);
    expect(paragrafo.getAttribute('tabindex')).toBe('-1');
    expect(descritoPor(campoDaUnidade(fixture))).toEqual([IDS.situacao]);
  });

  it('com a unidade gravada, ela segue à vista e o seletor fica disponível', () => {
    const fixture = montarPrazo({ unidades: [], unidade: 'HORAS', situacao: 'falhou' });

    expect(campoDaUnidade(fixture).disabled).toBe(false);
    expect(campoDaUnidade(fixture).value).toBe('HORAS');
    expect(fixture.nativeElement.querySelector(`#${IDS.situacao}`)).toBeNull();
  });

  it('mostra o nome que a leitura deu à unidade que o vocabulário não oferece', () => {
    const fixture = montarPrazo({ unidade: 'DIAS', rotuloLido: 'Dias corridos' });

    expect(campoDaUnidade(fixture).selectedOptions[0]?.textContent?.trim()).toBe(
      'Dias corridos — não é mais oferecida',
    );
  });
});

describe('PrazoDoRecursoComponent: retirar o prazo', () => {
  const botao = (fixture: FixtureDoPrazo) =>
    fixture.nativeElement.querySelector(`#${IDS.retirar}`) as HTMLButtonElement | null;

  it('só mostra o botão quando o prazo é retirável', () => {
    expect(botao(montarPrazo())).toBeNull();
    expect(botao(montarPrazo({ retiravel: true }))?.textContent?.trim()).toBe('Retirar o prazo');
  });

  it('avisa o pedido de retirada, e o botão acompanha o texto dado pela tela', () => {
    const fixture = montarPrazo({
      retiravel: true,
      textoDoBotaoDeRetirar: 'Retirar o prazo da 2ª instância',
    });
    const avisos = vi.fn();
    fixture.componentInstance.retirar.subscribe(avisos);

    botao(fixture)?.click();

    expect(botao(fixture)?.textContent?.trim()).toBe('Retirar o prazo da 2ª instância');
    expect(avisos).toHaveBeenCalledOnce();
  });

  it('desabilita o botão com o prazo', () => {
    expect(botao(montarPrazo({ retiravel: true, desabilitado: true }))?.disabled).toBe(true);
  });
});
