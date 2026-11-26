import { ComponentFixture, TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisoDeSessaoEncerradaComponent } from './aviso-de-sessao-encerrada';

describe('AvisoDeSessaoEncerradaComponent', () => {
  let fixture: ComponentFixture<AvisoDeSessaoEncerradaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AvisoDeSessaoEncerradaComponent] });
    fixture = TestBed.createComponent(AvisoDeSessaoEncerradaComponent);
    document.body.appendChild(fixture.nativeElement);
  });

  function mostrar(aberto: boolean): void {
    fixture.componentRef.setInput('aberto', aberto);
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function botao(rotulo: string): HTMLButtonElement {
    const botoes = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    return botoes.find((item) => item.textContent?.trim() === rotulo) as HTMLButtonElement;
  }

  it('fica fechado enquanto o aviso não é aberto', () => {
    mostrar(false);

    expect(fixture.nativeElement.querySelector('dialog')?.open).toBe(false);
  });

  it('abre como diálogo modal, com título e texto ligados ao diálogo', () => {
    mostrar(true);

    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialogo.open).toBe(true);
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(dialogo.querySelector('h3')?.textContent).toContain('Sua sessão foi encerrada');
    expect(dialogo.getAttribute('aria-describedby')).toBe('aviso-de-sessao-encerrada-texto');
  });

  it('diz que o que não foi gravado se perdeu e pede para entrar novamente', () => {
    mostrar(true);

    expect(texto()).toContain('O que você preencheu e ainda não gravou se perdeu.');
    expect(texto()).toContain('Entre novamente para continuar.');
  });

  it('leva o foco ao botão de entrar ao abrir', () => {
    mostrar(true);
    TestBed.tick();

    expect(document.activeElement).toBe(botao('Entrar novamente'));
  });

  it('emite entrar e dispensar pelos botões', () => {
    mostrar(true);
    const entrar = vi.fn();
    const dispensar = vi.fn();
    fixture.componentInstance.entrar.subscribe(entrar);
    fixture.componentInstance.dispensar.subscribe(dispensar);

    botao('Entrar novamente').click();
    botao('Agora não').click();

    expect(entrar).toHaveBeenCalledTimes(1);
    expect(dispensar).toHaveBeenCalledTimes(1);
  });

  it('não se fecha por Esc, para que a pessoa leia o aviso', () => {
    mostrar(true);
    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;

    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();

    expect(dialogo.open).toBe(true);
  });

  it('não tem violação de acessibilidade WCAG 2.1 AA', async () => {
    mostrar(true);

    const resultado = await axe.run(fixture.nativeElement, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      rules: { region: { enabled: false } },
    });

    expect(resultado.violations).toEqual([]);
  });
});
