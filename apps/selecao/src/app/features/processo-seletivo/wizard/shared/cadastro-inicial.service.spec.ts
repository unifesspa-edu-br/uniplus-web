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
  OrigemCandidatosCodigo,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CadastroInicial } from './cadastro-inicial.service';
import { GravacaoDoProcesso } from './gravacao/gravacao-do-processo';

describe('CadastroInicial — descarte do cadastro em andamento', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const ROTA = 'http://localhost:5000/api/selecao/processos-seletivos';
  const PROCESSO_ID = '01960000-0000-7000-0000-000000000515';

  const comando = (nome: string): CriarProcessoSeletivoCommand => ({
    nome,
    tipoProcessoOrigemId: '01960000-0000-7000-0000-000000000001',
    origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
    unidadeAdministradoraOrigemId: '01960000-0000-7000-0000-000000000002',
    localidadeCodigoIbge: null,
    localidadeNome: null,
    localidadeUf: null,
    identificadorLegivel: null,
  });

  const CRIADO = { status: 201, statusText: 'Created' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CadastroInicial,
        GravacaoDoProcesso,
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  async function deixarCriacaoPendente(
    servico: CadastroInicial,
    http: HttpTestingController,
  ): Promise<string | null> {
    const primeira = servico.criar(comando('Processo Seletivo A'));
    const requisicao = http.expectOne(ROTA);
    const chave = requisicao.request.headers.get('Idempotency-Key');
    requisicao.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await primeira;
    return chave;
  }

  function espionarRemocaoNaApi() {
    const api = TestBed.inject(FormulariosDoProcessoApi);
    return vi
      .spyOn(api, 'removerFormulario')
      .mockReturnValue(of(apiOk(undefined, 204, new HttpHeaders())));
  }

  function capturarContextoDaGravacao(): { contexto: () => HttpContext | undefined } {
    const gravacao = TestBed.inject(GravacaoDoProcesso);
    let contextoDaGravacao: HttpContext | undefined;
    const remover = gravacao.remover.bind(gravacao);
    vi.spyOn(gravacao, 'remover').mockImplementation((enviar) =>
      remover((contexto) => {
        contextoDaGravacao = contexto;
        return enviar(contexto);
      }),
    );
    return { contexto: () => contextoDaGravacao };
  }

  it('envia o comando novo depois do descarte, com outra chave, e não o retido do processo anterior', async () => {
    const servico = TestBed.inject(CadastroInicial);
    const http = TestBed.inject(HttpTestingController);
    const chaveA = await deixarCriacaoPendente(servico, http);
    expect(servico.temCriacaoPendente()).toBe(true);

    servico.descartarCadastroEmAndamento();
    const segunda = servico.criar(comando('Processo Seletivo B'));
    const requisicaoB = http.expectOne(ROTA);

    expect(requisicaoB.request.body).toMatchObject({ nome: 'Processo Seletivo B' });
    expect(requisicaoB.request.headers.get('Idempotency-Key')).not.toBe(chaveA);
    requisicaoB.flush('01960000-0000-7000-0000-0000000005bb', CRIADO);
    await segunda;
  });

  it('entrega à API de remoção o mesmo contexto que a gravação montou para o pedido', async () => {
    const servico = TestBed.inject(CadastroInicial);
    const removerNaApi = espionarRemocaoNaApi();
    const gravado = capturarContextoDaGravacao();

    await servico.removerFormulario(PROCESSO_ID, 'INSCRICAO');

    expect(gravado.contexto()).toBeDefined();
    expect(removerNaApi.mock.calls[0][2]).toBe(gravado.contexto());
  });

  it('envia a declaração de prova presencial com chave de substituição', async () => {
    const pedido = { temProvaPresencial: false, municipios: [] };
    const resultado = TestBed.inject(CadastroInicial).definirProvaPresencial(PROCESSO_ID, pedido);
    const requisicao = TestBed.inject(HttpTestingController).expectOne(
      `${ROTA}/${PROCESSO_ID}/prova-presencial`,
    );
    expect(requisicao.request.method).toBe('PUT');
    expect(requisicao.request.body).toEqual(pedido);
    expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    expect((await resultado).ok).toBe(true);
  });
});
