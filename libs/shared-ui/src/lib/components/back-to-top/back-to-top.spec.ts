import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BackToTopComponent } from './back-to-top';
import { BackToTopContainerDirective } from './back-to-top-container.directive';
import { BackToTopScrollService } from './back-to-top.service';

interface ScrollerFake extends HTMLElement {
  chamadasScrollTo: ScrollToOptions[];
}

/**
 * Elemento com métricas de rolagem controláveis — jsdom não calcula
 * `scrollHeight`/`clientHeight` nem implementa `scrollTo`.
 */
function scrollerFake(metricas: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop?: number;
  tabindex?: boolean;
}): ScrollerFake {
  const el = document.createElement('div') as unknown as ScrollerFake;
  let scrollTop = metricas.scrollTop ?? 0;
  Object.defineProperty(el, 'scrollHeight', { get: () => metricas.scrollHeight });
  Object.defineProperty(el, 'clientHeight', { get: () => metricas.clientHeight });
  Object.defineProperty(el, 'scrollTop', {
    get: () => scrollTop,
    set: (valor: number) => {
      scrollTop = valor;
    },
  });
  el.chamadasScrollTo = [];
  el.scrollTo = ((opcoes: ScrollToOptions) => {
    el.chamadasScrollTo.push(opcoes);
    scrollTop = opcoes.top ?? scrollTop;
  }) as typeof el.scrollTo;
  if (metricas.tabindex) el.setAttribute('tabindex', '-1');
  document.body.appendChild(el);
  return el;
}

@Component({
  standalone: true,
  imports: [BackToTopComponent],
  template: `<ui-back-to-top [defaultContainer]="container" />`,
})
class HostComponent {
  container: HTMLElement | null = null;
}

const microtask = (): Promise<void> => Promise.resolve();
const macrotask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

/** Esgota a cadeia de micro/macrotasks (serviço, efeito e `NavigationEnd`) e repinta. */
async function estabilizar(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await macrotask();
    fixture.detectChanges();
  }
}

async function montar(container: HTMLElement | null = null) {
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [provideRouter([{ path: '**', children: [] }])],
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.container = container;
  fixture.detectChanges();
  await estabilizar(fixture);
  const botao = fixture.nativeElement.querySelector('.uni-back-to-top') as HTMLButtonElement;
  return { fixture, botao };
}

const visivel = (botao: HTMLButtonElement): boolean => botao.classList.contains('is-visible');

/** Dispara a rolagem e deixa o Angular repintar. */
async function rolarPara(
  fixture: ComponentFixture<HostComponent>,
  scroller: ScrollerFake,
  scrollTop: number,
): Promise<void> {
  scroller.scrollTop = scrollTop;
  scroller.dispatchEvent(new Event('scroll'));
  await estabilizar(fixture);
}

