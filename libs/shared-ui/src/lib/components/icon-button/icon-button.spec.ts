import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IconButtonComponent } from './icon-button';

describe('IconButtonComponent (ação só-ícone com dica)', () => {
  let fixture: ComponentFixture<IconButtonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IconButtonComponent] });
    fixture = TestBed.createComponent(IconButtonComponent);
    fixture.componentRef.setInput('icon', 'pi-pencil');
    fixture.componentRef.setInput('accessibleName', 'Editar curso BCC');
  });

  function botao(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
  }

  it('renderiza um botão só-ícone com o glifo, aria-label e visual do DS', () => {
    fixture.detectChanges();
    const b = botao();
    expect(b.getAttribute('aria-label')).toBe('Editar curso BCC');
    expect(b.classList.contains('btn--icon-only')).toBe(true);
    expect(b.classList.contains('btn--tertiary')).toBe(true);
    expect(b.querySelector('i')?.className).toBe('pi pi-pencil');
    expect(b.querySelector('i')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('usa a dica curta quando informada, senão cai no accessibleName', () => {
    fixture.detectChanges();
    expect(botao().getAttribute('data-tooltip')).toBe('Editar curso BCC');

    fixture.componentRef.setInput('tooltip', 'Editar curso');
    fixture.detectChanges();
    expect(botao().getAttribute('data-tooltip')).toBe('Editar curso');
    expect(botao().getAttribute('data-tooltip-position')).toBe('left');
  });

  it('danger troca tertiary por danger', () => {
    fixture.componentRef.setInput('danger', true);
    fixture.detectChanges();
    expect(botao().classList.contains('btn--danger')).toBe(true);
    expect(botao().classList.contains('btn--tertiary')).toBe(false);
  });

  it('isDisabled desabilita o botão', () => {
    fixture.componentRef.setInput('isDisabled', true);
    fixture.detectChanges();
    expect(botao().disabled).toBe(true);
  });

  it('emite triggered no clique', () => {
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.triggered.subscribe(spy);
    botao().click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
