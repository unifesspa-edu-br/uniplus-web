import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ConfirmDialogComponent } from './confirm-dialog';

describe('ConfirmDialogComponent', () => {
  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
    imports: [ConfirmDialogComponent],
    });
    const fixture: ComponentFixture<ConfirmDialogComponent> =
          TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const getDialogEl = () =>
        fixture.debugElement.query(By.css('[role="dialog"]')).nativeElement as HTMLDivElement;
    const getCancelButtonEl = () => fixture.debugElement.queryAll(By.css('button'))[0].nativeElement as HTMLButtonElement;
    const getConfirmButtonEl = () => fixture.debugElement.queryAll(By.css('button'))[1].nativeElement as HTMLButtonElement;
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
    expect(confirmButtonEl.textContent).toBe(' Confirmar ');
    expect(cancelButtonEl.textContent).toBe(' Cancelar ');
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
});
