import { ComponentFixture, TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AvisoDeSessaoPertoDeVencerComponent,
  descreverTempoRestante,
} from './aviso-de-sessao-perto-de-vencer';

describe('descreverTempoRestante', () => {
  it.each([
    [0, 'menos de 1 minuto'],
    [59, 'menos de 1 minuto'],
    [60, '1 minuto'],
    [119, '1 minuto'],
    [120, '2 minutos'],
  ])('%i segundos viram "%s"', (segundos, texto) => {
    expect(descreverTempoRestante(segundos)).toBe(texto);
  });
});

describe('AvisoDeSessaoPertoDeVencerComponent', () => {
  let fixture: ComponentFixture<AvisoDeSessaoPertoDeVencerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AvisoDeSessaoPertoDeVencerComponent] });
    fixture = TestBed.createComponent(AvisoDeSessaoPertoDeVencerComponent);
    document.body.appendChild(fixture.nativeElement);
  });

  function mostrar(podeContinuar: boolean, restante = 120): void {
    fixture.componentRef.setInput('aberto', true);
    fixture.componentRef.setInput('restanteEmSegundos', restante);
    fixture.componentRef.setInput('podeContinuar', podeContinuar);
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function botao(rotulo: string): HTMLButtonElement {
    const botoes = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    return botoes.find((item) => item.textContent?.trim() === rotulo) as HTMLButtonElement;
  }

  it('abre como diálogo modal, com título e texto ligados ao diálogo', () => {
    mostrar(true);

    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialogo.open).toBe(true);
    expect(dialogo.querySelector('h3')?.textContent).toContain('Sua sessão está perto de acabar');
    expect(dialogo.getAttribute('aria-describedby')).toBe('aviso-de-sessao-perto-de-vencer-texto');
  });

  it('diz em quanto tempo a sessão acaba, em região anunciada pelo leitor de tela', () => {
    mostrar(true, 120);

    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent).toContain('A sessão acaba em 2 minutos.');
  });

  it('oferece continuar quando pedir mais tempo ainda adianta', () => {
    mostrar(true);

    expect(botao('Continuar')).toBeTruthy();
    expect(botao('Entrar de novo agora')).toBeUndefined();
  });

  it('explica que não dá para estender e oferece entrar de novo', () => {
    mostrar(false);

    expect(texto()).toContain('Não é possível estender o tempo.');
    expect(botao('Entrar de novo agora')).toBeTruthy();
    expect(botao('Continuar')).toBeUndefined();
  });

  it('diz, antes do clique, que entrar de novo encerra a sessão nas outras páginas do Uni+', () => {
    mostrar(false);

    const efeito = document.getElementById(
      botao('Entrar de novo agora').getAttribute('aria-describedby') ?? '',
    );
    expect(efeito?.textContent).toContain('encerra a sessão em todas as páginas do Uni+');
    expect(efeito?.textContent).toContain('você volta a esta página');
  });

  it('leva o foco à ação principal ao abrir', () => {
    mostrar(true);
    TestBed.tick();

    expect(document.activeElement).toBe(botao('Continuar'));
  });

  it('leva o foco à nova ação principal quando só resta entrar de novo', () => {
    mostrar(true);
    TestBed.tick();

    mostrar(false);
    TestBed.tick();

    expect(document.activeElement).toBe(botao('Entrar de novo agora'));
  });

  it('emite continuar, entrar e dispensar pelos botões', () => {
    const continuar = vi.fn();
    const entrar = vi.fn();
    const dispensar = vi.fn();
    fixture.componentInstance.continuar.subscribe(continuar);
    fixture.componentInstance.entrar.subscribe(entrar);
    fixture.componentInstance.dispensar.subscribe(dispensar);

    mostrar(true);
    botao('Continuar').click();
    botao('Agora não').click();
    mostrar(false);
    botao('Entrar de novo agora').click();

    expect([continuar, entrar, dispensar].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('não tem violação de acessibilidade', async () => {
    mostrar(true);

    const resultado = await axe.run(fixture.nativeElement);

    expect(resultado.violations).toEqual([]);
  });
});
