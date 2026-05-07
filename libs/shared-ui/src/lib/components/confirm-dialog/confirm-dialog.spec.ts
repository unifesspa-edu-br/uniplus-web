import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogComponent } from './confirm-dialog';

describe('ConfirmDialogComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] });
  });

  function setup() {
    const fixture: ComponentFixture<ConfirmDialogComponent> =
      TestBed.createComponent(ConfirmDialogComponent);
    const component = fixture.componentInstance;

    const dialog = () => fixture.debugElement.query(By.css('[role="dialog"]'));
    const heading = () => fixture.debugElement.query(By.css('h3'));
    const message = () => fixture.debugElement.query(By.css('p'));
    const cancelButton = () =>
      fixture.debugElement.query(By.css('[data-testid="confirm-dialog-cancel"]'));
    const confirmButton = () =>
      fixture.debugElement.query(By.css('[data-testid="confirm-dialog-confirm"]'));
    const confirmedSpy = vi.spyOn(component.confirmed, 'emit');
    const cancelledSpy = vi.spyOn(component.cancelled, 'emit');

    return {
      fixture,
      component,
      dialog,
      heading,
      message,
      cancelButton,
      confirmButton,
      confirmedSpy,
      cancelledSpy,
    };
  }

  function open(fixture: ComponentFixture<ConfirmDialogComponent>): void {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  describe('estado inicial', () => {
    it('inicializa o componente sem erros', () => {
      const { component } = setup();
      expect(component).toBeTruthy();
    });

    it('não renderiza nada quando visible() é false (default)', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.debugElement.children.length).toBe(0);
    });
  });

  describe('quando visible() é true', () => {
    it('renderiza o dialog com role e aria-modal corretos para leitores de tela', () => {
      const { fixture, dialog } = setup();
      open(fixture);

      const dialogEl = dialog().nativeElement as HTMLElement;
      expect(dialogEl.getAttribute('role')).toBe('dialog');
      expect(dialogEl.getAttribute('aria-modal')).toBe('true');
    });

    it('usa textos default de título, mensagem e labels', () => {
      const { fixture, heading, message, cancelButton, confirmButton } = setup();
      open(fixture);

      expect(heading().nativeElement.textContent.trim()).toBe('Confirmação');
      expect(message().nativeElement.textContent.trim()).toBe('Deseja realmente prosseguir?');
      expect(cancelButton().nativeElement.textContent.trim()).toBe('Cancelar');
      expect(confirmButton().nativeElement.textContent.trim()).toBe('Confirmar');
    });
  });

  describe('emissão de eventos', () => {
    it('emite cancelled() e fecha o dialog ao clicar em Cancelar', () => {
      const { fixture, component, cancelButton, cancelledSpy } = setup();
      open(fixture);

      (cancelButton().nativeElement as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(cancelledSpy).toHaveBeenCalledOnce();
      expect(component.visible()).toBe(false);
    });

    it('emite confirmed() e fecha o dialog ao clicar em Confirmar', () => {
      const { fixture, component, confirmButton, confirmedSpy } = setup();
      open(fixture);

      (confirmButton().nativeElement as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(confirmedSpy).toHaveBeenCalledOnce();
      expect(component.visible()).toBe(false);
    });

    it('não emite cancelled() quando o usuário clica em Confirmar', () => {
      const { fixture, confirmButton, cancelledSpy } = setup();
      open(fixture);

      (confirmButton().nativeElement as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(cancelledSpy).not.toHaveBeenCalled();
    });
  });

  describe('inputs customizados', () => {
    it('aceita título customizado', () => {
      const { fixture, heading } = setup();
      const titulo = 'Tela de Confirmação';
      fixture.componentRef.setInput('title', titulo);
      open(fixture);

      expect(heading().nativeElement.textContent.trim()).toBe(titulo);
    });

    it('aceita mensagem customizada', () => {
      const { fixture, message } = setup();
      const mensagem = 'Deseja realmente prosseguir com a operação?';
      fixture.componentRef.setInput('message', mensagem);
      open(fixture);

      expect(message().nativeElement.textContent.trim()).toBe(mensagem);
    });

    it('aceita label customizado para o botão de confirmação', () => {
      const { fixture, confirmButton } = setup();
      fixture.componentRef.setInput('confirmLabel', 'Aprovar matrícula');
      open(fixture);

      expect(confirmButton().nativeElement.textContent.trim()).toBe('Aprovar matrícula');
    });

    it('aceita label customizado para o botão de cancelar', () => {
      const { fixture, cancelButton } = setup();
      fixture.componentRef.setInput('cancelLabel', 'Voltar');
      open(fixture);

      expect(cancelButton().nativeElement.textContent.trim()).toBe('Voltar');
    });
  });

  describe('confirmVariant()', () => {
    it('aplica variant primary por default', () => {
      const { fixture, confirmButton } = setup();
      open(fixture);

      expect(confirmButton().nativeElement.getAttribute('data-variant')).toBe('primary');
    });

    it('aplica variant danger quando configurado', () => {
      const { fixture, confirmButton } = setup();
      fixture.componentRef.setInput('confirmVariant', 'danger');
      open(fixture);

      expect(confirmButton().nativeElement.getAttribute('data-variant')).toBe('danger');
    });
  });
});
