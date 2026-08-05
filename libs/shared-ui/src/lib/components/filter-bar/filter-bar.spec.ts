import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FilterBarComponent } from './filter-bar';

describe('FilterBarComponent', () => {
  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FilterBarComponent],
    });

    const fixture: ComponentFixture<FilterBarComponent> =
      TestBed.createComponent(FilterBarComponent);
    const component = fixture.componentInstance;
    const getWrapperEl = () =>
      fixture.debugElement.query(By.css('.filter-bar')).nativeElement as HTMLElement;
    const getInputEl = () =>
      fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    return { fixture, component, getWrapperEl, getInputEl };
  }

  it('lança erro se detectChanges rodar sem ariaLabel informado (input obrigatório)', () => {
    const { fixture } = setup();
    expect(() => fixture.detectChanges()).toThrow();
  });

  it('renderiza role="search" e o aria-label recebido no wrapper', () => {
    const { fixture, getWrapperEl } = setup();
    fixture.componentRef.setInput('ariaLabel', 'Filtrar unidades');
    fixture.detectChanges();

    const wrapper = getWrapperEl();
    expect(wrapper.getAttribute('role')).toBe('search');
    expect(wrapper.getAttribute('aria-label')).toBe('Filtrar unidades');
  });

  it('usa "Buscar..." como placeholder padrão quando searchPlaceholder não é informado', () => {
    const { fixture, getInputEl } = setup();
    fixture.componentRef.setInput('ariaLabel', 'Filtrar unidades');
    fixture.detectChanges();

    expect(getInputEl().placeholder).toBe('Buscar...');
  });

  it('aplica o searchPlaceholder recebido', () => {
    const { fixture, getInputEl } = setup();
    fixture.componentRef.setInput('ariaLabel', 'Filtrar unidades');
    fixture.componentRef.setInput('searchPlaceholder', 'Buscar por sigla ou nome...');
    fixture.detectChanges();

    expect(getInputEl().placeholder).toBe('Buscar por sigla ou nome...');
  });

  it('omite aria-label do campo de busca quando searchAriaLabel não é informado', () => {
    const { fixture, getInputEl } = setup();
    fixture.componentRef.setInput('ariaLabel', 'Filtrar unidades');
    fixture.detectChanges();

    expect(getInputEl().getAttribute('aria-label')).toBeNull();
  });

  it('aplica o searchAriaLabel recebido no campo de busca', () => {
    const { fixture, getInputEl } = setup();
    fixture.componentRef.setInput('ariaLabel', 'Filtrar unidades');
    fixture.componentRef.setInput('searchAriaLabel', 'Buscar unidade');
    fixture.detectChanges();

    expect(getInputEl().getAttribute('aria-label')).toBe('Buscar unidade');
  });

  it('reflete searchValue recebido no value do input', () => {
    const { fixture, getInputEl } = setup();
    fixture.componentRef.setInput('ariaLabel', 'Filtrar unidades');
    fixture.componentRef.setInput('searchValue', 'campus');
    fixture.detectChanges();

    expect(getInputEl().value).toBe('campus');
  });

  it('atualiza o signal searchValue ao digitar no input', () => {
    const { fixture, component, getInputEl } = setup();
    fixture.componentRef.setInput('ariaLabel', 'Filtrar unidades');
    fixture.detectChanges();

    const input = getInputEl();
    input.value = 'marabá';
    input.dispatchEvent(new Event('input'));

    expect(component.searchValue()).toBe('marabá');
  });
});

@Component({
  standalone: true,
  imports: [FilterBarComponent],
  template: `
    <ui-filter-bar ariaLabel="Filtrar unidades" [(searchValue)]="busca">
      <button uiFilterBarActions type="button" class="btn btn--tertiary btn--sm" (click)="limpar()">
        Limpar
      </button>
      <span uiFilterBarSecondary>filtro secundário projetado</span>
    </ui-filter-bar>
  `,
})
class FilterBarHostComponent {
  readonly busca = signal('');
  limparChamado = false;

  limpar(): void {
    this.limparChamado = true;
  }
}

describe('FilterBarComponent (projeção de conteúdo e two-way binding)', () => {
  function setupHost() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FilterBarHostComponent],
    });

    const fixture = TestBed.createComponent(FilterBarHostComponent);
    fixture.detectChanges();
    const getInputEl = () =>
      fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    return { fixture, getInputEl };
  }

  it('projeta o conteúdo do slot uiFilterBarActions dentro de .filter-bar__row', () => {
    const { fixture } = setupHost();
    const row = fixture.debugElement.query(By.css('.filter-bar__row'));
    const button = row.query(By.css('button'));

    expect(button).toBeTruthy();
    expect((button.nativeElement as HTMLButtonElement).textContent?.trim()).toBe('Limpar');
  });

  it('projeta o conteúdo do slot uiFilterBarSecondary dentro de .filter-bar__group', () => {
    const { fixture } = setupHost();
    const group = fixture.debugElement.query(By.css('.filter-bar__group'));

    expect(group.nativeElement.textContent.trim()).toBe('filtro secundário projetado');
  });

  it('atualiza o signal do host via [(searchValue)] ao digitar no input', () => {
    const { fixture, getInputEl } = setupHost();
    const host = fixture.componentInstance;

    const input = getInputEl();
    input.value = 'campus 2';
    input.dispatchEvent(new Event('input'));

    expect(host.busca()).toBe('campus 2');
  });
});
