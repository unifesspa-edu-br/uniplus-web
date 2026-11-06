import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { SpinnerComponent } from './spinner';

describe('SpinnerComponent', () => {
  let fixture: ComponentFixture<SpinnerComponent>;
  const indicador = (): HTMLElement => fixture.nativeElement.querySelector('.spinner');

  beforeEach(() => {
    fixture = TestBed.createComponent(SpinnerComponent);
    fixture.detectChanges();
  });

  it('anuncia o carregamento como status com o nome acessível', () => {
    expect(indicador().getAttribute('role')).toBe('status');
    expect(indicador().getAttribute('aria-label')).toBe('Carregando');
  });

  it('decorativo não fala: sem papel, sem nome e fora da árvore de acessibilidade', () => {
    fixture.componentRef.setInput('decorativo', true);
    fixture.detectChanges();

    expect(indicador().getAttribute('role')).toBeNull();
    expect(indicador().getAttribute('aria-label')).toBeNull();
    expect(indicador().getAttribute('aria-hidden')).toBe('true');
  });
});
