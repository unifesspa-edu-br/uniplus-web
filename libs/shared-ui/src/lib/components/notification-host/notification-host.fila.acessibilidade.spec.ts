import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProblemDetails } from '@uniplus/shared-core/http';

import { type HostMontado, achar, montarHost } from './notification-host.testing';

function problema(indice: number): ProblemDetails {
  return {
    type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/exemplo',
    title: `Erro número ${indice}`,
    status: 422,
    detail: 'Confira os dados informados.',
    code: `uniplus.selecao.exemplo_${'abcd'[indice - 1]}`,
    traceId: `${indice}af7651916cd43dd8448eb211c80319c`,
  };
}

describe('NotificationHostComponent: acessibilidade da fila', () => {
  let host: HostMontado;

  afterEach(() => {
    host.raiz.remove();
    TestBed.resetTestingModule();
  });

  it('não tem violações com 4 erros fixos, a lista aberta e os identificadores anteriores', async () => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      configurable: true,
    });
    host = montarHost(true);
    [1, 2, 3, 4].forEach((i) => host.service.errorFromProblem(problema(i)));
    host.service.errorFromProblem({
      ...problema(4),
      traceId: `9${'af7651916cd43dd8448eb211c80319c'}`,
    });
    host.fixture.detectChanges();
    achar<HTMLButtonElement>(host.raiz, '.toast-mais').click();
    host.fixture.detectChanges();
    host.raiz.querySelectorAll('details').forEach((d) => (d.open = true));

    const resultado = await axe.run(host.raiz, { rules: { region: { enabled: false } } });

    expect(resultado.violations).toEqual([]);
  });
});
