import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { TrilhaContextual } from '../../../trilha-contextual';
import { AcompanhamentoDoProcessoPage } from './acompanhamento-do-processo.page';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const AVISO = 'Não há informações de acompanhamento disponíveis no momento';

describe('AcompanhamentoDoProcessoPage — estados', () => {
  let http: HttpTestingController;
  let estadoDasPermissoes: ReturnType<typeof signal<string>>;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    estadoDasPermissoes = signal('carregada');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'acompanhamento/processos/:id', component: AcompanhamentoDoProcessoPage },
          { path: 'dashboard', children: [] },
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
          useValue: { estado: () => estadoDasPermissoes(), temAlguma: () => true },
        },
      ],
    });
  });

  const abrir = async (id: string) => {
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(`/acompanhamento/processos/${id}`);
  };
  const responder = async (id: string, nome: string, status = 200) => {
    TestBed.tick();
    http.expectOne(`/api/selecao/processos-seletivos/${id}`).flush(
      status === 200
        ? {
            id,
            nome,
            situacao: {
              codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
              rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
            },
          }
        : {},
      {
        status,
        statusText: status === 200 ? 'OK' : 'Erro',
      },
    );
    await Promise.resolve();
    harness.detectChanges();
  };
  const texto = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';
  const trilha = () =>
    TestBed.inject(TrilhaContextual)
      .itens()
      ?.map((i) => i.label);

  it('404 mostra não encontrado, com retorno ao painel e sem o aviso de ausência', async () => {
    await abrir(ID_A);
    await responder(ID_A, '', 404);
    expect(texto()).toContain('Processo seletivo não encontrado');
    expect(texto()).toContain('Voltar ao painel');
    expect(texto()).not.toContain(AVISO);
    expect(trilha()).toEqual(['Painel de processos', 'Acompanhamento']);
  });

  it('identificador malformado não consulta e mostra não encontrado', async () => {
    await abrir('nao-e-uuid');
    http.expectNone(() => true);
    expect(texto()).toContain('Processo seletivo não encontrado');
    expect(trilha()).toEqual(['Painel de processos', 'Acompanhamento']);
  });

  it('401 não é apresentado como ausência de informações nem como não encontrado', async () => {
    await abrir(ID_A);
    await responder(ID_A, '', 401);
    expect(texto()).not.toContain(AVISO);
    expect(texto()).not.toContain('Processo seletivo não encontrado');
    expect(trilha()).toEqual(['Painel de processos', 'Acompanhamento']);
  });

  it('403 não mantém os dados do processo anterior', async () => {
    await abrir(ID_A);
    await responder(ID_A, 'Processo anterior');
    await harness.navigateByUrl(`/acompanhamento/processos/${ID_B}`);
    await responder(ID_B, '', 403);
    expect(texto()).not.toContain('Processo anterior');
    expect(texto()).not.toContain('Editar processo');
    expect(texto()).not.toContain(AVISO);
    expect(texto()).toContain('Acesso negado');
    expect(texto()).not.toContain('Tentar novamente');
    expect(trilha()).toEqual(['Painel de processos', 'Acompanhamento']);
  });

  it('Voltar ao painel navega para o painel', async () => {
    await abrir(ID_A);
    await responder(ID_A, '', 404);
    const link = Array.from((harness.routeNativeElement as HTMLElement).querySelectorAll('a')).find(
      (a) => a.textContent?.includes('Voltar ao painel'),
    );
    expect(link?.getAttribute('href')).toBe('/dashboard');
    link?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('falha oferece nova tentativa que consulta de novo e não mostra o aviso de ausência', async () => {
    await abrir(ID_A);
    await responder(ID_A, '', 500);
    expect(texto()).toContain('Não foi possível carregar o processo seletivo');
    expect(texto()).not.toContain(AVISO);
    expect(trilha()).toEqual(['Painel de processos', 'Acompanhamento']);
    const botao = (harness.routeNativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.list-state__retry button',
    );
    botao?.click();
    harness.detectChanges();
    await responder(ID_A, 'Vestibular');
    expect(texto()).toContain(AVISO);
  });

  it('trocar o id na rota limpa nome, trilha e atalhos e ignora a resposta tardia do anterior', async () => {
    await abrir(ID_A);
    await responder(ID_A, 'Processo A');
    expect(texto()).toContain('Editar processo');

    await harness.navigateByUrl(`/acompanhamento/processos/${ID_B}`);
    expect(texto()).not.toContain('Processo A');
    expect(texto()).not.toContain('Editar processo');
    expect(trilha()).toEqual(['Painel de processos', 'Acompanhamento']);

    await responder(ID_B, 'Processo B');
    expect(texto()).toContain('Processo B');
    expect(trilha()).toEqual(['Painel de processos', 'Processo B', 'Acompanhamento']);
  });

  it.each(['pendente', 'carregando', 'indisponivel'])(
    'com as permissões em estado %s nenhum atalho é oferecido',
    async (estado) => {
      estadoDasPermissoes.set(estado);
      await abrir(ID_A);
      await responder(ID_A, 'Vestibular');
      expect(texto()).toContain('Vestibular');
      expect(texto()).not.toContain('Editar processo');
      expect(texto()).not.toContain('Publicações');
    },
  );
});
