import { TestBed } from '@angular/core/testing';
import {
  HttpContext,
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiOk, apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CriarProcessoSeletivoCommand,
  FormulariosDoProcessoApi,
  OrigemCandidatos,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CadastroInicial } from './cadastro-inicial.service';
import { GravacaoDoProcesso } from './gravacao/gravacao-do-processo';

describe('CadastroInicial — descarte do cadastro em andamento', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const ROTA = 'http://localhost:5000/api/selecao/processos-seletivos';
  const PROCESSO_ID = '01960000-0000-7000-0000-000000000515';

  const comando = (nome: string): CriarProcessoSeletivoCommand => ({
    nome,
    tipoProcessoOrigemId: '01960000-0000-7000-0000-000000000001',
    origemCandidatos: OrigemCandidatos.inscricaoPropria,
    unidadeAdministradoraOrigemId: '01960000-0000-7000-0000-000000000002',
    localidadeCodigoIbge: null,
    localidadeNome: null,
    localidadeUf: null,
    identificadorLegivel: null,
  });

  it('envia o comando novo depois do descarte, com outra chave, e não o retido do processo anterior', async () => {
    TestBed.configureTestingModule({
      providers: [
        CadastroInicial,
        GravacaoDoProcesso,
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const servico = TestBed.inject(CadastroInicial);
    const http = TestBed.inject(HttpTestingController);

    const primeira = servico.criar(comando('Processo Seletivo A'));
    const requisicaoA = http.expectOne(ROTA);
    const chaveA = requisicaoA.request.headers.get('Idempotency-Key');
    requisicaoA.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await primeira;
    expect(servico.temCriacaoPendente()).toBe(true);

    servico.descartarCadastroEmAndamento();
    const segunda = servico.criar(comando('Processo Seletivo B'));
    const requisicaoB = http.expectOne(ROTA);

    expect(requisicaoB.request.body).toMatchObject({ nome: 'Processo Seletivo B' });
    expect(requisicaoB.request.headers.get('Idempotency-Key')).not.toBe(chaveA);
    requisicaoB.flush('01960000-0000-7000-0000-0000000005bb', {
      status: 201,
      statusText: 'Created',
    });
    await segunda;
  });

  it('entrega à API de remoção o mesmo contexto que a gravação montou para o pedido', async () => {
    TestBed.configureTestingModule({
      providers: [
        CadastroInicial,
        GravacaoDoProcesso,
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const servico = TestBed.inject(CadastroInicial);
    const gravacao = TestBed.inject(GravacaoDoProcesso);
    const api = TestBed.inject(FormulariosDoProcessoApi);
    const removerNaApi = vi
      .spyOn(api, 'removerFormulario')
      .mockReturnValue(of(apiOk(undefined, 204, new HttpHeaders())));
    let contextoDaGravacao: HttpContext | undefined;
    const remover = gravacao.remover.bind(gravacao);
    vi.spyOn(gravacao, 'remover').mockImplementation((enviar) =>
      remover((contexto) => {
        contextoDaGravacao = contexto;
        return enviar(contexto);
      }),
    );

    await servico.removerFormulario(PROCESSO_ID, 'INSCRICAO');

    expect(contextoDaGravacao).toBeDefined();
    expect(removerNaApi.mock.calls[0][2]).toBe(contextoDaGravacao);
  });
});
