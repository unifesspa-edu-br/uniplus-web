import { beforeEach, describe, expect, it } from 'vitest';

import { CenarioDoEditorDeFormulario } from './editor-de-formulario.testing';

describe('EditorDeFormularioComponent: seções e movimento', () => {
  let cenario: CenarioDoEditorDeFormulario;

  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
  });

  it('mostra na região de status a recusa do movimento que quebraria uma condição, sem mexer no conteúdo', () => {
    cenario.clicar('f-item-B-subir');
    cenario.detectar();

    expect(cenario.emitidos).toEqual([]);
    expect(cenario.status()).toBe(
      '“Campo B” cita “A”, que ficaria depois. Mova primeiro o campo citado.',
    );
  });

  it('anuncia a posição nova do campo movido', () => {
    cenario.clicar('f-item-C-subir');
    cenario.detectar();

    expect(cenario.emitidos).toHaveLength(1);
    expect(cenario.status()).toBe('“Campo C” movido para a posição 2 de 3 em Escolaridade.');
  });

  it('põe as ações da seção na linha do título e não chama a seção de etapa', () => {
    const cabecalho = cenario.tela.querySelector('#f-etapa-S1-nome')?.parentElement as HTMLElement;
    const subir = cenario.tela.querySelector('#f-etapa-S1-subir') as HTMLButtonElement;

    expect(cabecalho.contains(subir)).toBe(true);
    expect(subir.textContent?.trim()).toBe('Subir');
    expect(subir.getAttribute('aria-label')).toBe('Subir a seção Escolaridade');
    const nomesAcessiveis = [...cenario.tela.querySelectorAll('[aria-label]')].map(
      (e) => e.getAttribute('aria-label') ?? '',
    );
    expect([cenario.tela.textContent ?? '', ...nomesAcessiveis].join(' ')).not.toMatch(
      /\betapas?\b/i,
    );
  });

  it('põe as ações do campo na linha do título, como as da seção', () => {
    const subir = cenario.tela.querySelector('#f-item-C-subir') as HTMLButtonElement;

    expect(subir.closest('.editor-formulario__cabecalho')).not.toBeNull();
    expect(subir.textContent?.trim()).toBe('Subir');
    expect(subir.getAttribute('aria-label')).toBe('Subir Campo C');
  });

  it('recolhe e expande a etapa pelo título, mantendo à vista o resumo do que ela tem', () => {
    const alternar = cenario.tela.querySelector('#f-etapa-S1-nome button') as HTMLButtonElement;
    const corpo = cenario.tela.querySelector('#f-etapa-S1-corpo') as HTMLElement;

    expect(alternar.getAttribute('aria-expanded')).toBe('true');
    expect(alternar.getAttribute('aria-controls')).toBe('f-etapa-S1-corpo');
    expect(corpo.hidden).toBe(false);
    expect(cenario.tela.querySelector('.editor-formulario__resumo')?.textContent?.trim()).toBe(
      '3 campos',
    );

    alternar.click();
    cenario.detectar();

    expect(alternar.getAttribute('aria-expanded')).toBe('false');
    expect(corpo.hidden).toBe(true);
    expect(cenario.tela.querySelector('#f-etapa-S1-nome')?.textContent).toContain(
      '1. Escolaridade',
    );

    alternar.click();
    cenario.detectar();

    expect(alternar.getAttribute('aria-expanded')).toBe('true');
    expect(corpo.hidden).toBe(false);
  });
});
