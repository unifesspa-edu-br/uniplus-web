import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ConfirmacaoDialogComponent } from './confirmacao-dialog';

describe('ConfirmacaoDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmacaoDialogComponent>;
  let component: ConfirmacaoDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmacaoDialogComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmacaoDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('deve renderizar o botão de enviar inscrição', () => {
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('button');
    expect(btn?.textContent?.trim()).toContain('Enviar Inscrição');
  });

  it('não deve exibir o modal inicialmente', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('deve exibir o modal ao clicar no botão', async () => {
    component.abrir();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
    expect(el.textContent).toContain('Confirmar inscrição');
  });

  it('deve fechar o modal ao clicar cancelar', async () => {
    component.abrir();
    fixture.detectChanges();
    await fixture.whenStable();

    component.fechar();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('deve emitir evento confirmado ao clicar confirmar', async () => {
    const spy = vi.fn();
    component.confirmado.subscribe(spy);

    component.abrir();
    fixture.detectChanges();
    await fixture.whenStable();

    const confirmarBtn = fixture.nativeElement.querySelector('[data-testid="btn-confirmar"]');
    confirmarBtn?.click();

    expect(spy).toHaveBeenCalled();
    expect(component.visivel()).toBe(false);
  });
});
