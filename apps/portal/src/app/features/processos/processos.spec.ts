import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessosComponent } from './processos';

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((consulta: string) =>
    ({
      matches,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

describe('ProcessosComponent', () => {
  let fixture: ComponentFixture<ProcessosComponent>;
  let component: ProcessosComponent;
  let appRef: ApplicationRef;
  const matchMediaOriginal = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    stubMatchMedia(false);

    TestBed.configureTestingModule({
      imports: [ProcessosComponent],
      providers: [provideRouter([])],
    });

    fixture = TestBed.createComponent(ProcessosComponent);
    component = fixture.componentInstance;
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
  });

  const propagate = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve));
    appRef.tick();
  };

  async function carregar(): Promise<void> {
    await propagate();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function chip(rotulo: string): HTMLButtonElement | null {
    return Array.from(host().querySelectorAll<HTMLButtonElement>('.filter-chip')).find((el) =>
      el.textContent?.includes(rotulo),
    ) ?? null;
  }

  it('mostra o estado de carregando antes dos dados chegarem', () => {
    expect(component['carregando']()).toBe(true);
    const status = host().querySelector('.certames-count[role="status"]');
    expect(status?.textContent).toContain('Carregando');
  });

  it('carrega os certames e anuncia a contagem numa região viva', async () => {
    await carregar();

    expect(component['carregando']()).toBe(false);
    const status = host().querySelector('.certames-count[role="status"][aria-live="polite"]');
    expect(status).toBeTruthy();
    expect(status?.textContent).toContain('8 certames encontrados');
  });

  it('busca e filtro por situação combinam (só retorna o que atende aos dois)', async () => {
    await carregar();

    component['busca'].set('técnico');
    fixture.detectChanges();
    // "técnico" sozinho bate com 2 certames (Informática + Enfermagem), um aberto e um em últimos dias.
    expect(component['certamesFiltrados']().length).toBe(2);

    chip('Inscrições abertas')?.click();
    fixture.detectChanges();

    const filtrados = component['certamesFiltrados']();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].titulo).toBe('Técnico em Informática');

    const status = host().querySelector('.certames-count');
    expect(status?.textContent).toContain('1 certame encontrado');
  });

  it('filtro por modalidade também combina com a busca e a situação', async () => {
    await carregar();

    chip('Pós-graduação')?.click();
    fixture.detectChanges();
    expect(component['certamesFiltrados']().length).toBe(2);

    chip('Últimos dias')?.click();
    fixture.detectChanges();
    expect(component['certamesFiltrados']().length).toBe(1);
    expect(component['certamesFiltrados']()[0].titulo).toBe('Pós-graduação em Educação');
  });

  it('"Limpar filtros" reseta busca, situação e modalidade', async () => {
    await carregar();

    component['busca'].set('técnico');
    chip('Inscrições abertas')?.click();
    fixture.detectChanges();
    expect(component['temFiltrosAtivos']()).toBe(true);

    const botaoLimpar = Array.from(host().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Limpar filtros'),
    );
    botaoLimpar?.click();
    fixture.detectChanges();

    expect(component['temFiltrosAtivos']()).toBe(false);
    expect(component['certamesFiltrados']().length).toBe(8);
  });

  it('pagina os resultados: Próximo/Anterior navegam e desabilitam nos limites', async () => {
    await carregar();

    expect(component['itensPagina']().length).toBe(5);
    expect(component['hasPrevious']()).toBe(false);
    expect(component['hasNext']()).toBe(true);

    component['proximaPagina']();
    fixture.detectChanges();

    expect(component['paginaAtual']()).toBe(1);
    expect(component['itensPagina']().length).toBe(3);
    expect(component['hasPrevious']()).toBe(true);
    expect(component['hasNext']()).toBe(false);

    component['paginaAnterior']();
    fixture.detectChanges();
    expect(component['paginaAtual']()).toBe(0);
  });

  it('filtrar reseta a paginação para a primeira página', async () => {
    await carregar();
    component['proximaPagina']();
    fixture.detectChanges();
    expect(component['paginaAtual']()).toBe(1);

    component['busca'].set('graduação');
    fixture.detectChanges();

    expect(component['paginaAtual']()).toBe(0);
  });

  it('estado vazio: busca sem resultado orienta a limpar os filtros', async () => {
    await carregar();

    component['busca'].set('curso que não existe');
    fixture.detectChanges();

    const vazio = host().querySelector('.empty-state');
    expect(vazio?.textContent).toContain('Nenhum certame encontrado');
  });

  it('estado de erro mostra mensagem e ação de tentar novamente', async () => {
    await carregar();

    component['erro'].set('Falha ao carregar os certames.');
    fixture.detectChanges();

    const alerta = host().querySelector('.alert--danger');
    expect(alerta?.textContent).toContain('Falha ao carregar os certames.');
    expect(host().querySelector('.certames-count')).toBeNull();

    const tentar = Array.from(host().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tentar novamente'),
    );
    expect(tentar).toBeTruthy();
  });

  it('abaixo de 600px o controle de alternância some e a lista é canônica', async () => {
    stubMatchMedia(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProcessosComponent],
      providers: [provideRouter([])],
    });
    const fixtureCompacto = TestBed.createComponent(ProcessosComponent);
    const componenteCompacto = fixtureCompacto.componentInstance;
    fixtureCompacto.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixtureCompacto.detectChanges();

    componenteCompacto['visao'].set('cards');
    fixtureCompacto.detectChanges();

    expect(componenteCompacto['visaoEfetiva']()).toBe('lista');
    const hostCompacto = fixtureCompacto.nativeElement as HTMLElement;
    expect(hostCompacto.querySelector('ui-segmented')).toBeNull();
    expect(hostCompacto.querySelector('.certames-list')).toBeTruthy();
    expect(hostCompacto.querySelector('.certames-grid')).toBeNull();
  });

  it('lembra a visão escolhida entre visitas (localStorage)', async () => {
    await carregar();

    component['setVisao']('cards');
    fixture.detectChanges();

    expect(localStorage.getItem('uniplus.portal.certames-visao')).toBe('cards');
  });
});
