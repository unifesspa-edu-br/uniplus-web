import { VocabulariosDeConfiguracaoApi } from '@uniplus/shared-data/configuracao';
import { of } from 'rxjs';
import { ABRANGENCIAS } from './abrangencias.testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { CalendarioFormularioComponent } from './calendario-formulario.component';
import { criarFormularioDeCalendario } from './calendario-form';
import { criarGrupoDeDiaNaoUtil } from './dia-nao-util-form';

describe('CalendarioFormularioComponent', () => {
  let fixture: ComponentFixture<CalendarioFormularioComponent>;
  const form = criarFormularioDeCalendario();

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CalendarioFormularioComponent],
      providers: [
        provideRouter([]),
        {
          provide: VocabulariosDeConfiguracaoApi,
          useValue: { listar: () => of({ ok: true, data: Object.values(ABRANGENCIAS) }) },
        },
      ],
    });
    form.controls.diasNaoUteis.clear();
    form.controls.diasNaoUteis.push(criarGrupoDeDiaNaoUtil());
    fixture = TestBed.createComponent(CalendarioFormularioComponent);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('erro', null);
    fixture.componentRef.setInput('anuncio', '');
    fixture.componentRef.setInput('salvando', false);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const raiz = (): HTMLElement => fixture.nativeElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  const indisponivel = (botao: HTMLButtonElement): boolean =>
    botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true';

  it('com o envio em curso, todo acionador do formulário fica indisponível', async () => {
    fixture.componentRef.setInput('salvando', true);
    fixture.detectChanges();

    expect(botoes().length).toBeGreaterThanOrEqual(3);
    expect(botoes().filter((botao) => !indisponivel(botao))).toEqual([]);
    expect(raiz().querySelector('a')).toBeNull();
  });

  it('fora do envio, o formulário oferece adicionar, remover, cancelar para a lista e criar', () => {
    expect(botoes().filter(indisponivel)).toEqual([]);
    expect(raiz().querySelector('a[href="/calendario-dias-uteis"]')?.textContent).toContain(
      'Cancelar',
    );
    expect(raiz().textContent).toContain('Criar calendário');
  });

  it('mostra o erro do envio no alerta, com o título do formulário', () => {
    fixture.componentRef.setInput('erro', 'Recusado pelo servidor');
    fixture.detectChanges();

    const alerta = raiz().querySelector('ui-alert') as HTMLElement;
    expect(alerta.textContent).toContain('Não foi possível criar o calendário');
    expect(alerta.textContent).toContain('Recusado pelo servidor');
  });
});
