import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModalidadesListaComponent } from './modalidades-lista.component';

describe('ModalidadesListaComponent', () => {
  let fixture: ComponentFixture<ModalidadesListaComponent>;
  let raiz: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModalidadesListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(ModalidadesListaComponent);
    raiz = fixture.nativeElement as HTMLElement;
  });

  function montar(total: number, temFiltro: boolean, removendo: boolean): void {
    const entradas: Record<string, unknown> = {
      total,
      loading: false,
      errorMessage: null,
      temFiltroAtivo: temFiltro,
      temAnterior: true,
      temProximo: true,
      removendo,
      emRemocao: removendo,
    };
    for (const [nome, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  }

  const botao = (texto: string): HTMLButtonElement | undefined =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(texto),
    );

  it('com remoção em curso, a paginação fica indisponível', () => {
    montar(3, false, true);
    const paginacao = [...raiz.querySelectorAll('ui-pager button')];
    expect(paginacao).toHaveLength(2);
    expect(paginacao.every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
  });

  it('com remoção em curso, "Limpar filtros" do estado vazio fica desabilitado', () => {
    montar(0, true, true);
    expect(botao('Limpar filtros')?.disabled).toBe(true);
  });

  it('sem remoção, os acionadores de limpar e de paginação respondem', () => {
    montar(0, true, false);
    const pedidos: string[] = [];
    fixture.componentInstance.limpar.subscribe(() => pedidos.push('limpar'));
    fixture.componentInstance.proximo.subscribe(() => pedidos.push('proximo'));
    botao('Limpar filtros')?.click();
    botao('Próximo')?.click();
    expect(pedidos).toEqual(['limpar', 'proximo']);
  });

  describe('foco depois da remoção no diálogo', () => {
    beforeEach(() => document.body.appendChild(raiz));
    afterEach(() => raiz.remove());

    async function removerNoDialogo(): Promise<void> {
      montar(3, false, true);
      fixture.componentRef.setInput('removendo', false);
      fixture.componentRef.setInput('emRemocao', false);
      fixture.detectChanges();
      await fixture.whenStable();
    }

    it('leva o foco ao título da lista quando ninguém o tomou', async () => {
      await removerNoDialogo();
      expect(document.activeElement).toBe(raiz.querySelector('#cfg-modalidades-title'));
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar(3, false, true);
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();
      fixture.componentRef.setInput('removendo', false);
      fixture.componentRef.setInput('emRemocao', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(outro);
      outro.remove();
    });
  });
});
