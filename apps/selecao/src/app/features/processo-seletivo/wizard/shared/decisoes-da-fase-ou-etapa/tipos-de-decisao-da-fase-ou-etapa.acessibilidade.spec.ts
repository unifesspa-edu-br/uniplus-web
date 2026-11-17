import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { TiposDeDecisaoDaFaseOuEtapaComponent } from './tipos-de-decisao-da-fase-ou-etapa.component';

@Component({
  imports: [ReactiveFormsModule, TiposDeDecisaoDaFaseOuEtapaComponent],
  template: `
    <form [formGroup]="formulario">
      <sel-tipos-de-decisao-da-fase-ou-etapa
        formControlName="tiposDeDecisao"
        legenda="Decisões que esta fase toma"
        idDoGrupo="fase-tipos"
      />
    </form>
  `,
})
class AnfitriaoComponent {
  readonly formulario = new FormGroup({
    tiposDeDecisao: new FormControl<readonly string[]>(['CLASSIFICACAO', 'TIPO_DO_FUTURO'], {
      nonNullable: true,
    }),
  });
}

describe('TiposDeDecisaoDaFaseOuEtapaComponent: acessibilidade', () => {
  let fixture: ComponentFixture<AnfitriaoComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AnfitriaoComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  const violacoes = async () =>
    (await axe.run(fixture.nativeElement, { rules: { region: { enabled: false } } })).violations;

  it('não tem violações de acessibilidade com tipos marcados', async () => {
    expect(await violacoes()).toEqual([]);
  });

  it('não tem violações de acessibilidade com o grupo travado', async () => {
    fixture.componentInstance.formulario.disable();
    fixture.detectChanges();

    expect(await violacoes()).toEqual([]);
  });

  it('dá a cada caixa um nome acessível pelo rótulo visível', () => {
    const caixas = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');

    expect(caixas.length).toBeGreaterThan(0);
    for (const caixa of caixas) {
      expect(caixa.labels?.[0]?.textContent?.trim()).not.toBe('');
    }
  });
});
