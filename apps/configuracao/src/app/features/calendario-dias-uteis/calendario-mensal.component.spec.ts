import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CalendarioMensalComponent } from './calendario-mensal.component';
import { agruparPorMes, type CelulaCalendarioMensal } from './calendario-mensal.util';
import { DIA_ESTADUAL, DIA_MUNICIPAL } from './calendario-dias-uteis.testing';
import type { DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';

describe('CalendarioMensalComponent', () => {
  let fixture: ComponentFixture<CalendarioMensalComponent>;
  let escolhidos: CelulaCalendarioMensal[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [CalendarioMensalComponent] });
    fixture = TestBed.createComponent(CalendarioMensalComponent);
    escolhidos = [];
    fixture.componentRef.setInput(
      'meses',
      agruparPorMes([DIA_MUNICIPAL, DIA_ESTADUAL] as unknown as DiaNaoUtilDto[], 2026),
    );
    fixture.componentRef.setInput('previa', null);
    fixture.componentInstance.diaEscolhido.subscribe((celula) => escolhidos.push(celula));
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const botao = (inicio: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`button[aria-label^="${inicio}"]`) as HTMLButtonElement;

  it('o clique em qualquer dia, com ou sem ocorrência, entrega a célula', () => {
    botao('5 de abril').click();
    botao('6 de abril').click();

    expect(escolhidos.map((celula) => celula.data)).toEqual(['2026-04-05', '2026-04-06']);
  });

  it('a prévia acompanha o foco do dia com ocorrência e some ao perdê-lo sem o mouse', async () => {
    const dia = botao('5 de abril');

    dia.dispatchEvent(new FocusEvent('focus'));
    expect(fixture.componentInstance.previa()).toBe('2026-04-05');
    dia.dispatchEvent(new FocusEvent('blur'));

    expect(fixture.componentInstance.previa()).toBeNull();
  });

  it('a prévia fica quando o foco sai mas o mouse segue sobre o dia', () => {
    const dia = botao('5 de abril');
    dia.dispatchEvent(new FocusEvent('focus'));
    const pairar = (): boolean => true;
    dia.matches = ((seletor: string) => (seletor === ':hover' ? pairar() : false)) as never;

    dia.dispatchEvent(new FocusEvent('blur'));

    expect(fixture.componentInstance.previa()).toBe('2026-04-05');
  });

  it('o mouse que sai do botão focado mantém a prévia; fora do foco, a esconde', () => {
    const dia = botao('5 de abril');
    dia.focus();
    dia.dispatchEvent(new MouseEvent('mouseenter'));

    dia.dispatchEvent(new MouseEvent('mouseleave'));
    expect(fixture.componentInstance.previa()).toBe('2026-04-05');

    dia.blur();
    fixture.componentInstance.previa.set('2026-04-05');
    dia.dispatchEvent(new MouseEvent('mouseleave'));
    expect(fixture.componentInstance.previa()).toBeNull();
  });
});
