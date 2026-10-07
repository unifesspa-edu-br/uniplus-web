import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { IconButtonComponent } from './icon-button';

describe('IconButtonComponent em link', () => {
  function montar(novaAba: boolean): HTMLAnchorElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(IconButtonComponent);
    fixture.componentRef.setInput('icon', 'pi-play');
    fixture.componentRef.setInput('accessibleName', 'Simular');
    fixture.componentRef.setInput('link', ['simulacao']);
    fixture.componentRef.setInput('novaAba', novaAba);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('a') as HTMLAnchorElement;
  }

  it('em nova aba, o clique fica com o navegador e não navega na aba atual', () => {
    const link = montar(true);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');

    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(clique);

    expect(navegar).not.toHaveBeenCalled();
    expect(clique.defaultPrevented).toBe(false);
  });

  it('sem nova aba, navega na aba atual', () => {
    const link = montar(false);
    expect(link.hasAttribute('target')).toBe(false);
  });
});
