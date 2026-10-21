import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { baseLegalNova, type BaseLegalDoDocumento } from './documentos-exigidos';
import { NormasDaExigenciaComponent } from './normas-da-exigencia';

@Component({
  standalone: true,
  imports: [NormasDaExigenciaComponent],
  template: `<ui-normas-da-exigencia
    idBase="x"
    [manterUma]="manterUma()"
    [bases]="bases()"
    (basesChange)="bases.set($event)"
  />`,
})
class HospedeiroComponent {
  readonly bases = signal<readonly BaseLegalDoDocumento[]>([baseLegalNova()]);
  readonly manterUma = signal(false);
}

function montar() {
  const fixture = TestBed.createComponent(HospedeiroComponent);
  fixture.detectChanges();
  const nativo = fixture.nativeElement as HTMLElement;
  return { fixture, nativo, hospedeiro: fixture.componentInstance };
}

describe('NormasDaExigenciaComponent', () => {
  it('grava a referência e acrescenta uma norma igual à nova do contrato', () => {
    const { fixture, nativo, hospedeiro } = montar();
    const ref = nativo.querySelector('#x-base-0-ref') as HTMLInputElement;
    ref.value = 'Lei 12.711/2012';
    ref.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (nativo.querySelector('#x-base-nova') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(hospedeiro.bases()).toEqual([
      { ...baseLegalNova(), referencia: 'Lei 12.711/2012' },
      baseLegalNova(),
    ]);
  });

  it('deixa remover a última norma, a menos que o hospedeiro peça para mantê-la', () => {
    const { fixture, nativo, hospedeiro } = montar();
    expect(nativo.querySelector('#x-base-0-remover')).not.toBeNull();

    hospedeiro.manterUma.set(true);
    fixture.detectChanges();
    expect(nativo.querySelector('#x-base-0-remover')).toBeNull();

    hospedeiro.bases.set([baseLegalNova(), baseLegalNova()]);
    fixture.detectChanges();
    (nativo.querySelector('#x-base-1-remover') as HTMLButtonElement).click();
    expect(hospedeiro.bases()).toEqual([baseLegalNova()]);
  });
});
