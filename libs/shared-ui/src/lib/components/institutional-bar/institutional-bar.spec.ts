import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { InstitutionalBarComponent } from './institutional-bar';

@Component({
  standalone: true,
  imports: [InstitutionalBarComponent],
  template: `<ui-institutional-bar><button id="entrar">Entrar</button></ui-institutional-bar>`,
})
class HospedeiroComponent {}

describe('InstitutionalBarComponent', () => {
  function setup(): { fixture: ComponentFixture<HospedeiroComponent>; raiz: HTMLElement } {
    TestBed.configureTestingModule({ imports: [HospedeiroComponent] });
    const fixture = TestBed.createComponent(HospedeiroComponent);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  function gatilho(raiz: HTMLElement): HTMLButtonElement {
    return raiz.querySelector('.institutional-bar__gatilho') as HTMLButtonElement;
  }

  it('mostra o logotipo gov.br com nome acessível e projeta o acesso à conta', () => {
    const { raiz } = setup();
    const logo = raiz.querySelector('.institutional-bar__logo');
    expect(logo?.getAttribute('aria-label')).toBe('gov.br (abre em nova aba)');
    expect(logo?.getAttribute('target')).toBe('_blank');
    expect(logo?.getAttribute('href')).toBe('https://www.gov.br/pt-br');
    expect(raiz.querySelector('.institutional-bar__acoes #entrar')).not.toBeNull();
  });

  it('o gatilho abre e fecha o menu Institucional', () => {
    const { fixture, raiz } = setup();
    const lista = raiz.querySelector('#menu-institucional') as HTMLUListElement;
    expect(lista.hidden).toBe(true);

    gatilho(raiz).click();
    fixture.detectChanges();
    expect(gatilho(raiz).getAttribute('aria-expanded')).toBe('true');
    expect(lista.hidden).toBe(false);

    gatilho(raiz).click();
    fixture.detectChanges();
    expect(lista.hidden).toBe(true);
  });

  it('o menu lista os links do Governo Federal, todos em nova aba', () => {
    const { raiz } = setup();
    const links = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('#menu-institucional a'));

    expect(links.map((a) => a.textContent?.replace(/\s+/gu, ' ').trim())).toEqual([
      'Órgãos do Governo (abre em nova aba)',
      'Acesso à Informação (abre em nova aba)',
      'Legislação (abre em nova aba)',
      'Minha área gov.br (abre em nova aba)',
    ]);
    expect(links.every((a) => a.target === '_blank' && a.rel.includes('noopener'))).toBe(true);
  });

  it('o foco saindo do menu, por Tab, fecha a lista', () => {
    const { fixture, raiz } = setup();
    gatilho(raiz).click();
    fixture.detectChanges();
    const ultimoLink = raiz.querySelector('#menu-institucional li:last-child a') as HTMLAnchorElement;
    const fora = raiz.querySelector('#entrar') as HTMLButtonElement;

    ultimoLink.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: fora }));
    fixture.detectChanges();

    expect((raiz.querySelector('#menu-institucional') as HTMLUListElement).hidden).toBe(true);
  });

  it('Escape num link do menu fecha a lista e devolve o foco ao gatilho', () => {
    const { fixture, raiz } = setup();
    gatilho(raiz).click();
    fixture.detectChanges();
    const link = raiz.querySelector('#menu-institucional a') as HTMLAnchorElement;
    link.focus();

    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect((raiz.querySelector('#menu-institucional') as HTMLUListElement).hidden).toBe(true);
    expect(document.activeElement).toBe(gatilho(raiz));
  });

  it('Escape numa ação vizinha fecha o menu sem tirar o foco dela', () => {
    const { fixture, raiz } = setup();
    gatilho(raiz).click();
    fixture.detectChanges();
    const acao = raiz.querySelector('#entrar') as HTMLButtonElement;
    acao.focus();

    acao.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect((raiz.querySelector('#menu-institucional') as HTMLUListElement).hidden).toBe(true);
    expect(document.activeElement).toBe(acao);
  });

  it('Escape com o foco fora da barra fecha o menu sem mover o foco', () => {
    const { fixture, raiz } = setup();
    gatilho(raiz).click();
    fixture.detectChanges();
    document.body.focus();

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect((raiz.querySelector('#menu-institucional') as HTMLUListElement).hidden).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it('clique nas ações ao lado, dentro da barra, fecha o menu', () => {
    const { fixture, raiz } = setup();
    gatilho(raiz).click();
    fixture.detectChanges();

    (raiz.querySelector('#entrar') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((raiz.querySelector('#menu-institucional') as HTMLUListElement).hidden).toBe(true);
  });

  it('clique fora da barra fecha o menu', () => {
    const { fixture, raiz } = setup();
    gatilho(raiz).click();
    fixture.detectChanges();

    document.body.click();
    fixture.detectChanges();

    expect((raiz.querySelector('#menu-institucional') as HTMLUListElement).hidden).toBe(true);
  });
});
