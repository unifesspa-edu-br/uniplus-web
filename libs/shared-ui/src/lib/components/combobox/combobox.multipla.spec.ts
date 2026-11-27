import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ComboboxComponent } from './combobox';
import { GRUPOS } from './combobox.setup';

describe('ComboboxComponent com múltipla escolha', () => {
  @Component({
    standalone: true,
    imports: [ComboboxComponent],
    template: `
      <ui-combobox
        rotulo="Modalidades"
        multiplo
        [grupos]="grupos()"
        [values]="escolhidas()"
        (valuesChange)="escolhidas.set($event)"
      />
    `,
  })
  class HospedeiroMultiplo {
    readonly grupos = signal(GRUPOS);
    readonly escolhidas = signal<readonly string[]>([]);
  }

  let multi: ComponentFixture<HospedeiroMultiplo>;
  let nativoMulti: HTMLElement;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [HospedeiroMultiplo] }).compileComponents();
    multi = TestBed.createComponent(HospedeiroMultiplo);
    multi.detectChanges();
    nativoMulti = multi.nativeElement as HTMLElement;
  });

  function campoMulti(): HTMLInputElement {
    return nativoMulti.querySelector('input[role="combobox"]') as HTMLInputElement;
  }

  function marcar(rotulo: string): void {
    const alvo = [...nativoMulti.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (o) => o.textContent?.trim() === rotulo,
    );
    alvo?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    multi.detectChanges();
  }

  function abrir(): void {
    campoMulti().dispatchEvent(new Event('focus'));
    multi.detectChanges();
  }

  function teclarNoMulti(key: string): void {
    campoMulti().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    multi.detectChanges();
  }

  it('anuncia que a lista aceita mais de uma escolha', () => {
    abrir();
    expect(
      nativoMulti.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable'),
    ).toBe('true');
  });

  /** Marcar três não pode custar reabrir a lista três vezes. */
  it('a lista continua aberta a cada escolha', () => {
    abrir();

    marcar('Contracheque');
    expect(campoMulti().getAttribute('aria-expanded')).toBe('true');

    marcar('RG');
    expect(multi.componentInstance.escolhidas()).toEqual(['contracheque', 'rg']);
  });

  /**
   * Quem marca pelo teclado digita a consulta seguinte no mesmo campo. Se a escolha
   * devolvesse ali o resumo do que já está marcado, a consulta seria acrescentada a
   * "Contracheque, RG" e filtraria por essa frase inteira — nenhum resultado, e é preciso
   * apagar o resumo à mão depois de cada escolha.
   */
  it('o campo fica vazio entre uma escolha e a seguinte, com a lista aberta', () => {
    abrir();
    marcar('Contracheque');

    expect(campoMulti().value).toBe('');

    campoMulti().value = 'RG';
    campoMulti().dispatchEvent(new Event('input'));
    multi.detectChanges();

    const visiveis = [...nativoMulti.querySelectorAll<HTMLElement>('[role="option"]')].map((o) =>
      o.textContent?.trim(),
    );
    expect(visiveis).toEqual(['RG']);
  });

  /** Fechada, a lista devolve ao campo o resumo — é por ele que se confere sem reabrir. */
  it('ao fechar, o campo volta a resumir o que está marcado', () => {
    abrir();
    marcar('Contracheque');
    teclarNoMulti('Escape');

    expect(campoMulti().value).toBe('Contracheque');
  });

  it('a opção marcada que ficou desabilitada continua removível, com o mouse e com o teclado', () => {
    multi.componentInstance.grupos.set([
      {
        label: 'Modalidades',
        options: [
          { value: 'ac', label: 'Ampla concorrência' },
          {
            value: 'ppi',
            label: 'PPI — aguarda a aprovação da proteção de dados',
            disabled: true,
          },
        ],
      },
    ]);
    multi.componentInstance.escolhidas.set(['ppi']);
    multi.detectChanges();
    abrir();

    const opcao = [...nativoMulti.querySelectorAll<HTMLElement>('[role="option"]')].find((o) =>
      o.textContent?.includes('PPI'),
    );
    expect(opcao?.getAttribute('aria-disabled')).toBeNull();

    campoMulti().dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    campoMulti().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    multi.detectChanges();

    expect(multi.componentInstance.escolhidas()).toEqual([]);
  });

  it('a opção desabilitada que não está marcada segue fora do alcance no modo múltiplo', () => {
    multi.componentInstance.grupos.set([
      {
        label: 'Modalidades',
        options: [{ value: 'ppi', label: 'PPI — aguarda', disabled: true }],
      },
    ]);
    multi.detectChanges();
    abrir();
    marcar('PPI — aguarda');

    expect(multi.componentInstance.escolhidas()).toEqual([]);
  });

  it('clicar de novo desmarca', () => {
    abrir();
    marcar('CPF');
    expect(multi.componentInstance.escolhidas()).toEqual(['cpf']);

    marcar('CPF');
    expect(multi.componentInstance.escolhidas()).toEqual([]);
  });

  it('o campo fechado resume o que está marcado', () => {
    multi.componentInstance.escolhidas.set(['rg', 'contracheque']);
    multi.detectChanges();

    expect(campoMulti().value, 'na ordem da lista, não na ordem em que foram marcadas').toBe(
      'Contracheque, RG',
    );
  });

  it('marca na lista tudo o que está escolhido', () => {
    multi.componentInstance.escolhidas.set(['cpf', 'irpf']);
    multi.detectChanges();
    abrir();

    const marcadas = [...nativoMulti.querySelectorAll<HTMLElement>('[role="option"]')]
      .filter((o) => o.getAttribute('aria-selected') === 'true')
      .map((o) => o.textContent?.trim());
    expect(marcadas).toEqual(['Declaração de IRPF', 'CPF']);
  });
});