describe('BackToTopComponent', () => {
  afterEach(() => {
    document.body.querySelectorAll('div').forEach((el) => el.remove());
  });

  it('mantém o botão oculto abaixo de 30% do intervalo rolável (CA-02)', async () => {
    // intervalo = 1000 - 300 = 700; 209/700 ≈ 0,2986
    const { botao } = await montar(
      scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 209 }),
    );
    expect(visivel(botao)).toBe(false);
    expect(botao.getAttribute('aria-hidden')).toBe('true');
    expect(botao.getAttribute('tabindex')).toBe('-1');
  });

  it('apresenta o botão exatamente em 30% e o oculta ao voltar abaixo (CA-03/CA-04)', async () => {
    const scroller = scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 210 });
    const { fixture, botao } = await montar(scroller);
    expect(visivel(botao)).toBe(true);
    expect(botao.hasAttribute('aria-hidden')).toBe(false);
    expect(botao.hasAttribute('tabindex')).toBe(false);

    await rolarPara(fixture, scroller, 700);
    expect(visivel(botao)).toBe(true);

    await rolarPara(fixture, scroller, 100);
    expect(visivel(botao)).toBe(false);
  });

  it('mantém o botão oculto quando não há intervalo rolável (CA-05)', async () => {
    const { botao } = await montar(
      scrollerFake({ scrollHeight: 300, clientHeight: 300, scrollTop: 999 }),
    );
    expect(visivel(botao)).toBe(false);
  });

  it('leva o contêiner ativo ao topo ao ser acionado (CA-06)', async () => {
    const scroller = scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 800 });
    const { fixture, botao } = await montar(scroller);

    botao.click();
    await microtask();
    fixture.detectChanges();

    expect(scroller.chamadasScrollTo.at(-1)?.top).toBe(0);
    expect(scroller.scrollTop).toBe(0);
  });

  it('leva o foco ao topo de um contêiner focável ao acionar (CA-12)', async () => {
    const focavel = scrollerFake({
      scrollHeight: 1000,
      clientHeight: 300,
      scrollTop: 800,
      tabindex: true,
    });
    const foco = vi.spyOn(focavel, 'focus');
    const { botao } = await montar(focavel);

    botao.click();
    expect(foco).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('não tenta focar um contêiner sem tabindex ao acionar (CA-06)', async () => {
    const semFoco = scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 800 });
    const foco = vi.spyOn(semFoco, 'focus');
    const { botao } = await montar(semFoco);

    botao.click();
    expect(foco).not.toHaveBeenCalled();
  });

  it('ignora a rolagem de um contêiner auxiliar (CA-09)', async () => {
    const { fixture, botao } = await montar(
      scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 0 }),
    );

    const auxiliar = scrollerFake({ scrollHeight: 5000, clientHeight: 200, scrollTop: 4000 });
    auxiliar.dispatchEvent(new Event('scroll'));
    await estabilizar(fixture);

    expect(visivel(botao)).toBe(false);
  });

  it('observa o contêiner registrado por uma rota interna e retorna ao padrão (CA-08/CA-10/CA-11)', async () => {
    const padrao = scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 0 });
    const { fixture, botao } = await montar(padrao);
    expect(visivel(botao)).toBe(false);

    const interno = scrollerFake({ scrollHeight: 2000, clientHeight: 400, scrollTop: 1500 });
    const service = TestBed.inject(BackToTopScrollService);
    service.registrar(interno);
    await estabilizar(fixture);
    expect(visivel(botao)).toBe(true);

    botao.click();
    expect(interno.chamadasScrollTo.at(-1)?.top).toBe(0);
    expect(padrao.chamadasScrollTo.length).toBe(0);

    service.remover(interno);
    await estabilizar(fixture);
    expect(visivel(botao)).toBe(false);
  });

  it('recalcula a visibilidade após mudança de rota (CA-10)', async () => {
    const scroller = scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 800 });
    const { fixture, botao } = await montar(scroller);
    expect(visivel(botao)).toBe(true);

    // Nova rota posicionada no início.
    scroller.scrollTop = 0;
    await TestBed.inject(Router).navigateByUrl('/outra');
    await estabilizar(fixture);
    expect(visivel(botao)).toBe(false);
  });

  it('religa listener e observer do contêiner padrão a cada navegação (CA-10/CA-18)', async () => {
    // `main.page` é o mesmo elemento entre rotas — o efeito não dispara —, mas os
    // filhos que o ResizeObserver acompanha foram trocados pelo conteúdo novo.
    const scroller = scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 0 });
    const { fixture } = await montar(scroller);

    const add = vi.spyOn(scroller, 'addEventListener');
    const remove = vi.spyOn(scroller, 'removeEventListener');

    await TestBed.inject(Router).navigateByUrl('/outra');
    await estabilizar(fixture);

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(add).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      expect.objectContaining({ passive: true }),
    );
  });

  it('não anima o retorno sob prefers-reduced-motion (CA-16)', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((consulta: string) =>
      ({
        matches: consulta.includes('reduce'),
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    try {
      const scroller = scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 800 });
      const { botao } = await montar(scroller);
      botao.click();
      expect(scroller.chamadasScrollTo.at(-1)?.behavior).toBe('auto');
    } finally {
      window.matchMedia = original;
    }
  });

  it('anima o retorno com rolagem suave sem prefers-reduced-motion (CA-16)', async () => {
    const scroller = scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 800 });
    const { botao } = await montar(scroller);
    botao.click();
    expect(scroller.chamadasScrollTo.at(-1)?.behavior).toBe('smooth');
  });

  it('tem nome acessível e é um botão nativo (CA-12)', async () => {
    const { botao } = await montar();
    expect(botao.tagName).toBe('BUTTON');
    expect(botao.getAttribute('type')).toBe('button');
    expect(botao.getAttribute('aria-label')).toBe('Voltar ao topo do conteúdo');
  });

  it('libera o listener de rolagem ao ser destruído (CA-17)', async () => {
    const scroller = scrollerFake({ scrollHeight: 1000, clientHeight: 300, scrollTop: 800 });
    const remover = vi.spyOn(scroller, 'removeEventListener');
    const { fixture } = await montar(scroller);

    fixture.destroy();
    expect(remover).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});

describe('BackToTopContainerDirective', () => {
  @Component({
    standalone: true,
    imports: [BackToTopContainerDirective],
    template: `<div uiBackToTopContainer></div>`,
  })
  class DiretivaHost {}

  it('registra o elemento hospedeiro e o remove ao ser destruído', async () => {
    await TestBed.configureTestingModule({ imports: [DiretivaHost] }).compileComponents();
    const fixture = TestBed.createComponent(DiretivaHost);
    fixture.detectChanges();

    const service = TestBed.inject(BackToTopScrollService);
    const alvo = fixture.nativeElement.querySelector('div') as HTMLElement;
    await microtask();
    expect(service.containerPrincipal()).toBe(alvo);

    fixture.destroy();
    await microtask();
    expect(service.containerPrincipal()).toBeNull();
  });
});
