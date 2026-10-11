import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DOCUMENT } from '@angular/common';
import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DocumentoComponent } from './documento';

@Component({
  standalone: true,
  imports: [DocumentoComponent],
  template: `
    <ui-documento titulo="Comprovante de inscrição">
      <button uiDocumentoAcoes type="button">Imprimir comprovante</button>
      <p id="corpo">Conteúdo</p>
    </ui-documento>
  `,
})
class DocumentoDeTeste {
  readonly documento = viewChild.required(DocumentoComponent);
}

function montar() {
  const fixture = TestBed.createComponent(DocumentoDeTeste);
  fixture.detectChanges();
  return { fixture, tela: fixture.nativeElement as HTMLElement };
}

const impressoEm = (tela: HTMLElement): string =>
  [...tela.querySelectorAll('.documento__papel p')]
    .map((p) => p.textContent?.trim() ?? '')
    .find((texto) => texto.startsWith('Impresso em')) ?? '';

describe('DocumentoComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('no beforeprint, o instante da impressão entra no papel na hora, sem esperar a detecção de mudanças', () => {
    const { tela } = montar();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-11T13:30:00Z'));

    window.dispatchEvent(new Event('beforeprint'));

    expect(impressoEm(tela)).toBe('Impresso em 11/12/2026, 10:30');
  });

  it('imprimir atualiza o instante antes de abrir a janela de impressão', () => {
    const { fixture, tela } = montar();
    const janela = TestBed.inject(DOCUMENT).defaultView as Window;
    let noPapel = '';
    vi.spyOn(janela, 'print').mockImplementation(() => {
      noPapel = impressoEm(tela);
    });

    fixture.componentInstance.documento().imprimir();

    expect(noPapel).toMatch(/^Impresso em \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/u);
  });

  it('é o dono do h1 e das ações; o conteúdo vai para o corpo', () => {
    const { tela } = montar();

    expect(tela.querySelectorAll('h1')).toHaveLength(1);
    expect(tela.querySelector('.page-header__actions button')?.textContent?.trim()).toBe(
      'Imprimir comprovante',
    );
    expect(tela.querySelector('.documento__corpo #corpo')).not.toBeNull();
  });

  it('o cabeçalho de tela, com o título e as ações, não sai no papel; o do papel só sai nele', () => {
    const { tela } = montar();
    const cabecalhoDeTela = tela.querySelector('ui-page-header') as HTMLElement;

    expect(cabecalhoDeTela.classList).toContain('u-no-print');
    expect(cabecalhoDeTela.querySelector('h1')).not.toBeNull();
    expect(cabecalhoDeTela.querySelector('.documento__acoes button')).not.toBeNull();
    expect(tela.querySelector('.documento__papel')?.classList).toContain('u-print-only');
  });

  it('focar leva o foco ao título', () => {
    const { fixture, tela } = montar();

    fixture.componentInstance.documento().focar();

    expect(document.activeElement).toBe(tela.querySelector('h1'));
  });
});

describe('components.css — papel do documento', () => {
  const folha = readFileSync(resolve(__dirname, '../../../styles/components.css'), 'utf-8').replace(
    /\/\*[\s\S]*?\*\//gu,
    '',
  );
  /** O bloco de impressão que trata do documento. */
  const impressao =
    folha.match(/@media print \{\s*:root:has\(\.documento\)[\s\S]*?\n\}/u)?.[0] ?? '';

  it('imprime em fundo branco e texto escuro, seja qual for o tema', () => {
    expect(impressao).toMatch(/--surface-card:\s*#ffffff/u);
    expect(impressao).toMatch(/background:\s*#ffffff/u);
    expect(impressao).toMatch(/--text-primary:\s*#111111/u);
    expect(impressao).toMatch(/\.documento__papel\s*\{[^}]*display:\s*flex/u);
  });

  it('a página A4 é nomeada e vale só para o documento', () => {
    expect(folha).toMatch(/@page documento\s*\{[^}]*size:\s*A4/u);
    expect(folha).not.toMatch(/@page\s*\{/u);
    // Na raiz: num descendente, os ancestrais ficariam na página padrão e abririam uma folha em branco.
    expect(folha).toMatch(/:root:has\(\.documento\)\s*\{[^}]*page:\s*documento/u);
  });

  it('o título com foco programático não leva anel', () => {
    expect(folha).toMatch(/\.page-header__title:focus-visible\s*\{[^}]*box-shadow:\s*none/u);
  });

  it('as cores de feedback e de link voltam às do tema claro, para o tema de contraste não sumir no papel', () => {
    expect(impressao).toMatch(/--color-success-700:\s*#0a5a16/u);
    expect(impressao).toMatch(/--color-success-50:\s*#e7f4e9/u);
    expect(impressao).toMatch(/--text-link:\s*#1351b4/u);
    expect(impressao).toMatch(/--color-primary:\s*#1351b4/u);
  });
});
