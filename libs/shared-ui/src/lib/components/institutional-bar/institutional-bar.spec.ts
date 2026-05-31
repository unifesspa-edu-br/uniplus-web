import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { InstitutionalBarComponent } from './institutional-bar';

describe('InstitutionalBarComponent', () => {
  function setup(): ComponentFixture<InstitutionalBarComponent> {
    TestBed.configureTestingModule({ imports: [InstitutionalBarComponent] });
    const fixture = TestBed.createComponent(InstitutionalBarComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('mantem institutional-bar como contrato de classe do wrapper Angular', () => {
    const fixture = setup();
    const bar = fixture.debugElement.query(By.css('.institutional-bar'));

    expect(bar).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.gov-bar')).toBeNull();
  });

  it('nao renderiza links institucionais quando hrefs validos nao foram informados', () => {
    const fixture = setup();

    expect(fixture.nativeElement.querySelector('.institutional-bar__links')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="#"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Acessibilidade');
    expect(fixture.nativeElement.textContent).not.toContain('Privacidade');
  });

  it('renderiza somente links com href explicito', () => {
    const fixture = setup();

    fixture.componentRef.setInput('accessibilityHref', 'https://www.gov.br/governodigital/pt-br/acessibilidade-digital');
    fixture.componentRef.setInput('privacyHref', 'https://www.gov.br/pt-br/termos-de-uso');
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLAnchorElement>('.institutional-bar__links a'),
    );

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Acessibilidade',
      'Privacidade',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://www.gov.br/governodigital/pt-br/acessibilidade-digital',
      'https://www.gov.br/pt-br/termos-de-uso',
    ]);
  });
});
