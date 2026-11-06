import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnuncioDaConclusao } from './anuncio-da-conclusao';

describe('AnuncioDaConclusao', () => {
  let anuncio: AnuncioDaConclusao;
  const regioes = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="status"].sr-only'));

  beforeEach(() => {
    vi.useFakeTimers();
    anuncio = TestBed.inject(AnuncioDaConclusao);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('a região existe antes do texto, que entra depois e some em seguida', () => {
    anuncio.anunciar('Dados carregados.');
    expect(regioes()[0].textContent).toBe('');

    vi.advanceTimersByTime(100);
    expect(regioes()[0].textContent).toBe('Dados carregados.');

    vi.advanceTimersByTime(5000);
    expect(regioes()[0].textContent).toBe('');
  });

  it('com um drawer modal aberto, a região fica dentro dele, onde a página não está inerte', () => {
    document.body.innerHTML = '<dialog id="drawer" open></dialog>';

    anuncio.anunciar('Dados carregados.');

    expect(regioes()[0].closest('dialog')?.id).toBe('drawer');
  });

  it('só há uma região, mesmo depois de vários avisos', () => {
    anuncio.anunciar('a');
    anuncio.anunciar('b');

    expect(regioes()).toHaveLength(1);
  });

  it('dois avisos iguais seguidos esvaziam a região entre eles e leem o texto de novo', () => {
    anuncio.anunciar('Dados carregados.');
    vi.advanceTimersByTime(100);
    expect(regioes()[0].textContent).toBe('Dados carregados.');

    anuncio.anunciar('Dados carregados.');
    expect(regioes()[0].textContent).toBe('');
    vi.advanceTimersByTime(100);
    expect(regioes()[0].textContent).toBe('Dados carregados.');
  });

  it('o temporizador do aviso anterior não esvazia o aviso novo', () => {
    anuncio.anunciar('a');
    vi.advanceTimersByTime(4000);
    anuncio.anunciar('b');
    vi.advanceTimersByTime(1100);

    expect(regioes()[0].textContent).toBe('b');
  });

  it('ao ser destruído, cancela os temporizadores e remove a região', () => {
    anuncio.anunciar('a');
    TestBed.resetTestingModule();

    expect(regioes()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
