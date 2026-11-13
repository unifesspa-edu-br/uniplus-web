import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import type { ApiResult } from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  type ProcessoSeletivoResumoDto,
} from '@uniplus/shared-data/selecao';
import { HttpHeaders } from '@angular/common/http';

import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  let resposta: Subject<ApiResult<readonly ProcessoSeletivoResumoDto[]>>;

  beforeEach(async () => {
    resposta = new Subject();
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        { provide: ProcessosSeletivosApi, useValue: { listar: () => resposta } },
        {
          provide: UserContextService,
          useValue: { isAuthenticated: signal(true), user: signal({ id: 'u1' }) },
        },
      ],
    }).compileComponents();
  });

  function montar() {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    return fixture;
  }

  function entregar(fixture: ReturnType<typeof montar>, itens: unknown[]): void {
    resposta.next({
      ok: true,
      data: itens as ProcessoSeletivoResumoDto[],
      status: 200,
      headers: new HttpHeaders(),
    });
    fixture.detectChanges();
  }

  it('sinaliza a espera em vez de lista vazia antes da resposta', () => {
    const host = montar().nativeElement as HTMLElement;
    expect(host.textContent).toContain('Carregando processos seletivos');
    expect(host.textContent).not.toContain('Nenhum processo seletivo encontrado');
  });

  it('apresenta os processos retornados com a ação Abrir acompanhamento', () => {
    const fixture = montar();
    entregar(fixture, [{ id: 'p1', nome: 'Processo Um' }]);

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Processo Um');
    expect(host.textContent).toContain('Abrir acompanhamento');
  });

  it('abre /acompanhamento/processos/:id do processo escolhido', () => {
    const fixture = montar();
    entregar(fixture, [{ id: 'p1', nome: 'Processo Um' }]);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label^="Abrir acompanhamento"]')
      ?.click();

    expect(navegar).toHaveBeenCalledWith(['/acompanhamento/processos', 'p1']);
  });

  it('sucesso sem itens apresenta a mensagem de vazio', () => {
    const fixture = montar();
    entregar(fixture, []);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Nenhum processo seletivo encontrado',
    );
  });
});
