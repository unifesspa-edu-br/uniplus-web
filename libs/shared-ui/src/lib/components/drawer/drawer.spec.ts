import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DrawerComponent } from './drawer';

describe('DrawerComponent', () => {
  let fixture: ComponentFixture<DrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DrawerComponent] });
    fixture = TestBed.createComponent(DrawerComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.body.classList.remove('uni-drawer-open');
  });

  it('mantém o drawer nativo fechado por padrão', () => {
    const dialog = fixture.debugElement.query(By.css('dialog')).nativeElement as HTMLDialogElement;

    expect(dialog.open).toBe(false);
    expect(document.body.classList.contains('uni-drawer-open')).toBe(false);
  });

  it('abre o drawer e bloqueia a rolagem do body', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const dialog = fixture.debugElement.query(By.css('dialog')).nativeElement as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(document.body.classList.contains('uni-drawer-open')).toBe(true);
  });

  it('remove o bloqueio de rolagem ao fechar pelo botão', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const closeButton = fixture.debugElement.query(By.css('.uni-drawer__header button'))
      .nativeElement as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.visible()).toBe(false);
    expect(document.body.classList.contains('uni-drawer-open')).toBe(false);
  });

  it('usa o id informado pelo consumidor em vez do autogerado', () => {
    fixture.componentRef.setInput('id', 'meu-drawer-fixo');
    fixture.detectChanges();

    const dialog = fixture.debugElement.query(By.css('dialog')).nativeElement as HTMLDialogElement;
    expect(dialog.id).toBe('meu-drawer-fixo');
  });
});
