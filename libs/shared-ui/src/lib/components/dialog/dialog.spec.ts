import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';

import { DialogComponent } from './dialog';

describe('DialogComponent', () => {
  let fixture: ComponentFixture<DialogComponent>;
  let componente: DialogComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DialogComponent] });
    fixture = TestBed.createComponent(DialogComponent);
    componente = fixture.componentInstance;
  });

  const elementoDialogo = () =>
    fixture.debugElement.query(By.css('dialog')).nativeElement as HTMLDialogElement;
  const botaoFechar = () =>
    fixture.debugElement.query(By.css('[aria-label="Fechar"]')).nativeElement as HTMLButtonElement;

  /** Um evento `cancel` cancelável, como o que o Esc dispara no `<dialog>`. */
  function esc(): Event {
    const evento = new Event('cancel', { cancelable: true });
    elementoDialogo().dispatchEvent(evento);
    return evento;
  }

  it('fecha por Esc e pelo botão quando é dispensável', () => {
    componente.visible.set(true);
    fixture.detectChanges();

    esc();
    expect(componente.visible()).toBe(false);

    componente.visible.set(true);
    fixture.detectChanges();
    botaoFechar().click();
    expect(componente.visible()).toBe(false);
  });

  /**
   * Sem isto, sair fecharia o diálogo por um caminho que quem o abriu não vê:
   * o estado do pai continuaria dizendo "aberto" enquanto a tela já não o
   * mostra — e a operação que o diálogo anuncia segue correndo sem aviso.
   */
  it('recusa Esc e desabilita o botão quando não é dispensável', () => {
    fixture.componentRef.setInput('dismissible', false);
    componente.visible.set(true);
    fixture.detectChanges();

    const evento = esc();

    expect(evento.defaultPrevented).toBe(true);
    expect(componente.visible()).toBe(true);
    expect(botaoFechar().disabled).toBe(true);
  });

  /** Quem abriu continua no controle: fechar pelo `visible` sempre funciona. */
  it('fecha pelo visible mesmo quando não é dispensável', () => {
    fixture.componentRef.setInput('dismissible', false);
    componente.visible.set(true);
    fixture.detectChanges();

    componente.visible.set(false);
    fixture.detectChanges();

    expect(elementoDialogo().open).toBe(false);
  });
});
