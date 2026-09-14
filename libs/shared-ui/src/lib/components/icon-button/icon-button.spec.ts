import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IconButtonComponent } from './icon-button';

describe('IconButtonComponent (ação só-ícone com dica)', () => {
  let fixture: ComponentFixture<IconButtonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IconButtonComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
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

  it('description expõe um motivo via aria-describedby, sem alterar a dica visível', () => {
    fixture.componentRef.setInput('tooltip', 'Inativar');
    fixture.componentRef.setInput('description', 'A condição PCD não pode ser inativada.');
    fixture.detectChanges();

    const b = botao();
    const describedById = b.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    expect(b.getAttribute('data-tooltip')).toBe('Inativar');

    const descricao = fixture.nativeElement.querySelector(`#${describedById}`) as HTMLElement;
    expect(descricao.textContent).toBe('A condição PCD não pode ser inativada.');
    expect(descricao.classList.contains('sr-only')).toBe(true);
  });

  it('sem description não expõe aria-describedby nem span oculto', () => {
    fixture.detectChanges();
    expect(botao().getAttribute('aria-describedby')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sr-only')).toBeNull();
  });

  it('link renderiza <a routerLink> em vez de <button>, preservando aria-label e dica', () => {
    fixture.componentRef.setInput('link', ['123']);
    fixture.componentRef.setInput('tooltip', 'Editar curso');
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('button'))).toBeNull();
    const link = fixture.debugElement.query(By.css('a')).nativeElement as HTMLAnchorElement;
    expect(link.getAttribute('aria-label')).toBe('Editar curso BCC');
    expect(link.getAttribute('data-tooltip')).toBe('Editar curso');
    expect(link.classList.contains('btn--icon-only')).toBe(true);
    expect(link.getAttribute('href')).toBe('/123');
  });
});
