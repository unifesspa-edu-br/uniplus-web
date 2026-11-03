import { TestBed } from '@angular/core/testing';
import { ProblemI18nService, okResult } from '@uniplus/shared-core/http';
import { PublicacaoDoProcessoApi } from '@uniplus/shared-data/selecao';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../steps/processo-seletivo.store';
import { RascunhoDaPublicacao } from './rascunho-da-publicacao.service';

const PROCESSO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b030';

describe('RascunhoDaPublicacao', () => {
  let rascunho: RascunhoDaPublicacao;
  let store: ProcessoSeletivoStore;
  let resposta: Subject<unknown>;

  beforeEach(() => {
    resposta = new Subject();
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        RascunhoDaPublicacao,
        { provide: ProblemI18nService, useValue: { resolve: () => ({ title: 'Recusado' }) } },
        {
          provide: PublicacaoDoProcessoApi,
          useValue: { salvarRascunhoDaPublicacao: vi.fn(() => resposta) },
        },
      ],
    });
    store = TestBed.inject(ProcessoSeletivoStore);
    rascunho = TestBed.inject(RascunhoDaPublicacao);
    store.processoSeletivoId.set(PROCESSO_ID);
  });

  it('não escreve a resposta de uma gravação que chega depois da troca de processo', async () => {
    const gravacao = rascunho.salvar();

    rascunho.esquecer();
    resposta.next(okResult(undefined));
    resposta.complete();
    await gravacao;

    expect(rascunho.salvoEm()).toBeNull();
    expect(rascunho.pendente()).toBe(false);
  });

  it('não ocupa o botão do processo novo com a gravação do anterior', async () => {
    const gravacao = rascunho.salvar();
    expect(rascunho.salvando()).toBe(true);

    rascunho.esquecer();
    resposta.next(okResult(undefined));
    resposta.complete();
    await gravacao;

    expect(rascunho.salvando()).toBe(false);
  });
});
