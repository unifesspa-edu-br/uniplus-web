import { ApplicationRef } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { StepsResponsivoComponent } from './steps-responsivo.component';

describe('StepsResponsivoComponent', () => {
  const montar = (): { fixture: ComponentFixture<StepsResponsivoComponent>; tela: HTMLElement } => {
    const fixture = TestBed.createComponent(StepsResponsivoComponent);
    fixture.componentRef.setInput('items', [
      { rotulo: 'Curso', status: 'active' },
      { rotulo: 'Dados', status: 'unvisited' },
    ]);
    fixture.componentRef.setInput('rotuloDaNavegacao', 'Seções do formulário');
    fixture.componentRef.setInput('titulo', 'Curso');
    fixture.componentRef.setInput('meta', 'Seção 1 de 2');
    fixture.detectChanges();
    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialogo.showModal = vi.fn();
    dialogo.close = vi.fn(() => dialogo.dispatchEvent(new Event('close')));
    return { fixture, tela: fixture.nativeElement as HTMLElement };
  };

  it('abre com o foco no botão de fechar e devolve o foco à barra ao fechar', async () => {
    const { fixture, tela } = montar();
    document.body.append(tela);

    fixture.componentInstance.abrir();
    await Promise.resolve();
    expect(document.activeElement).toBe(tela.querySelector('.steps-overlay__close'));

    fixture.componentInstance.fechar();
    await Promise.resolve();
    expect(document.activeElement).toBe(tela.querySelector('.step-bar'));
    tela.remove();
  });

  it('escolher na lista em diálogo fecha sem tirar o foco de quem consome', async () => {
    const { fixture, tela } = montar();
    document.body.append(tela);
    const escolhidos: number[] = [];
    fixture.componentInstance.selecionado.subscribe((i) => escolhidos.push(i));
    fixture.componentInstance.abrir();

    tela.querySelectorAll<HTMLButtonElement>('dialog li button')[1].click();
    await Promise.resolve();

    expect(escolhidos).toEqual([1]);
    expect(fixture.componentInstance.aberto()).toBe(false);
    expect(document.activeElement).not.toBe(tela.querySelector('.step-bar'));
    tela.remove();
  });

  it('trava a rolagem do documento enquanto a lista está aberta e a libera ao fechar ou destruir', () => {
    const { fixture } = montar();

    fixture.componentInstance.abrir();
    fixture.detectChanges();
    expect(document.body.classList.contains('ui-overlay-open')).toBe(true);

    fixture.componentInstance.fechar();
    fixture.detectChanges();
    expect(document.body.classList.contains('ui-overlay-open')).toBe(false);

    fixture.componentInstance.abrir();
    fixture.detectChanges();
    fixture.destroy();
    expect(document.body.classList.contains('ui-overlay-open')).toBe(false);
  });

  it('reserva a altura da barra no scroll-padding do contêiner que rola, e a devolve ao destruir', () => {
    class RO {
      constructor(private aoMedir: () => void) {}
      observe(): void {
        this.aoMedir();
      }
      disconnect(): void {
        this.aoMedir = () => undefined;
      }
    }
    vi.stubGlobal('ResizeObserver', RO);
    const area = document.createElement('div');
    area.style.overflowY = 'auto';
    document.body.append(area);
    const fixture = TestBed.createComponent(StepsResponsivoComponent);
    area.append(fixture.nativeElement);
    fixture.componentRef.setInput('items', [{ rotulo: 'Curso', status: 'active' }]);
    fixture.componentRef.setInput('rotuloDaNavegacao', 'Passos');
    fixture.componentRef.setInput('titulo', 'Curso');
    fixture.componentRef.setInput('meta', 'Passo 1 de 1');
    const barra = fixture.nativeElement.querySelector('.step-bar') as HTMLElement;
    Object.defineProperty(barra, 'offsetHeight', { value: 56 });

    fixture.detectChanges();
    expect(area.style.scrollPaddingTop).toBe('56px');
    expect(area.style.getPropertyValue('--ui-steps-area-altura')).not.toBe('');

    fixture.destroy();
    expect(area.style.scrollPaddingTop).toBe('');
    expect(area.style.getPropertyValue('--ui-steps-area-altura')).toBe('');
    area.remove();
    vi.unstubAllGlobals();
  });

  it('devolve o foco à barra quando ninguém o leva a outro lugar depois da escolha na lista', async () => {
    const { fixture, tela } = montar();
    document.body.append(tela);
    fixture.componentInstance.abrir();
    await Promise.resolve();
    // O diálogo fechado leva o foco do botão clicado; quem consome não o move para outro lugar.
    fixture.componentInstance.selecionado.subscribe(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );

    tela.querySelectorAll<HTMLButtonElement>('dialog li button')[1].click();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();

    expect(document.activeElement).toBe(tela.querySelector('.step-bar'));
    tela.remove();
  });

  it('avisa quando o passo atual é escolhido de novo na lista em diálogo', () => {
    const { fixture, tela } = montar();
    const atuais: number[] = [];
    fixture.componentInstance.atualEscolhido.subscribe((i) => atuais.push(i));
    fixture.componentInstance.abrir();

    tela.querySelectorAll<HTMLButtonElement>('dialog li button')[0].click();

    expect(atuais).toEqual([0]);
  });
});
