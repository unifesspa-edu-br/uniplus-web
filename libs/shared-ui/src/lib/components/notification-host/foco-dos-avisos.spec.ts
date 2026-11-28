import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { destinoDoControle, devolverFoco } from './foco-dos-avisos';

function montar(): HTMLElement {
  const raiz = document.createElement('div');
  raiz.innerHTML = `
    <section>
      <button class="toast-mais">Mais 1 aviso</button>
      <div class="toast-region">
        <ui-aviso data-aviso-id="7"><button class="toast__close">x</button></ui-aviso>
        <ui-aviso data-aviso-id="9"><button class="toast__close">x</button></ui-aviso>
      </div>
    </section>`;
  document.body.append(raiz);
  return raiz;
}

describe('foco dos avisos', () => {
  let raiz: HTMLElement;
  const fechar = (id: number): HTMLElement =>
    raiz.querySelector<HTMLElement>(`[data-aviso-id="${id}"] .toast__close`) as HTMLElement;

  beforeEach(() => {
    raiz = montar();
  });

  afterEach(() => {
    raiz.remove();
  });

  it('descreve o controle focado dentro da pilha e ignora o de fora', () => {
    expect(destinoDoControle(raiz, fechar(7))).toEqual({ tipo: 'aviso', id: 7 });
    expect(destinoDoControle(raiz, raiz.querySelector('.toast-mais'))).toEqual({
      tipo: 'mais-avisos',
    });
    expect(destinoDoControle(raiz, document.body)).toBeNull();
  });

  it('devolve o foco ao Fechar do mesmo aviso quando ele ainda existe', () => {
    devolverFoco(raiz, document, { tipo: 'aviso', id: 7 });
    expect(document.activeElement).toBe(fechar(7));
  });

  it('vai ao "Mais N" quando o aviso deixou de ter botão', () => {
    devolverFoco(raiz, document, { tipo: 'aviso', id: 3 });
    expect(document.activeElement).toBe(raiz.querySelector('.toast-mais'));
  });

  it('vai ao Fechar do aviso mais novo à vista quando não há "Mais N"', () => {
    raiz.querySelector('.toast-mais')?.remove();
    devolverFoco(raiz, document, { tipo: 'aviso', id: 3 });
    expect(document.activeElement).toBe(fechar(9));
  });

  it('leva o foco ao conteúdo principal quando não sobra aviso nem "Mais N"', () => {
    const principal = document.createElement('main');
    document.body.append(principal);
    raiz.querySelector('.toast-mais')?.remove();
    raiz.querySelectorAll('[data-aviso-id]').forEach((aviso) => aviso.remove());
    devolverFoco(raiz, document, { tipo: 'aviso', id: 7 });
    expect(document.activeElement).toBe(principal);
    expect(principal.getAttribute('tabindex')).toBe('-1');
    principal.remove();
  });

  it('não dá erro quando não há aviso, "Mais N" nem conteúdo principal', () => {
    raiz.querySelector('.toast-mais')?.remove();
    raiz.querySelectorAll('[data-aviso-id]').forEach((aviso) => aviso.remove());
    expect(() => devolverFoco(raiz, document, { tipo: 'aviso', id: 7 })).not.toThrow();
  });

  it('não move o foco que está fora da pilha nem sem registro anterior', () => {
    const campo = document.createElement('input');
    document.body.append(campo);
    campo.focus();
    devolverFoco(raiz, document, { tipo: 'aviso', id: 7 });
    expect(document.activeElement).toBe(campo);
    campo.blur();
    devolverFoco(raiz, document, null);
    expect(document.activeElement).toBe(document.body);
    campo.remove();
  });
});
