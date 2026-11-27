import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ComboboxComponent, type UiComboboxGroup } from './combobox';

@Component({
  standalone: true,
  imports: [ComboboxComponent],
  template: `
    <ui-combobox
      rotulo="Municípios"
      buscaExterna
      textoSemResultado="Buscando municípios…"
      [grupos]="grupos()"
      (buscaChange)="termos.push($event)"
    />
  `,
})
class HospedeiroDaBuscaExterna {
  readonly grupos = signal<readonly UiComboboxGroup[]>([
    { label: 'Encontrados', options: [{ value: '1504208', label: 'Marabá (PA)' }] },
  ]);
  readonly termos: string[] = [];
}

describe('ComboboxComponent com a busca do hospedeiro', () => {
  it('entrega o termo ao hospedeiro e mostra o que ele achou, sem filtrar de novo', async () => {
    await TestBed.configureTestingModule({
      imports: [HospedeiroDaBuscaExterna],
    }).compileComponents();
    const fixture = TestBed.createComponent(HospedeiroDaBuscaExterna);
    fixture.detectChanges();
    const nativo = fixture.nativeElement as HTMLElement;
    const campo = nativo.querySelector('input[role="combobox"]') as HTMLInputElement;

    campo.value = 'maraba pa';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.termos).toEqual(['maraba pa']);
    expect(
      [...nativo.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim()),
    ).toEqual(['Marabá (PA)']);
  });
});

@Component({
  standalone: true,
  imports: [ComboboxComponent],
  template: `
    <ui-combobox
      rotulo="Municípios"
      buscaExterna
      multiplo
      textoSemResultado="Buscando municípios…"
      [grupos]="grupos()"
      [values]="marcados()"
      (valuesChange)="marcados.set($event)"
      (buscaChange)="termos.push($event)"
    />
  `,
})
class HospedeiroDaBuscaExternaMultipla {
  readonly grupos = signal<readonly UiComboboxGroup[]>([
    {
      label: 'Encontrados',
      options: [
        { value: '1504208', label: 'Marabá (PA)' },
        { value: '1500107', label: 'Abaetetuba (PA)' },
      ],
    },
  ]);
  readonly marcados = signal<readonly string[]>([]);
  readonly termos: string[] = [];
}

describe('ComboboxComponent com a busca do hospedeiro e escolha múltipla', () => {
  it('marcar um resultado não refaz a busca: os outros da mesma consulta continuam para marcar', async () => {
    await TestBed.configureTestingModule({
      imports: [HospedeiroDaBuscaExternaMultipla],
    }).compileComponents();
    const fixture = TestBed.createComponent(HospedeiroDaBuscaExternaMultipla);
    fixture.detectChanges();
    const nativo = fixture.nativeElement as HTMLElement;
    const campo = nativo.querySelector('input[role="combobox"]') as HTMLInputElement;

    campo.value = 'pa';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    nativo
      .querySelector('[role="option"]')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.marcados()).toEqual(['1504208']);
    expect(fixture.componentInstance.termos, 'nenhuma busca vazia ao hospedeiro').toEqual(['pa']);
  });
});

describe('ComboboxComponent com erro de fora', () => {
  it('se anuncia inválido e liga a descrição de fora junto da contagem', () => {
    const fixture = TestBed.createComponent(ComboboxComponent);
    fixture.componentRef.setInput('rotulo', 'Municípios');
    fixture.componentRef.setInput('grupos', []);
    fixture.componentRef.setInput('invalido', true);
    fixture.componentRef.setInput('descritoPor', 'condicao-erro');
    fixture.detectChanges();
    const campo = (fixture.nativeElement as HTMLElement).querySelector(
      'input[role="combobox"]',
    ) as HTMLInputElement;

    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')?.split(' ')).toContain('condicao-erro');
  });
});

describe('ComboboxComponent com o estado da busca do hospedeiro', () => {
  it('anuncia o estado da busca mesmo com opções já escolhidas na lista', () => {
    const fixture = TestBed.createComponent(ComboboxComponent);
    fixture.componentRef.setInput('rotulo', 'Municípios');
    fixture.componentRef.setInput('buscaExterna', true);
    fixture.componentRef.setInput('multiplo', true);
    fixture.componentRef.setInput('values', ['1504208']);
    fixture.componentRef.setInput('grupos', [
      { label: 'Escolhido', options: [{ value: '1504208', label: 'Marabá (PA)' }] },
    ]);
    fixture.componentRef.setInput(
      'estadoDaBusca',
      'Não foi possível buscar os municípios: serviço indisponível',
    );
    fixture.detectChanges();
    const nativo = fixture.nativeElement as HTMLElement;
    const campo = nativo.querySelector('input[role="combobox"]') as HTMLInputElement;

    campo.value = 'Bel';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(nativo.querySelector('[role="status"]')?.textContent).toContain(
      'Não foi possível buscar os municípios',
    );
  });
});
