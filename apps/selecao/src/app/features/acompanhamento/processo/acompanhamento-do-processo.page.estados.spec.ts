import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import type { ApiResult } from '@uniplus/shared-core/http';
import { errorResult, mockProblemDetails, okResult } from '@uniplus/shared-testing';
import { ProcessosSeletivosApi, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { TrilhaContextual } from '../../../trilha-contextual';
import { AcompanhamentoDoProcessoPage } from './acompanhamento-do-processo.page';

type Resposta = ApiResult<ProcessoSeletivoDto>;

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const AVISO = 'Não há informações de acompanhamento disponíveis no momento';

const processo = (id: string, nome: string, status = 'publicado') =>
  okResult({ id, nome, status } as ProcessoSeletivoDto);
const falha = (status: number): Resposta => errorResult(mockProblemDetails({ status }));

describe('AcompanhamentoDoProcessoPage — estados', () => {
  let chamadas: { id: string; resposta: Subject<Resposta> }[];
  let estadoDasPermissoes: ReturnType<typeof signal<string>>;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    chamadas = [];
    estadoDasPermissoes = signal('carregada');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'acompanhamento/processos/:id', component: AcompanhamentoDoProcessoPage },
        ]),
        {
          provide: ProcessosSeletivosApi,
          useValue: {
            obter: (id: string) => {
              const resposta = new Subject<Resposta>();
              chamadas.push({ id, resposta });
              return resposta;
            },
          },
        },
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
    harness = await RouterTestingHarness.create(`/acompanhamento/processos/${id}`);
  };
  const responder = (indice: number, r: Resposta) => {
    chamadas[indice].resposta.next(r);
    harness.detectChanges();
  };
  const texto = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';
  const trilha = () =>
    TestBed.inject(TrilhaContextual)
      .itens()
      ?.map((i) => i.label);

  it('404 mostra não encontrado, com retorno ao painel e sem o aviso de ausência', async () => {
    await abrir(ID_A);
    responder(0, falha(404));
    expect(texto()).toContain('Processo seletivo não encontrado');
    expect(texto()).toContain('Voltar ao painel');
    expect(texto()).not.toContain(AVISO);
  });

  it('identificador malformado não consulta e mostra não encontrado', async () => {
    await abrir('nao-e-uuid');
    expect(chamadas).toHaveLength(0);
    expect(texto()).toContain('Processo seletivo não encontrado');
  });

  it('401 não é apresentado como ausência de informações nem como não encontrado', async () => {
    await abrir(ID_A);
    responder(0, falha(401));
    expect(texto()).not.toContain(AVISO);
    expect(texto()).not.toContain('Processo seletivo não encontrado');
  });

  it('403 mostra acesso negado, sem dados nem atalhos', async () => {
    await abrir(ID_A);
    responder(0, falha(403));
    expect(texto()).toContain('Acesso negado');
    expect(texto()).not.toContain('Editar processo');
    expect(texto()).not.toContain(AVISO);
  });

  it('falha oferece nova tentativa que consulta de novo e não mostra o aviso de ausência', async () => {
    await abrir(ID_A);
    responder(0, falha(500));
    expect(texto()).toContain('Não foi possível carregar o processo seletivo');
    expect(texto()).not.toContain(AVISO);
    const botao = (harness.routeNativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.list-state__retry button',
    );
    botao?.click();
    harness.detectChanges();
    expect(chamadas.map((c) => c.id)).toEqual([ID_A, ID_A]);
    responder(1, processo(ID_A, 'Vestibular'));
    expect(texto()).toContain(AVISO);
  });

  it('trocar o id na rota limpa nome, trilha e atalhos e ignora a resposta tardia do anterior', async () => {
    await abrir(ID_A);
    responder(0, processo(ID_A, 'Processo A'));
    expect(texto()).toContain('Editar processo');

    await harness.navigateByUrl(`/acompanhamento/processos/${ID_B}`);
    expect(texto()).not.toContain('Processo A');
    expect(texto()).not.toContain('Editar processo');
    expect(trilha()).toEqual(['Painel de processos', 'Acompanhamento']);

    responder(0, processo(ID_A, 'Processo A'));
    expect(texto()).not.toContain('Processo A');
    responder(1, processo(ID_B, 'Processo B'));
    expect(texto()).toContain('Processo B');
    expect(trilha()).toEqual(['Painel de processos', 'Processo B', 'Acompanhamento']);
  });

  it.each(['pendente', 'carregando', 'indisponivel'])(
    'com as permissões em estado %s nenhum atalho é oferecido',
    async (estado) => {
      estadoDasPermissoes.set(estado);
      await abrir(ID_A);
      responder(0, processo(ID_A, 'Vestibular'));
      expect(texto()).toContain('Vestibular');
      expect(texto()).not.toContain('Editar processo');
      expect(texto()).not.toContain('Publicações');
    },
  );
});
