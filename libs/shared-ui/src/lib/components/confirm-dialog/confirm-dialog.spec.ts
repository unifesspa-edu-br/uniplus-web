import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConfirmDialogComponent } from './confirm-dialog';

describe('ConfirmDialogComponent', () => {
  const DEFAULT_CONFIRM_LABEL = 'Confirmar';
  const DEFAULT_CANCEL_LABEL = 'Cancelar';

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] });
  });

  function setup(opt?: { confirmLabel?: string, cancelLabel?: string } ) {
    const fixture: ComponentFixture<ConfirmDialogComponent> =
      TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const getDialogEl = () =>
      fixture.debugElement.query(By.css('[role="dialog"]')).nativeElement as HTMLDivElement;
    const getButtons = () => fixture.debugElement.queryAll(By.css('button'));
    const getCancelButtonEl = () => getButtons().find(b => b.nativeElement.textContent.trim() === (opt?.cancelLabel ?? DEFAULT_CANCEL_LABEL))?.nativeElement as HTMLButtonElement;
    const getConfirmButtonEl = () => getButtons().find(b => b.nativeElement.textContent.trim() === (opt?.confirmLabel ?? DEFAULT_CONFIRM_LABEL))?.nativeElement as HTMLButtonElement;
    const confirmedOutputSpy = vi.spyOn(component.confirmed, 'emit');
    const cancelledOutputSpy = vi.spyOn(component.cancelled, 'emit');
    return {
      fixture,
      component,
      getDialogEl,
      getCancelButtonEl,
      getConfirmButtonEl,
      confirmedOutputSpy,
      cancelledOutputSpy
    };
  }

  it('inicializa o componente corretamente', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('renderiza o componente sem nós filhos no DOM quando visible() é false (default)', () => {
    const { fixture } = setup();
    expect(fixture.debugElement.children.length).toBe(0);
  });

  it('renderiza o dialog quando o input visible() é inicializado com o valor true', () => {
    const { fixture, getDialogEl, getCancelButtonEl, getConfirmButtonEl } = setup();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const headingEl = fixture.debugElement.query(By.css('h3')).nativeElement as HTMLHeadingElement;
    const paragraphEl = fixture.debugElement.query(By.css('p')).nativeElement as HTMLParagraphElement;
    const cancelButtonEl = getCancelButtonEl();
    const confirmButtonEl = getConfirmButtonEl();
    const dialogEl = getDialogEl();

    expect(dialogEl).toBeTruthy();
    expect(headingEl).toBeTruthy();
    expect(headingEl.textContent).toBe('Confirmação');
    expect(paragraphEl.textContent).toBe('Deseja realmente prosseguir?');
    expect(confirmButtonEl.textContent?.trim()).toBe('Confirmar');
    expect(cancelButtonEl.textContent?.trim()).toBe('Cancelar');
  });

  it('emite um evento de output cancelled() quando clicar no botão cancelar', () => {
    const { fixture, component, getCancelButtonEl, cancelledOutputSpy } = setup();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const cancelButtonEl = getCancelButtonEl();
    cancelButtonEl.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(false);
    expect(cancelledOutputSpy).toHaveBeenCalled();
  });

  it('emite um evento de output confirmed() quando clicar no botão confirmar', () => {
    const { fixture, component, getConfirmButtonEl, confirmedOutputSpy } = setup();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const confirmButtonEl = getConfirmButtonEl();
    confirmButtonEl.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(false);
    expect(confirmedOutputSpy).toHaveBeenCalled();
  });

  it('renderiza um título customizado', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('visible', true);
    const title = 'Tela de Confirmação';
    fixture.componentRef.setInput('title', title);
    fixture.detectChanges();

    const headingEl = fixture.debugElement.query(By.css('h3')).nativeElement as HTMLHeadingElement;

    expect(component.title()).toBe(title);
    expect(headingEl.textContent?.trim()).toBe(component.title());
  });

  it('renderiza um parágrafo customizado', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('visible', true);
    const message = 'Deseja realmente prosseguir com a operação?';
    fixture.componentRef.setInput('message', message);
    fixture.detectChanges();

    const paragraphEl = fixture.debugElement.query(By.css('p')).nativeElement as HTMLParagraphElement;

    expect(component.message()).toBe(message);
    expect(paragraphEl.textContent?.trim()).toBe(component.message());
  });

  it('renderiza botão de confirmação com um texto customizado', () => {
    const confirmLabel = 'Confirmar Operação';
    const { fixture, component, getConfirmButtonEl } = setup({ confirmLabel: confirmLabel });
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('confirmLabel', confirmLabel);
    fixture.detectChanges();

    const confirmButtonEl = getConfirmButtonEl();

    expect(confirmButtonEl.textContent?.trim()).toBe(confirmLabel);
    expect(confirmButtonEl.textContent?.trim()).toBe(component.confirmLabel());
  });

  it('renderiza botão de cancelar com texto customizado', () => {
    const cancelLabel = 'Cancelar Operação';
    const { fixture, getCancelButtonEl } = setup({ cancelLabel: cancelLabel });
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('cancelLabel', cancelLabel);
    fixture.detectChanges();

    const cancelButtonEl = getCancelButtonEl();

    expect(cancelButtonEl.textContent?.trim()).toBe(cancelLabel);
  });

  it('aplica classes css no botão de confirmação quando o input confirmVariant() é "primary" (default)', () => {
    const { fixture, getConfirmButtonEl } = setup();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const confirmButtonEl = getConfirmButtonEl();

    expect(confirmButtonEl.classList).toContain('bg-unifesspa-primary');
    expect(confirmButtonEl.classList).toContain('hover:bg-blue-800');
  });

  it('aplica classes css no botão de confirmação quando o input confirmVariant() é "danger"', () => {
    const { fixture, getConfirmButtonEl } = setup();
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('confirmVariant', 'danger');
    fixture.detectChanges();

    const confirmButtonEl = getConfirmButtonEl();

    expect(confirmButtonEl.classList).toContain('bg-red-600');
    expect(confirmButtonEl.classList).toContain('hover:bg-red-700');
  });
});
