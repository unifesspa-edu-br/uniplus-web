import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { PedidoResumoDto } from '@uniplus/shared-data/autorizacao';
import { beforeEach, describe, expect, it } from 'vitest';
import { PedidosListaComponent } from './pedidos-lista.component';
import { pedido } from './testes';

describe('PedidosListaComponent', () => {
  let fixture: ComponentFixture<PedidosListaComponent>;
  let abertos: PedidoResumoDto[];
  const linha = (): HTMLElement =>
    (fixture.nativeElement as HTMLElement).querySelector('tbody tr') as HTMLElement;

  function entradas(carregando: boolean, aguardaAceiteDoTermo = false): void {
    fixture.componentRef.setInput('pedidos', [{ ...pedido(), aguardaAceiteDoTermo }]);
    fixture.componentRef.setInput('nomesDosEscopos', new Map([['unidade-1', 'CEPS']]));
    fixture.componentRef.setInput('carregando', carregando);
    fixture.componentRef.setInput('erro', null);
    fixture.componentRef.setInput('situacao', '');
    fixture.componentRef.setInput('titulo', 'Pedidos');
    fixture.componentRef.setInput('vazio', 'Nenhum pedido.');
    fixture.componentRef.setInput('filtraPorSituacao', false);
    fixture.componentRef.setInput('origem', null);
    fixture.componentRef.setInput('temAnterior', false);
    fixture.componentRef.setInput('temProximo', false);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(PedidosListaComponent);
    abertos = [];
    fixture.componentInstance.abrir.subscribe((item) => abertos.push(item));
  });

  it('a linha abre o pedido pelo clique e por Enter ou Espaço nela', () => {
    entradas(false);

    linha().click();
    linha().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    linha().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(abertos).toHaveLength(3);
  });

  it('Enter num elemento de dentro da linha não abre o pedido', () => {
    entradas(false);

    linha()
      .querySelector('td')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(abertos).toEqual([]);
  });

  it('com a lista carregando, a linha não abre nada nem recebe foco', () => {
    entradas(true);

    linha().click();

    expect(abertos).toEqual([]);
    expect(linha().getAttribute('tabindex')).toBeNull();
  });

  it('sinaliza o pedido que aguarda o aceite do termo de responsabilidade', () => {
    entradas(false, true);
    expect(linha().textContent).toContain('Aguarda o aceite do termo');

    entradas(false, false);
    expect(linha().textContent).not.toContain('Aguarda o aceite do termo');
  });
});
