import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import type { ApiResult, ProblemDetails } from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  StatusProcesso,
  type ProcessoSeletivoResumoDto,
} from '@uniplus/shared-data/selecao';
import { HttpHeaders } from '@angular/common/http';

import { DashboardPage } from './dashboard.page';

const LINKS = '</api?cursor=PROX&direction=next>; rel="next"';

function processo(overrides: Partial<ProcessoSeletivoResumoDto> = {}): ProcessoSeletivoResumoDto {
  return {
    id: 'processo-ficticio-1',
    nome: 'Processo Um',
    tipoProcesso: { origemId: 'tipo-ficticio', codigo: 'VESTIBULAR', nome: 'Vestibular' },
    status: StatusProcesso.rascunho,
    criadoEm: '2026-08-20T13:23:42.707136+00:00',
    ...overrides,
  };
}

describe('DashboardPage', () => {
  let resposta: Subject<ApiResult<readonly ProcessoSeletivoResumoDto[]>>;
  let chamadasListar: number;

  beforeEach(async () => {
    resposta = new Subject();
    chamadasListar = 0;
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        {
          provide: ProcessosSeletivosApi,
          useValue: {
            listar: () => {
              chamadasListar++;
              return resposta;
            },
          },
        },
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

  function entregar(
    fixture: ReturnType<typeof montar>,
    itens: readonly ProcessoSeletivoResumoDto[],
    link?: string,
  ): void {
    resposta.next({
      ok: true,
      data: itens,
      status: 200,
      headers: new HttpHeaders(link === undefined ? {} : { Link: link }),
    });
    fixture.detectChanges();
  }

  function falhar(fixture: ReturnType<typeof montar>, status: number, code: string): void {
    resposta.next({
      ok: false,
      status,
      problem: { type: 'about:blank', title: 't', status, code } as ProblemDetails,
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
    entregar(fixture, [processo({ id: 'p1', nome: 'Processo Um' })]);

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Processo Um');
    expect(host.textContent).toContain('Abrir acompanhamento');
  });

  it('abre /acompanhamento/processos/:id do processo escolhido', () => {
    const fixture = montar();
    entregar(fixture, [processo({ id: 'p1', nome: 'Processo Um' })]);
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

  it('mantém "Atualizar lista" em foco entre o clique e a resposta, e bloqueia o reenvio', () => {
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;
    entregar(fixture, [processo({ id: 'p1', nome: 'Processo Um' })], LINKS);

    host.querySelector<HTMLButtonElement>('button[data-pager="next"]')?.click();
    falhar(fixture, 410, 'uniplus.cursor.expirado');

    const botao = host.querySelector<HTMLButtonElement>('button[data-acao="atualizar-lista"]');
    expect(botao).not.toBeNull();
    expect(chamadasListar).toBe(2);

    botao?.focus();
    botao?.click();
    fixture.detectChanges();

    const durante = host.querySelector<HTMLButtonElement>('button[data-acao="atualizar-lista"]');
    expect(durante).toBe(botao);
    expect(document.activeElement).toBe(durante);
    expect(durante?.getAttribute('aria-disabled')).toBe('true');
    expect(chamadasListar).toBe(3);

    durante?.click();
    fixture.detectChanges();
    expect(chamadasListar).toBe(3);
    expect(host.querySelector('button[data-acao="atualizar-lista"]')).toBe(durante);

    entregar(fixture, [processo({ id: 'p2', nome: 'Processo Dois' })]);

    expect(host.querySelector('button[data-acao="atualizar-lista"]')).toBeNull();
    expect(host.textContent).toContain('Processo Dois');
  });

  it('não abre um cartão da página sendo substituída durante a troca de página (ADR-0026)', () => {
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;
    entregar(fixture, [processo({ id: 'p1', nome: 'Processo Um' })], LINKS);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    host.querySelector<HTMLButtonElement>('button[data-pager="next"]')?.click();
    fixture.detectChanges();

    host.querySelector<HTMLButtonElement>('button[aria-label^="Abrir acompanhamento"]')?.click();

    expect(navegar).not.toHaveBeenCalled();
  });
});
