import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@uniplus/shared-core/notifications';

import { AvisoComponent } from './aviso';

const ATUAL = '0af7651916cd43dd8448eb211c80319c';
const ANTERIOR = '1bf7651916cd43dd8448eb211c80319d';

function aviso(parcial: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    type: 'error',
    title: 'Não foi possível gravar',
    detail: 'Confira os dados informados.',
    persistent: true,
    ocorrencias: 1,
    identificadoresAnteriores: [],
    referencia: {
      origem: 'servidor',
      codigoDoErro: 'uniplus.selecao.exemplo',
      identificadorDoPedido: ATUAL,
    },
    ...parcial,
  };
}

describe('AvisoComponent', () => {
  let fixture: ComponentFixture<AvisoComponent>;
  let raiz: HTMLElement;

  function mostrar(parcial: Partial<Notification> = {}): void {
    fixture = TestBed.createComponent(AvisoComponent);
    fixture.componentRef.setInput('aviso', aviso(parcial));
    fixture.detectChanges();
    raiz = fixture.nativeElement;
  }

  const texto = (testId: string): string | undefined =>
    raiz.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    TestBed.configureTestingModule({ imports: [AvisoComponent] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('mostra título, detalhe e o bloco da referência mais recente', () => {
    mostrar();
    expect(texto('notification-host-title')).toBe('Não foi possível gravar');
    expect(texto('notification-host-detail')).toBe('Confira os dados informados.');
    expect(texto('notification-host-referencia')).toContain(ATUAL);
  });

  it('não mostra a contagem com uma ocorrência', () => {
    mostrar();
    expect(raiz.querySelector('[data-testid="notification-host-contagem"]')).toBeNull();
  });

  it('mostra "Ocorreu N vezes" quando há repetição', () => {
    mostrar({ ocorrencias: 4 });
    expect(texto('notification-host-contagem')).toBe('Ocorreu 4 vezes');
  });

  it('não tem papel nem aria-live em nenhum elemento', () => {
    mostrar({ identificadoresAnteriores: [ANTERIOR] });
    const comPapel = [...raiz.querySelectorAll('[role], [aria-live]')].filter(
      (elemento) =>
        !elemento.closest('ui-referencia-ao-suporte') &&
        !elemento.classList.contains('toast__anteriores-lista'),
    );
    expect(comPapel).toEqual([]);
  });

  it('não mostra a seção de identificadores anteriores quando não há', () => {
    mostrar();
    expect(raiz.querySelector('details')).toBeNull();
  });

  it('lista os identificadores anteriores com o mesmo código do erro e botão Copiar', () => {
    mostrar({ identificadoresAnteriores: [ANTERIOR, 'cc'.repeat(16)] });
    expect(raiz.querySelector('summary')?.textContent?.trim()).toBe(
      'Identificadores anteriores (2)',
    );
    const blocos = raiz.querySelectorAll('details ui-referencia-ao-suporte');
    expect(blocos).toHaveLength(2);
    expect(blocos[0].textContent).toContain(ANTERIOR);
    expect(blocos[0].textContent).toContain('uniplus.selecao.exemplo');
    expect(blocos[0].querySelector('button')?.textContent?.trim()).toBe('Copiar');
  });

  it('limita a lista de anteriores a uma região rolável por teclado', () => {
    mostrar({ identificadoresAnteriores: [ANTERIOR] });
    const lista = raiz.querySelector('details .toast__anteriores-lista');
    expect(lista?.getAttribute('role')).toBe('region');
    expect(lista?.getAttribute('tabindex')).toBe('0');
    expect(lista?.getAttribute('aria-label')).toBe('Identificadores anteriores');
    expect(lista?.querySelectorAll('ui-referencia-ao-suporte')).toHaveLength(1);
  });

  it('copia o identificador anterior', async () => {
    mostrar({ identificadoresAnteriores: [ANTERIOR] });
    raiz.querySelector<HTMLButtonElement>('details button')?.click();
    await fixture.whenStable();
    const escrito = vi.mocked(window.navigator.clipboard.writeText).mock.calls[0][0];
    expect(escrito).toContain(ANTERIOR);
  });

  it('emite fechar pelo botão com rótulo acessível', () => {
    mostrar();
    const aoFechar = vi.fn();
    fixture.componentInstance.fechar.subscribe(aoFechar);
    const botao = raiz.querySelector<HTMLButtonElement>('button.toast__close');
    expect(botao?.getAttribute('aria-label')).toBe('Fechar notificação');
    expect(botao?.type).toBe('button');
    botao?.click();
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
