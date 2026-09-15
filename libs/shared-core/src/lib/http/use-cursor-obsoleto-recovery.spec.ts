import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { mockProblemDetails } from './api-result.testing';
import { createCursor } from './pagination';
import { ProblemDetails } from './problem-details';
import { CursorPagina, useCursorObsoletoRecovery } from './use-cursor-obsoleto-recovery';

const PAGINA_NAVEGADA: CursorPagina = { cursor: createCursor('p2'), direction: 'next' };

const cursorInvalido = mockProblemDetails({
  status: 400,
  code: 'uniplus.cursor.invalido',
  title: 'Cursor de paginação inválido',
});
const cursorExpirado = mockProblemDetails({
  status: 410,
  code: 'uniplus.cursor.expirado',
  title: 'Cursor de paginação expirado',
});

function setup() {
  TestBed.configureTestingModule({});
  const problem = signal<ProblemDetails | null>(null);
  const pagina = signal<CursorPagina | undefined>(undefined);
  const reiniciarPagina = vi.fn();
  const aoRecuperar = vi.fn();

  const recuperando = TestBed.runInInjectionContext(() =>
    useCursorObsoletoRecovery({ problem, pagina, reiniciarPagina, aoRecuperar }),
  );
  TestBed.tick();

  return {
    problem,
    pagina,
    reiniciarPagina,
    aoRecuperar,
    recuperando,
    tick: () => TestBed.tick(),
  };
}

describe('useCursorObsoletoRecovery', () => {
  it('na primeira página não recupera: sem reset e sem aviso', () => {
    const env = setup();

    env.problem.set(cursorInvalido);
    env.tick();

    expect(env.recuperando()).toBe(false);
    expect(env.reiniciarPagina).not.toHaveBeenCalled();
    expect(env.aoRecuperar).not.toHaveBeenCalled();
  });

  it('em página navegada reinicia a paginação e avisa uma única vez', () => {
    const env = setup();

    env.pagina.set(PAGINA_NAVEGADA);
    env.problem.set(cursorInvalido);
    env.tick();

    expect(env.recuperando()).toBe(true);
    expect(env.reiniciarPagina).toHaveBeenCalledOnce();
    expect(env.aoRecuperar).toHaveBeenCalledOnce();
  });

  it('reinicia a página antes de avisar o operador', () => {
    const env = setup();
    const ordem: string[] = [];
    env.reiniciarPagina.mockImplementation(() => ordem.push('reset'));
    env.aoRecuperar.mockImplementation(() => ordem.push('aviso'));

    env.pagina.set(PAGINA_NAVEGADA);
    env.problem.set(cursorInvalido);
    env.tick();

    expect(ordem).toEqual(['reset', 'aviso']);
  });

  it('entrega o ProblemDetails de um 400 ao callback', () => {
    const env = setup();

    env.pagina.set(PAGINA_NAVEGADA);
    env.problem.set(cursorInvalido);
    env.tick();

    expect(env.aoRecuperar).toHaveBeenCalledExactlyOnceWith(cursorInvalido);
  });

  it('entrega o ProblemDetails de um 410 ao callback — distinto do 400', () => {
    const env = setup();

    env.pagina.set(PAGINA_NAVEGADA);
    env.problem.set(cursorExpirado);
    env.tick();

    expect(env.aoRecuperar).toHaveBeenCalledExactlyOnceWith(cursorExpirado);
  });

  it('problem que não é de cursor (422/500) não dispara recuperação', () => {
    const env = setup();

    env.pagina.set(PAGINA_NAVEGADA);
    env.problem.set(mockProblemDetails({ status: 422, code: 'uniplus.validacao' }));
    env.tick();

    expect(env.recuperando()).toBe(false);
    expect(env.reiniciarPagina).not.toHaveBeenCalled();
    expect(env.aoRecuperar).not.toHaveBeenCalled();
  });
});
