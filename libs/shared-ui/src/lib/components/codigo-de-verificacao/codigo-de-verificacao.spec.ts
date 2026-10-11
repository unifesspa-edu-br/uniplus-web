import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodigoDeVerificacaoComponent } from './codigo-de-verificacao';

const CODIGO = '9e036c76130c5f7b0e8f9241ae1b6cdf';

function montar(clipboard: Pick<Clipboard, 'writeText'> | undefined) {
  Object.defineProperty(window.navigator, 'clipboard', { value: clipboard, configurable: true });
  const fixture = TestBed.createComponent(CodigoDeVerificacaoComponent);
  fixture.componentRef.setInput('codigo', CODIGO);
  fixture.detectChanges();
  return { fixture, tela: fixture.nativeElement as HTMLElement };
}

describe('CodigoDeVerificacaoComponent', () => {
  afterEach(() => {
    Reflect.deleteProperty(window.navigator, 'clipboard');
  });

  it('o código é texto contínuo, sem espaço, embora saia em grupos de oito na tela', () => {
    const { tela } = montar(undefined);
    const codigo = tela.querySelector('code') as HTMLElement;

    expect(codigo.textContent).toBe(CODIGO);
    expect([...codigo.querySelectorAll('span')].map((s) => s.textContent)).toEqual([
      '9e036c76',
      '130c5f7b',
      '0e8f9241',
      'ae1b6cdf',
    ]);
  });

  it('copia o código inteiro e anuncia a cópia', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { fixture, tela } = montar({ writeText });

    (tela.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(CODIGO);
    expect(tela.querySelector('[role="status"]')?.textContent?.trim()).toBe('Código copiado.');
  });

  it('sem área de transferência, não oferece copiar', () => {
    const { tela } = montar(undefined);

    expect(tela.querySelector('button')).toBeNull();
  });
});

describe('components.css — código de verificação', () => {
  const folha = readFileSync(resolve(__dirname, '../../../styles/components.css'), 'utf-8').replace(
    /\/\*[\s\S]*?\*\//gu,
    '',
  );

  it('os grupos são caixas em linha, e não itens flex, para a seleção copiar sem quebras', () => {
    expect(folha).toMatch(/\.codigo-de-verificacao__codigo\s*\{[^}]*display:\s*block/u);
    expect(folha).toMatch(/\.codigo-de-verificacao__grupo\s*\{[^}]*display:\s*inline-block/u);
  });
});
