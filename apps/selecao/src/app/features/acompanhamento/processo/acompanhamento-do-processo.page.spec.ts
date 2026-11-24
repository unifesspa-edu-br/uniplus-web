import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { TrilhaContextual } from '../../../trilha-contextual';
import { AcompanhamentoDoProcessoPage } from './acompanhamento-do-processo.page';

const ID = '11111111-1111-4111-8111-111111111111';
const AVISO = 'Não há informações de acompanhamento disponíveis no momento';

describe('AcompanhamentoDoProcessoPage', () => {
  let http: HttpTestingController;
  let configurar: ReturnType<typeof signal<boolean>>;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    configurar = signal(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'acompanhamento/processos/:id', component: AcompanhamentoDoProcessoPage },
          { path: '', children: [] },
        ]),
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: '' },
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
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(`/acompanhamento/processos/${ID}`);
  });

  const responder = async (nome: string, status: string) => {
    TestBed.tick();
    http
      .expectOne(`/api/selecao/processos-seletivos/${ID}`)
      .flush({ id: ID, nome, situacao: { codigo: status.toUpperCase(), rotulo: status } });
    await Promise.resolve();
    harness.detectChanges();
  };
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
    await responder('Vestibular', 'publicado');
    expect(texto()).toContain('Vestibular');
    expect(texto()).toContain(AVISO);
    expect(harness.routeNativeElement?.querySelector('[role="tab"]')).toBeNull();
    expect(trilha()).toEqual(['Painel de processos', 'Vestibular', 'Acompanhamento']);
  });

  it('o primeiro item da trilha leva ao painel e os demais não têm ação', async () => {
    await responder('Vestibular', 'publicado');
    const itens = TestBed.inject(TrilhaContextual).itens() ?? [];
    expect(itens.map((item) => item.routerLink)).toEqual(['/dashboard', undefined, undefined]);
  });

  it('sem permissão de configurar não oferece atalhos', async () => {
    await responder('V', 'publicado');
    expect(texto()).not.toContain('Editar processo');
  });

  it('com a permissão, oferece os atalhos conforme o status', async () => {
    configurar.set(true);
    await responder('V', 'rascunho');
    expect(texto()).toContain('Editar processo');
    expect(texto()).not.toContain('Publicações');
  });

  it('limpa a trilha ao sair', async () => {
    await harness.navigateByUrl('/');
    expect(trilha()).toBeUndefined();
  });
});
