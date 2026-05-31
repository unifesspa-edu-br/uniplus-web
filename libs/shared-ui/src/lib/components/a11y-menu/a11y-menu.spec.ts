import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { A11yMenuComponent } from './a11y-menu';

describe('A11yMenuComponent', () => {
  let fixture: ComponentFixture<A11yMenuComponent>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [A11yMenuComponent] });
    fixture = TestBed.createComponent(A11yMenuComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-font-mode');
  });

  it('renderiza trigger com ícone e contrato de disclosure do DS', () => {
    const trigger = fixture.debugElement.query(By.css('.a11y-menu__trigger')).nativeElement as HTMLButtonElement;

    expect(trigger.getAttribute('aria-label')).toBe('Preferências de acessibilidade');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('data-a11y-menu-trigger')).toBe(true);
    expect(trigger.querySelector('svg')).not.toBeNull();
  });

  it('abre popover, atualiza aria-expanded e envia foco ao primeiro controle', () => {
    vi.useFakeTimers();
    const trigger = fixture.debugElement.query(By.css('.a11y-menu__trigger')).nativeElement as HTMLButtonElement;

    trigger.click();
    fixture.detectChanges();
    vi.runOnlyPendingTimers();

    const popover = fixture.debugElement.query(By.css('.a11y-menu__popover')).nativeElement as HTMLElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(popover.hidden).toBe(false);
    expect(document.activeElement?.textContent?.trim()).toBe('Claro');
  });

  it('aplica tema contraste no html e persiste no mesmo storage do DS', () => {
    const contrast = fixture.debugElement.query(
      By.css('[data-a11y="contrast"][data-value="on"]'),
    ).nativeElement as HTMLButtonElement;

    contrast.click();
    fixture.detectChanges();

    expect(document.documentElement.dataset['theme']).toBe('contrast');
    expect(JSON.parse(localStorage.getItem('uniplus.a11y') ?? '{}')).toEqual({
      theme: 'auto',
      contrast: true,
      fontMode: 'default',
    });
    expect(contrast.getAttribute('aria-pressed')).toBe('true');
  });

  it('fecha com Escape e restaura foco no trigger', () => {
    vi.useFakeTimers();
    const trigger = fixture.debugElement.query(By.css('.a11y-menu__trigger')).nativeElement as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    vi.runOnlyPendingTimers();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    const popover = fixture.debugElement.query(By.css('.a11y-menu__popover')).nativeElement as HTMLElement;
    expect(popover.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
});
