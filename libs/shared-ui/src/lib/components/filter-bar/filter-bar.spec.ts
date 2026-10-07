import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FilterBarComponent as PublicFilterBarComponent } from '../../index';
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

  it('é publicado pelo entrypoint primário de shared-ui', () => {
    expect(PublicFilterBarComponent).toBe(FilterBarComponent);
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

  it('deixa .filter-bar__group sem nenhum nó-filho quando nada é projetado em uiFilterBarSecondary (pré-condição do CSS .filter-bar__group:empty)', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('ariaLabel', 'Filtrar unidades');
    fixture.detectChanges();

    const group = fixture.debugElement.query(By.css('.filter-bar__group'))
      .nativeElement as HTMLElement;
    expect(group.childNodes.length).toBe(0);
  });

  it('mantém o layout do grupo secundário no stylesheet compartilhado', () => {
    const styles = readFileSync(resolve(__dirname, '../../../styles/components.css'), 'utf-8');
    const groupRule = styles.match(/\.filter-bar__group\s*\{(?<declarations>[^}]*)\}/u)?.groups?.[
      'declarations'
    ];

    expect(groupRule).toContain('display: flex;');
    expect(groupRule).toContain('flex-direction: column;');
    expect(groupRule).toContain('gap: var(--space-2);');
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

  it('projeta o conteúdo do slot uiFilterBarActions dentro de .filter-bar__row e reage ao clique', () => {
    const { fixture } = setupHost();
    const host = fixture.componentInstance;
    const row = fixture.debugElement.query(By.css('.filter-bar__row'));
    const button = row.query(By.css('button'));

    expect(button).toBeTruthy();
    expect((button.nativeElement as HTMLButtonElement).textContent?.trim()).toBe('Limpar');

    expect(host.limparChamado).toBe(false);
    (button.nativeElement as HTMLButtonElement).click();
    expect(host.limparChamado).toBe(true);
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

describe('FilterBarComponent com filtros recolhíveis', () => {
  function montar(filtrosAtivos: readonly { nome: string; valor: string }[] | undefined) {
    const fixture = TestBed.createComponent(FilterBarComponent);
    fixture.componentRef.setInput('ariaLabel', 'Filtrar');
    fixture.componentRef.setInput('filtrosAtivos', filtrosAtivos);
    fixture.detectChanges();
    return fixture;
  }

  it('fechado, mostra até dois filtros ativos e "+N"; o leitor de tela ouve todos', () => {
    const fixture = montar([
      { nome: 'Finalidade', valor: 'Inscrição' },
      { nome: 'Situação', valor: 'Ativos' },
      { nome: 'Tipo de processo', valor: 'PSR' },
    ]);
    const raiz = fixture.nativeElement as HTMLElement;
    const alternar = raiz.querySelector('.filter-bar__alternar') as HTMLButtonElement;
    const grupo = raiz.querySelector('.filter-bar__group') as HTMLElement;

    expect(alternar.getAttribute('aria-expanded')).toBe('false');
    expect(grupo.hidden).toBe(true);
    expect(
      [...raiz.querySelectorAll('.filter-bar__ativo')].map((e) => e.textContent?.trim()),
    ).toEqual(['Finalidade: Inscrição', 'Situação: Ativos', '+1']);
    expect(alternar.getAttribute('aria-label')).toBe(
      'Filtros, 3 ativos: Finalidade Inscrição, Situação Ativos, Tipo de processo PSR',
    );

    alternar.click();
    fixture.detectChanges();
    expect(grupo.hidden).toBe(false);
    expect(raiz.querySelectorAll('.filter-bar__ativo')).toHaveLength(0);
  });

  it('sem filtro ativo, o título é só "Filtros"; sem a lista, os filtros ficam sempre abertos', () => {
    const vazio = montar([]).nativeElement as HTMLElement;
    expect(vazio.querySelector('.filter-bar__alternar')?.getAttribute('aria-label')).toBe(
      'Filtros, nenhum ativo',
    );
    expect(vazio.querySelectorAll('.filter-bar__ativo')).toHaveLength(0);

    const semLista = montar(undefined).nativeElement as HTMLElement;
    expect(semLista.querySelector('.filter-bar__alternar')).toBeNull();
    expect((semLista.querySelector('.filter-bar__group') as HTMLElement).hidden).toBe(false);
  });
});
