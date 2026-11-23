import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import type { ApiResult } from '@uniplus/shared-core/http';
import { okResult } from '@uniplus/shared-testing';
import { ProcessosSeletivosApi, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { TrilhaContextual } from '../../../trilha-contextual';
import { AcompanhamentoDoProcessoPage } from './acompanhamento-do-processo.page';

const ID = '11111111-1111-4111-8111-111111111111';
const AVISO = 'Não há informações de acompanhamento disponíveis no momento';

describe('AcompanhamentoDoProcessoPage', () => {
  let resposta: Subject<ApiResult<ProcessoSeletivoDto>>;
  let configurar: ReturnType<typeof signal<boolean>>;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    resposta = new Subject();
    configurar = signal(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'acompanhamento/processos/:id', component: AcompanhamentoDoProcessoPage },
          { path: '', children: [] },
        ]),
        { provide: ProcessosSeletivosApi, useValue: { obter: () => resposta } },
        {
          provide: UserContextService,
          useValue: { isAuthenticated: () => true, user: () => ({ id: 'u1' }) },
        },
        {
          provide: PermissoesService,
          useValue: { estado: () => 'carregada', temAlguma: () => configurar() },
        },
      ],
    });
    harness = await RouterTestingHarness.create(`/acompanhamento/processos/${ID}`);
  });

  const texto = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';
  const trilha = () =>
    TestBed.inject(TrilhaContextual)
      .itens()
      ?.map((i) => i.label);

  it('carregando: sem aviso de ausência e com a trilha genérica', () => {
    expect(texto()).toContain('Carregando');
    expect(texto()).not.toContain(AVISO);
    expect(trilha()).toEqual(['Painel de processos', 'Acompanhamento']);
  });

  it('sucesso: nome, trilha completa, só a seção Acompanhamento e o aviso', async () => {
    resposta.next(
      okResult({ id: ID, nome: 'Vestibular', status: 'publicado' } as ProcessoSeletivoDto),
    );
    harness.detectChanges();
    expect(texto()).toContain('Vestibular');
    expect(texto()).toContain(AVISO);
    expect(harness.routeNativeElement?.querySelector('[role="tab"]')).toBeNull();
    expect(trilha()).toEqual(['Painel de processos', 'Vestibular', 'Acompanhamento']);
  });

  it('sem permissão de configurar não oferece atalhos', () => {
    resposta.next(okResult({ id: ID, nome: 'V', status: 'publicado' } as ProcessoSeletivoDto));
    harness.detectChanges();
    expect(texto()).not.toContain('Editar processo');
  });

  it('com a permissão, oferece os atalhos conforme o status', () => {
    configurar.set(true);
    resposta.next(okResult({ id: ID, nome: 'V', status: 'rascunho' } as ProcessoSeletivoDto));
    harness.detectChanges();
    expect(texto()).toContain('Editar processo');
    expect(texto()).not.toContain('Publicações');
  });

  it('limpa a trilha ao sair', async () => {
    await harness.navigateByUrl('/');
    expect(trilha()).toBeUndefined();
  });
});
