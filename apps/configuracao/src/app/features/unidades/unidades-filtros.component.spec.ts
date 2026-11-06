import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHIPS_DE_TIPO } from './tipos-de-unidade';
import { UnidadesFiltrosComponent } from './unidades-filtros.component';

describe('UnidadesFiltrosComponent', () => {
  let fixture: ComponentFixture<UnidadesFiltrosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [UnidadesFiltrosComponent] });
    fixture = TestBed.createComponent(UnidadesFiltrosComponent);
  });
  afterEach(() => TestBed.resetTestingModule());

  function montar(termoBusca: string, tipoFiltro: string): void {
    fixture.componentRef.setInput('termoBusca', termoBusca);
    fixture.componentRef.setInput('tipoFiltro', tipoFiltro);
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('"Limpar" zera a busca e o tipo', () => {
    montar('exatas', CHIPS_DE_TIPO[1].value);

    const limpar = [...raiz().querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Limpar',
    ) as HTMLButtonElement;
    limpar.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.termoBusca()).toBe('');
    expect(fixture.componentInstance.tipoFiltro()).toBe('');
  });

  it('limita a busca a 256 caracteres, o que a API aceita', () => {
    montar('', '');

    const campo = raiz().querySelector('input[type="search"]') as HTMLInputElement;
    expect(campo.maxLength).toBe(256);
  });

  it('o filtro ativo leva o rótulo do chip; ordinal sem chip aparece como veio', () => {
    montar('', CHIPS_DE_TIPO[1].value);
    expect(raiz().textContent).toContain(CHIPS_DE_TIPO[1].label);

    fixture.componentRef.setInput('tipoFiltro', '99');
    fixture.detectChanges();
    expect(raiz().textContent).toContain('99');
  });
});
