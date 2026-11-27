import { ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PassoDoWizard } from '../wizard/passo-do-wizard';

import { FocoDoEditor } from './foco-do-editor.service';

function telaComRecusa(): HTMLElement {
  const raiz = document.createElement('div');
  raiz.innerHTML = `<div class="step-error"></div><div class="step-pane">
    <fieldset tabindex="-1" aria-describedby="recusa"><legend>Candidatos atendidos</legend>
    <p id="recusa">Defina os candidatos atendidos.</p></fieldset></div>`;
  document.body.append(raiz);
  TestBed.configureTestingModule({
    providers: [FocoDoEditor, { provide: ElementRef, useValue: new ElementRef(raiz) }],
  });
  return raiz;
}

describe('FocoDoEditor', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
    TestBed.resetTestingModule();
  });

  it('mantém o foco no conjunto descrito pela recusa ao revelar o erro do passo', async () => {
    vi.useFakeTimers();
    const raiz = telaComRecusa();
    const campo = raiz.querySelector('fieldset');
    campo?.focus();

    TestBed.inject(FocoDoEditor).revelarErro(() => undefined);
    await vi.runAllTimersAsync();

    expect(document.activeElement).toBe(campo);
  });
});

function montar(html: string, naPagina = false): HTMLElement {
  const raiz = document.createElement('div');
  raiz.innerHTML = html;
  if (naPagina) {
    const pagina = document.createElement('div');
    pagina.className = 'page';
    pagina.append(raiz);
    document.body.append(pagina);
  } else {
    document.body.append(raiz);
  }
  TestBed.configureTestingModule({
    providers: [FocoDoEditor, { provide: ElementRef, useValue: new ElementRef(raiz) }],
  });
  return raiz;
}

function paginaDe(raiz: HTMLElement): HTMLElement {
  const pagina = raiz.closest<HTMLElement>('.page');
  if (pagina === null) throw new Error('A raiz não está dentro de uma página.');
  return pagina;
}

function avisoDe(raiz: HTMLElement): HTMLElement {
  const aviso = raiz.querySelector<HTMLElement>('.step-error');
  if (aviso === null) throw new Error('A raiz não tem aviso.');
  return aviso;
}

describe('FocoDoEditor, destinos de foco', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
    TestBed.resetTestingModule();
  });

  it('foca o título do passo e leva a rolagem do passo ao topo', () => {
    const raiz = montar('<div class="step-head"><h1 tabindex="-1">Vagas</h1></div>', true);
    const rolagem = vi.fn();
    paginaDe(raiz).scrollTo = rolagem;

    TestBed.inject(FocoDoEditor).focarTituloDoPasso();

    expect(rolagem).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    expect(document.activeElement).toBe(raiz.querySelector('h1'));
  });

  it('foca o título mesmo quando a rolagem não é suportada', () => {
    const raiz = montar('<div class="step-head"><h1 tabindex="-1">Vagas</h1></div>', true);
    paginaDe(raiz).scrollTo = () => {
      throw new Error('sem suporte');
    };

    TestBed.inject(FocoDoEditor).focarTituloDoPasso();

    expect(document.activeElement).toBe(raiz.querySelector('h1'));
  });

  it('foca o título de publicação depois que ele entra na tela', async () => {
    vi.useFakeTimers();
    const raiz = montar(
      '<h2 class="revisao-publicado-titulo" tabindex="-1">Processo publicado</h2>',
    );

    TestBed.inject(FocoDoEditor).focarConfirmacaoDePublicacao();
    await vi.runAllTimersAsync();

    expect(document.activeElement).toBe(raiz.querySelector('h2'));
  });
});

