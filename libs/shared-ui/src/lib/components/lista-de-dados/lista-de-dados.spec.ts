import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DadoDirective } from './dado';
import { ListaDeDadosComponent } from './lista-de-dados';

@Component({
  standalone: true,
  imports: [DadoDirective, ListaDeDadosComponent],
  template: `
    <ui-lista-de-dados>
      <ng-template uiDado rotulo="Bolsista" [valor]="true"></ng-template>
      <ng-template uiDado rotulo="Observação" [valor]="null"></ng-template>
      <ng-template uiDado rotulo="Situação"><strong>É o que vale</strong></ng-template>
    </ui-lista-de-dados>
  `,
})
class ListaDeTeste {}

function montar(): HTMLElement {
  const fixture = TestBed.createComponent(ListaDeTeste);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ListaDeDadosComponent e DadoDirective', () => {
  it('o dl só contém pares div > dt + dd, como a lista de descrição exige', () => {
    const dl = montar().querySelector('dl') as HTMLDListElement;

    expect([...dl.children].map((filho) => filho.tagName)).toEqual(['DIV', 'DIV', 'DIV']);
    for (const par of dl.children) {
      expect([...par.children].map((filho) => filho.tagName)).toEqual(['DT', 'DD']);
    }
  });

  it('com valor, apresenta-o; sem valor, mostra o conteúdo projetado', () => {
    const valores = [...montar().querySelectorAll('dd')].map((dd) => dd.textContent?.trim());

    expect(valores).toEqual(['Sim', 'Não informado', 'É o que vale']);
  });
});
