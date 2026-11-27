import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PROBLEM_JSON,
  ROTA_MODELOS,
  usarPasso,
  type ContextoDoPasso,
} from './formulario-passo.testing';

describe('FormularioPassoComponent: consulta de apoio recusada', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let controller: ContextoDoPasso['controller'];
  let host: ContextoDoPasso['host'];
  let navegar: ReturnType<typeof vi.spyOn>;

  usarPasso((contexto) => {
    ({ fixture, store, controller, host } = contexto);
  });

  beforeEach(() => {
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  function recusarModelosPorFaltaDePermissao(): void {
    store.patchObjectSection('tipoProcesso', { codigo: 'REGULAR_UNIFICADO' });
    fixture.detectChanges();
    controller
      .expectOne((r) => r.url === ROTA_MODELOS)
      .flush(
        {
          type: 'about:blank',
          title: 'Acesso negado',
          status: 403,
          code: 'uniplus.auth.forbidden',
        },
        { status: 403, statusText: 'Forbidden', headers: PROBLEM_JSON },
      );
    fixture.detectChanges();
  }

  it('avisa que os modelos não carregaram, sem levar a pessoa à página de acesso negado', () => {
    recusarModelosPorFaltaDePermissao();

    expect(navegar).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Não foi possível carregar os modelos de formulário.');
  });

  it('mantém o que a pessoa já preencheu no processo', () => {
    const antes = store.draft().formulario;

    recusarModelosPorFaltaDePermissao();

    expect(store.draft().formulario).toEqual(antes);
  });
});
