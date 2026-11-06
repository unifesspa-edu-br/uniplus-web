import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { montarArvore } from './arvore-de-unidades';
import { UnidadesListaComponent } from './unidades-lista.component';
import { instituto, reitoria } from './unidades.testing';

describe('UnidadesListaComponent', () => {
  let fixture: ComponentFixture<UnidadesListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [UnidadesListaComponent] });
    fixture = TestBed.createComponent(UnidadesListaComponent);
  });
  afterEach(() => TestBed.resetTestingModule());

  function montar(entradas: Record<string, unknown> = {}): void {
    const padrao: Record<string, unknown> = {
      arvore: montarArvore([reitoria, instituto]),
      carregando: false,
      gravando: false,
      removendo: false,
      erro: null,
      temFiltro: false,
      temAnterior: true,
      temProximo: true,
      termoBusca: '',
      tipoFiltro: '',
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  const indisponivel = (b: HTMLButtonElement): boolean =>
    b.matches(':disabled') || b.getAttribute('aria-disabled') === 'true';
  const novo = (): HTMLButtonElement =>
    raiz().querySelector('#cfg-unidades-novo') as HTMLButtonElement;

  it('com a remoção em curso, todo botão de ação fica indisponível, a busca sai e o título anuncia', () => {
    montar({ removendo: true, gravando: true });

    expect(botoes().length).toBeGreaterThanOrEqual(5);
    const acionaveis = botoes().filter(
      (b) =>
        !indisponivel(b) &&
        b.closest('[inert]') === null &&
        !b.classList.contains('unit-node__toggle'),
    );
    expect(acionaveis).toEqual([]);
    expect(raiz().querySelector('cfg-unidades-filtros')?.hasAttribute('inert')).toBe(true);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('no estado vazio filtrado, com a remoção em curso, "Limpar filtros" e "Nova unidade" ficam indisponíveis', () => {
    montar({ arvore: [], removendo: true, gravando: true, temFiltro: true });

    const limpar = botoes().find((b) => b.textContent?.includes('Limpar filtros'));
    expect(limpar?.matches(':disabled')).toBe(true);
    expect(indisponivel(novo())).toBe(true);
  });

  it('livre, os botões respondem e o painel não anuncia espera', () => {
    montar();

    expect(indisponivel(novo())).toBe(false);
    expect(raiz().querySelector('cfg-unidades-filtros')?.hasAttribute('inert')).toBe(false);
    expect(raiz().textContent).not.toContain('Removendo');
    expect(raiz().textContent).not.toContain('Carregando');
  });

  it('"Nova unidade" indisponível não emite, e disponível emite', () => {
    let emitidos = 0;
    fixture.componentInstance.cadastrar.subscribe(() => emitidos++);
    montar({ carregando: true });
    novo().click();
    expect(emitidos).toBe(0);

    fixture.componentRef.setInput('carregando', false);
    fixture.detectChanges();
    novo().click();
    expect(emitidos).toBe(1);
  });

  it('carregando, o painel anuncia "Carregando" e não afirma que não há unidades', () => {
    montar({ arvore: [], carregando: true });

    expect(raiz().textContent).toContain('Carregando');
    expect(raiz().textContent).not.toContain('Nenhuma unidade');
  });

  it('vazio sem filtro e com erro distinguem as mensagens', () => {
    montar({ arvore: [] });
    expect(raiz().textContent).toContain('Nenhuma unidade cadastrada');

    fixture.componentRef.setInput('erro', 'Falhou');
    fixture.detectChanges();
    expect(raiz().textContent).not.toContain('Nenhuma unidade');
  });

  it('"Limpar filtros" zera a busca e o tipo', () => {
    montar({ arvore: [], temFiltro: true, termoBusca: 'x', tipoFiltro: '4' });

    botoes()
      .find((b) => b.textContent?.includes('Limpar filtros'))
      ?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.termoBusca()).toBe('');
    expect(fixture.componentInstance.tipoFiltro()).toBe('');
  });

  it('o pager aparece só havendo página anterior ou próxima', () => {
    montar({ temAnterior: false, temProximo: false });
    expect(raiz().querySelector('ui-pager')).toBeNull();

    fixture.componentRef.setInput('temProximo', true);
    fixture.detectChanges();
    expect(raiz().querySelector('ui-pager')).not.toBeNull();
  });
});
