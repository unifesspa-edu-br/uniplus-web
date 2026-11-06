import { ComponentFixture, TestBed } from '@angular/core/testing';
import { type ItemDaProtecaoDoCatalogoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProtecaoDoCatalogoListaComponent } from './protecao-do-catalogo-lista.component';
import { clicar, laudo } from './protecao-do-catalogo.testing';

describe('ProtecaoDoCatalogoListaComponent', () => {
  let fixture: ComponentFixture<ProtecaoDoCatalogoListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProtecaoDoCatalogoListaComponent] });
    fixture = TestBed.createComponent(ProtecaoDoCatalogoListaComponent);
  });

  function montar(
    itens: readonly ItemDaProtecaoDoCatalogoDto[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao = { itens, carregando: false, gravando: false, erroDeCarga: null };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const linha = (): HTMLButtonElement =>
    raiz().querySelector(
      `button[aria-label="Ver o detalhe de ${laudo.nome}"]`,
    ) as HTMLButtonElement;
  const titulo = (): HTMLElement => raiz().querySelector('#cfg-protecao-titulo') as HTMLElement;

  it('o nome da linha emite o item ao ser acionado', () => {
    montar([laudo]);
    const abertos: ItemDaProtecaoDoCatalogoDto[] = [];
    fixture.componentInstance.abrir.subscribe((item) => abertos.push(item));

    clicar(linha(), 'o nome da linha');

    expect(abertos).toEqual([laudo]);
  });

  it('sem itens, mostra o estado vazio só depois da carga e sem erro', () => {
    montar([], { carregando: true });
    expect(raiz().textContent).toContain('Carregando');
    expect(raiz().textContent).not.toContain('Nenhum item aguardando');

    fixture.componentRef.setInput('carregando', false);
    fixture.componentRef.setInput('erroDeCarga', 'Falhou');
    fixture.detectChanges();
    expect(raiz().textContent).not.toContain('Nenhum item aguardando');

    fixture.componentRef.setInput('erroDeCarga', null);
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Nenhum item aguardando a sua decisão');
  });

  describe('foco depois de uma decisão', () => {
    const concluirDecisao = async (
      itens: readonly ItemDaProtecaoDoCatalogoDto[],
    ): Promise<void> => {
      fixture.componentRef.setInput('gravando', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('itens', itens);
      fixture.componentRef.setInput('gravando', false);
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const abrirPeloNome = (): void => {
      linha().focus();
      linha().click();
      linha().blur();
    };

    beforeEach(() => document.body.appendChild(raiz()));
    afterEach(() => raiz().remove());

    it('leva o foco ao título quando o item decidido saiu da fila', async () => {
      montar([laudo]);
      abrirPeloNome();

      await concluirDecisao([]);

      expect(document.activeElement).toBe(titulo());
      expect(titulo().getAttribute('tabindex')).toBe('-1');
    });

    it('espera a recarga terminar para devolver o foco', async () => {
      montar([laudo]);
      abrirPeloNome();
      fixture.componentRef.setInput('gravando', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('carregando', true);
      fixture.componentRef.setInput('gravando', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(document.body);

      fixture.componentRef.setInput('carregando', false);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(titulo());
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar([laudo]);
      abrirPeloNome();
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();

      await concluirDecisao([]);

      expect(document.activeElement).toBe(outro);
      outro.remove();
    });

    it('não move o foco numa carga sem decisão', async () => {
      montar([laudo]);
      abrirPeloNome();
      fixture.componentRef.setInput('carregando', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('carregando', false);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(document.body);
    });
  });
});
