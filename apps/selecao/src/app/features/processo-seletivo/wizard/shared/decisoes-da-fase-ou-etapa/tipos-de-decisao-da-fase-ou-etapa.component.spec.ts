import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';

import { TiposDeDecisaoDaFaseOuEtapaComponent } from './tipos-de-decisao-da-fase-ou-etapa.component';

@Component({
  imports: [ReactiveFormsModule, TiposDeDecisaoDaFaseOuEtapaComponent],
  template: `
    <form [formGroup]="formulario">
      <sel-tipos-de-decisao-da-fase-ou-etapa
        formControlName="tiposDeDecisao"
        legenda="Decisões que esta etapa toma"
        [idDoGrupo]="idDoGrupo"
      />
    </form>
  `,
})
class AnfitriaoComponent {
  idDoGrupo = 'grupo-a';
  readonly formulario = new FormGroup({
    tiposDeDecisao: new FormControl<readonly string[]>([], { nonNullable: true }),
  });
}

describe('TiposDeDecisaoDaFaseOuEtapaComponent', () => {
  let fixture: ComponentFixture<AnfitriaoComponent>;
  let anfitriao: AnfitriaoComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(AnfitriaoComponent);
    anfitriao = fixture.componentInstance;
    fixture.detectChanges();
  });

  const caixa = (codigo: string, grupo = 'grupo-a') =>
    fixture.nativeElement.querySelector(`#${grupo}-${codigo}`) as HTMLInputElement;
  const valor = () => anfitriao.formulario.controls.tiposDeDecisao.value;

  const marcar = (codigo: string, marcado: boolean) => {
    caixa(codigo).checked = marcado;
    caixa(codigo).dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('reidrata as caixas com o valor escrito no controle', () => {
    anfitriao.formulario.controls.tiposDeDecisao.setValue(['CLASSIFICACAO']);
    fixture.detectChanges();

    expect(caixa('CLASSIFICACAO').checked).toBe(true);
    expect(caixa('NOTA_DA_ETAPA').checked).toBe(false);
  });

  it('desmarca tudo quando o controle é reiniciado', () => {
    anfitriao.formulario.controls.tiposDeDecisao.setValue(['CLASSIFICACAO']);
    anfitriao.formulario.reset();
    fixture.detectChanges();

    expect(caixa('CLASSIFICACAO').checked).toBe(false);
  });

  it('avisa o controle com os tipos marcados em ordem alfabética do código', () => {
    marcar('NOTA_DA_ETAPA', true);
    marcar('CLASSIFICACAO', true);

    expect(valor()).toEqual(['CLASSIFICACAO', 'NOTA_DA_ETAPA']);
    expect(anfitriao.formulario.controls.tiposDeDecisao.dirty).toBe(true);
  });

  it('tira do valor o tipo desmarcado', () => {
    anfitriao.formulario.controls.tiposDeDecisao.setValue(['CLASSIFICACAO', 'NOTA_DA_ETAPA']);
    fixture.detectChanges();

    marcar('CLASSIFICACAO', false);

    expect(valor()).toEqual(['NOTA_DA_ETAPA']);
  });

  it('marca o controle como tocado ao alternar um tipo', () => {
    marcar('CLASSIFICACAO', true);

    expect(anfitriao.formulario.controls.tiposDeDecisao.touched).toBe(true);
  });

  it('mostra o código declarado que o vocabulário não conhece, para poder retirá-lo', () => {
    anfitriao.formulario.controls.tiposDeDecisao.setValue(['TIPO_DO_FUTURO']);
    fixture.detectChanges();

    expect(caixa('TIPO_DO_FUTURO').checked).toBe(true);

    marcar('TIPO_DO_FUTURO', false);

    expect(valor()).toEqual([]);
  });

  it('trava as caixas quando o controle é desabilitado e as libera quando é habilitado', () => {
    anfitriao.formulario.disable();
    fixture.detectChanges();
    expect(caixa('CLASSIFICACAO').disabled).toBe(true);

    anfitriao.formulario.enable();
    fixture.detectChanges();
    expect(caixa('CLASSIFICACAO').disabled).toBe(false);
  });

  it('diz a legenda no grupo e liga a dica a ele pelo id do grupo', () => {
    const grupo = fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement;

    expect(grupo.querySelector('legend')?.textContent).toBe('Decisões que esta etapa toma');
    expect(grupo.getAttribute('aria-describedby')).toBe('grupo-a-ajuda');
    expect(fixture.nativeElement.querySelector('#grupo-a-ajuda')).not.toBeNull();
  });

  it('dá a cada caixa um id próprio do grupo e liga o rótulo a ela', () => {
    const rotulo = caixa('CLASSIFICACAO').closest('label') as HTMLLabelElement;

    expect(rotulo.htmlFor).toBe('grupo-a-CLASSIFICACAO');
    expect(rotulo.textContent).toContain('Classificação');
  });

  it('não repete id quando há dois grupos na mesma tela', () => {
    anfitriao.idDoGrupo = 'grupo-b';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(caixa('CLASSIFICACAO', 'grupo-b')).not.toBeNull();
    expect(caixa('CLASSIFICACAO', 'grupo-a')).toBeNull();
  });
});