describe('FocoDoEditor, aviso de pendências', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
    TestBed.resetTestingModule();
  });

  async function revelar(passo?: () => PassoDoWizard | undefined): Promise<void> {
    vi.useFakeTimers();
    TestBed.inject(FocoDoEditor).revelarErro(passo ?? (() => undefined));
    await vi.runAllTimersAsync();
  }

  it('não faz nada quando não há aviso', async () => {
    montar('<div class="step-pane"><input aria-invalid="true" /></div>');
    await revelar();
    expect(document.activeElement).toBe(document.body);
  });

  it('deixa o passo abrir a seção do campo recusado e não move o foco', async () => {
    const raiz = montar('<div class="step-error"></div>');
    const revelarCampoInvalido = vi.fn(() => Promise.resolve(true));

    await revelar(() => ({ revelarCampoInvalido }) as unknown as PassoDoWizard);

    expect(revelarCampoInvalido).toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
    expect(raiz.querySelector('.step-error')?.getAttribute('tabindex')).toBe('-1');
  });

  it('foca o primeiro campo recusado visível e ignora o que está oculto', async () => {
    const raiz = montar(`<div class="step-error"></div><div class="step-pane">
      <div hidden><input id="oculto" aria-invalid="true" /></div>
      <input id="visivel" aria-invalid="true" /></div>`);

    await revelar();

    expect(document.activeElement).toBe(raiz.querySelector('#visivel'));
  });

  it('mantém o foco no campo recusado que já o tem', async () => {
    const raiz = montar(`<div class="step-error"></div><div class="step-pane">
      <input id="primeiro" aria-invalid="true" /><input id="segundo" aria-invalid="true" /></div>`);
    raiz.querySelector<HTMLElement>('#segundo')?.focus();

    await revelar();

    expect(document.activeElement).toBe(raiz.querySelector('#segundo'));
  });

  it('foca o aviso e rola até ele, descontando a reserva do topo, quando nenhum campo está recusado', async () => {
    const raiz = montar('<div class="step-error">Pendências</div>', true);
    const pagina = paginaDe(raiz);
    const rolagem = vi.fn();
    pagina.scrollTo = rolagem;
    pagina.style.scrollPaddingTop = '40px';
    vi.spyOn(avisoDe(raiz), 'getBoundingClientRect').mockReturnValue({
      top: 300,
    } as DOMRect);
    vi.spyOn(pagina, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);

    await revelar();

    expect(rolagem).toHaveBeenCalledWith({ top: 160, behavior: 'smooth' });
    expect(document.activeElement).toBe(raiz.querySelector('.step-error'));
  });

  it('foca o aviso mesmo quando a rolagem não é suportada ou não há área rolável', async () => {
    const raiz = montar('<div class="step-error">Pendências</div>', true);
    paginaDe(raiz).scrollTo = () => {
      throw new Error('sem suporte');
    };
    await revelar();
    expect(document.activeElement).toBe(raiz.querySelector('.step-error'));
  });

  it('foca o aviso quando o passo não tem área rolável', async () => {
    const raiz = montar('<div class="step-error">Pendências</div>');
    await revelar();
    expect(document.activeElement).toBe(raiz.querySelector('.step-error'));
  });
});

describe('FocoDoEditor, reservas de rolagem', () => {
  const observados: HTMLElement[] = [];
  let desconectou = false;

  afterEach(() => {
    vi.unstubAllGlobals();
    observados.length = 0;
    desconectou = false;
    document.documentElement.style.removeProperty('--wiz-reserva-base');
    document.body.replaceChildren();
    TestBed.resetTestingModule();
  });

  function observadorFalso(): void {
    let aoMedir: () => void = () => undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(chamada: () => void) {
          aoMedir = chamada;
        }
        observe(elemento: HTMLElement): void {
          observados.push(elemento);
          aoMedir();
        }
        disconnect(): void {
          desconectou = true;
        }
      },
    );
  }

  function medidos(): { barra: HTMLElement; rodape: HTMLElement } {
    const barra = document.createElement('div');
    const rodape = document.createElement('div');
    Object.defineProperty(barra, 'offsetHeight', { value: 48 });
    Object.defineProperty(rodape, 'offsetHeight', { value: 72 });
    return { barra, rodape };
  }

  it('grava a altura da barra e do rodapé na área rolável e no documento, e limpa ao destruir', () => {
    observadorFalso();
    const raiz = montar('<div></div>', true);
    const pagina = paginaDe(raiz);
    const { barra, rodape } = medidos();
    const elementos = signal<{ barra: HTMLElement; rodape: HTMLElement } | undefined>(undefined);

    TestBed.runInInjectionContext(() =>
      TestBed.inject(FocoDoEditor).observarReservas(
        () => elementos()?.barra,
        () => elementos()?.rodape,
      ),
    );
    TestBed.tick();
    expect(observados).toHaveLength(0);

    elementos.set({ barra, rodape });
    TestBed.tick();
    expect(observados).toEqual([barra, rodape]);
    expect(pagina.style.getPropertyValue('--wiz-reserva-topo')).toBe('48px');
    expect(pagina.style.getPropertyValue('--wiz-reserva-base')).toBe('72px');
    expect(document.documentElement.style.getPropertyValue('--wiz-reserva-base')).toBe('72px');

    TestBed.resetTestingModule();
    expect(desconectou).toBe(true);
    expect(pagina.style.getPropertyValue('--wiz-reserva-topo')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--wiz-reserva-base')).toBe('');
  });

  it('não observa quando não há área rolável', () => {
    observadorFalso();
    montar('<div></div>');
    const { barra, rodape } = medidos();

    TestBed.runInInjectionContext(() =>
      TestBed.inject(FocoDoEditor).observarReservas(
        () => barra,
        () => rodape,
      ),
    );
    TestBed.tick();

    expect(observados).toHaveLength(0);
  });
});
