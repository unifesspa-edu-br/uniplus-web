import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { IndicadorDaLeituraDirective } from './indicador-da-leitura';
import { acompanharLeitura } from './leitura-acompanhada';

@Component({
  selector: 'ui-teste-indicador',
  standalone: true,
  imports: [IndicadorDaLeituraDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p [uiIndicadorDaLeitura]="leitura">Carregando…</p>`,
})
class IndicadorComponent {
  readonly falha = signal<string | null>(null);
  readonly leitura = acompanharLeitura({
    falha: this.falha,
    pendente: signal(true),
    recarregar: () => undefined,
    destino: () => null,
  });
}

describe('IndicadorDaLeituraDirective', () => {
  let fixture: ComponentFixture<IndicadorComponent>;
  const indicador = (): HTMLElement => fixture.nativeElement.querySelector('p');

  beforeEach(() => {
    fixture = TestBed.createComponent(IndicadorComponent);
    fixture.detectChanges();
  });

  it('sem aviso de falha na tela, o indicador é a região de status da espera', () => {
    expect(indicador().getAttribute('role')).toBe('status');
  });

  it('com o aviso de falha na tela, o indicador perde o papel e não anuncia a espera de novo', () => {
    fixture.componentInstance.falha.set('Não foi possível ler.');
    fixture.detectChanges();

    expect(indicador().getAttribute('role')).toBeNull();
  });
});
