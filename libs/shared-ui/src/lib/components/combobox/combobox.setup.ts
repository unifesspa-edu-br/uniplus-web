import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ComboboxComponent, type UiComboboxGroup } from './combobox';

export const GRUPOS: readonly UiComboboxGroup[] = [
  {
    label: 'Comprovação de renda',
    options: [
      { value: 'contracheque', label: 'Contracheque' },
      { value: 'irpf', label: 'Declaração de IRPF' },
    ],
  },
  {
    label: 'Identificação',
    options: [
      { value: 'rg', label: 'RG' },
      { value: 'cpf', label: 'CPF' },
    ],
  },
];

@Component({
  standalone: true,
  imports: [ComboboxComponent],
  template: `
    <ui-combobox
      rotulo="Documentos"
      [grupos]="grupos()"
      [value]="escolhido()"
      (valueChange)="escolhido.set($event)"
    />
  `,
})
export class HospedeiroDeTeste {
  readonly grupos = signal(GRUPOS);
  readonly escolhido = signal('');
}

/** Monta o combobox num hospedeiro e devolve o que os testes precisam para operá-lo. */
export async function montarCombobox() {
  await TestBed.configureTestingModule({ imports: [HospedeiroDeTeste] }).compileComponents();
  const fixture: ComponentFixture<HospedeiroDeTeste> = TestBed.createComponent(HospedeiroDeTeste);
  fixture.detectChanges();
  const nativo = fixture.nativeElement as HTMLElement;
  const campo = () => nativo.querySelector('input[role="combobox"]') as HTMLInputElement;
  const digitar = (termo: string): void => {
    campo().value = termo;
    campo().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const teclar = (key: string): void => {
    campo().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };
  const opcoes = () => [...nativo.querySelectorAll<HTMLElement>('[role="option"]')];
  return { fixture, nativo, campo, digitar, teclar, opcoes };
}

export type CenarioDoCombobox = Awaited<ReturnType<typeof montarCombobox>>;
