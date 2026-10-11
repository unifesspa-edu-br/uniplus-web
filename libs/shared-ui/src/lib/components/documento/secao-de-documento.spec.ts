import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DadoDirective } from '../lista-de-dados/dado';
import { ListaDeDadosComponent } from '../lista-de-dados/lista-de-dados';
import { SecaoDeDocumentoComponent } from './secao-de-documento';

@Component({
  standalone: true,
  imports: [DadoDirective, ListaDeDadosComponent, SecaoDeDocumentoComponent],
  template: `
    <ui-secao-de-documento id="pares" titulo="Pares" [nivel]="3">
      <ui-lista-de-dados>
        @for (par of pares(); track $index) {
          <ng-template uiDado [rotulo]="par" [valor]="par"></ng-template>
        }
      </ui-lista-de-dados>
    </ui-secao-de-documento>
    <ui-secao-de-documento id="com-grupo" titulo="Com grupo" [nivel]="3">
      <ui-secao-de-documento titulo="Integrante 1" [nivel]="4">
        <ui-lista-de-dados>
          <ng-template uiDado rotulo="Renda" valor="1.200"></ng-template>
        </ui-lista-de-dados>
      </ui-secao-de-documento>
    </ui-secao-de-documento>
    <ui-secao-de-documento id="inteira" titulo="Inteira" largura="inteira" />
  `,
})
class SecoesDeTeste {
  readonly pares = signal(['A', 'B', 'C', 'D']);
}

describe('SecaoDeDocumentoComponent', () => {
  const inteira = (tela: HTMLElement, id: string): boolean =>
    tela.querySelector(`#${id}`)?.classList.contains('secao-de-documento--inteira') ?? false;

  it('a seção com até quatro dados e sem seção dentro é curta; com cinco, ocupa a linha inteira', () => {
    const fixture = TestBed.createComponent(SecoesDeTeste);
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;
    expect(inteira(tela, 'pares')).toBe(false);

    fixture.componentInstance.pares.set(['A', 'B', 'C', 'D', 'E']);
    fixture.detectChanges();

    expect(inteira(tela, 'pares')).toBe(true);
  });

  it('a seção com um grupo dentro ou com largura inteira ocupa a linha inteira', () => {
    const fixture = TestBed.createComponent(SecoesDeTeste);
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;

    expect(inteira(tela, 'com-grupo')).toBe(true);
    expect(inteira(tela, 'inteira')).toBe(true);
  });

  it('o título fica no nível pedido, e a seção de dentro um nível abaixo', () => {
    const fixture = TestBed.createComponent(SecoesDeTeste);
    fixture.detectChanges();
    const secao = (fixture.nativeElement as HTMLElement).querySelector('#com-grupo') as HTMLElement;

    expect(secao.querySelector('h3')?.textContent?.trim()).toBe('Com grupo');
    expect(secao.querySelector('h4')?.textContent?.trim()).toBe('Integrante 1');
  });
});
