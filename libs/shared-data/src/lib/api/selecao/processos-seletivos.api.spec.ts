import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
} from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import {
  CriarProcessoSeletivoCommand,
  DefinirOfertaAtendimentoRequest,
  ProcessoSeletivoDto,
  ProcessoSeletivoResumoDto,
  TipoProcessoSnapshotDto,
} from './processos-seletivos.contrato';
import { ProcessosSeletivosApi } from './processos-seletivos.api';
import { OrigemCandidatos, StatusProcesso } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';
const TIPO_ID = '01960000-0000-7000-0000-000000000516';

const tipoProcesso: TipoProcessoSnapshotDto = {
  origemId: TIPO_ID,
  codigo: 'SISU',
  nome: 'SiSU',
};

const resumoSeed: ProcessoSeletivoResumoDto = {
  id: ID,
  nome: 'Processo Seletivo 2027',
  tipoProcesso,
  status: StatusProcesso.rascunho,
  criadoEm: '2026-08-11T12:00:00Z',
};

const criarCommand: CriarProcessoSeletivoCommand = {
  nome: 'Processo Seletivo 2027',
  tipoProcessoOrigemId: TIPO_ID,
  origemCandidatos: OrigemCandidatos.inscricaoPropria,
  unidadeAdministradoraOrigemId: '01960000-0000-7000-000000000517',
  localidadeCodigoIbge: null,
  localidadeNome: null,
  localidadeUf: null,
  identificadorLegivel: null,
};

describe('ProcessosSeletivosApi', () => {
  let api: ProcessosSeletivosApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ProcessosSeletivosApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());
  it('listar() lê o snapshot de tipo retornado por Seleção', async () => {
    const promise = firstValueFrom(api.listar());
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos?limit=100`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('processo-seletivo', 1));
    req.flush([resumoSeed]);

    const result = (await promise) as ApiResult<readonly ProcessoSeletivoResumoDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data[0].tipoProcesso).toEqual(tipoProcesso);
  });
  it('obter() preserva o snapshot no detalhe sem consultar Configuração', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}`);

    expect(req.request.method).toBe('GET');
    req.flush({ ...resumoSeed } as ProcessoSeletivoDto);

    const result = (await promise) as ApiResult<ProcessoSeletivoDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.tipoProcesso.nome).toBe('SiSU');
  });
  it('criar() envia somente tipoProcessoOrigemId e preserva a Idempotency-Key', async () => {
    const promise = firstValueFrom(
      api.criar(criarCommand, withIdempotencyKey('processo-create-key')),
    );
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);

    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('processo-create-key');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.body).toEqual(criarCommand);
    expect(req.request.body).toHaveProperty('tipoProcessoOrigemId', TIPO_ID);
    expect(req.request.body).not.toHaveProperty('tipo');
    req.flush(ID, { status: 201, statusText: 'Created' });

    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });
  it('definirIdentificadorLegivel() envia o identificador pelo PUT do campo', async () => {
    const promise = firstValueFrom(
      api.definirIdentificadorLegivel(
        ID,
        { identificadorLegivel: 'medicina-2027' },
        withIdempotencyKey('chave-identificador'),
      ),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/identificador-legivel`,
    );

    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-identificador');
    expect(req.request.body).toEqual({ identificadorLegivel: 'medicina-2027' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });
  it('definirOfertaAtendimento() envia os ids dos cadastros de Configuração', async () => {
    const request: DefinirOfertaAtendimentoRequest = {
      condicaoIds: ['01960000-0000-7000-0000-000000000601'],
      recursoIds: ['01960000-0000-7000-0000-000000000602'],
      tipoDeficienciaIds: ['01960000-0000-7000-0000-000000000603'],
    };

    const promise = firstValueFrom(
      api.definirOfertaAtendimento(ID, request, withIdempotencyKey('chave-atendimento')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/oferta-atendimento`,
    );

    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-atendimento');
    expect(req.request.body).toEqual(request);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });
  it('definirOfertaAtendimento() propaga a recusa por tipo de deficiência sem condição PcD', async () => {
    const request: DefinirOfertaAtendimentoRequest = {
      condicaoIds: [],
      recursoIds: [],
      tipoDeficienciaIds: ['01960000-0000-7000-0000-000000000603'],
    };

    const promise = firstValueFrom(
      api.definirOfertaAtendimento(ID, request, withIdempotencyKey('chave-sem-pcd')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/oferta-atendimento`,
    );

    req.flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.selecao.oferta_atendimento.tipo_deficiencia_sem_condicao_pcd',
        title: 'Tipo de deficiência exige a condição PcD marcada',
        status: 422,
        code: 'uniplus.selecao.oferta_atendimento.tipo_deficiencia_sem_condicao_pcd',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const result = await promise;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) expect(result.problem.status).toBe(422);
  });
});
