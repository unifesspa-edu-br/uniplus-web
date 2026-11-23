import { situacaoDoProcesso } from './vocabularios.testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
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
  DefinirAtendimentoEspecializadoRequest,
  DefinirProvaPresencialRequest,
  ProcessoSeletivoDto,
  ProcessoSeletivoResumoDto,
  TipoProcessoSnapshotDto,
} from './processos-seletivos.contrato';
import { ProcessosSeletivosApi } from './processos-seletivos.api';
import { OrigemCandidatosCodigo } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';
const TIPO_ID = '01960000-0000-7000-0000-000000000516';

const tipoProcesso: TipoProcessoSnapshotDto = {
  origemId: TIPO_ID,
  codigo: 'SISU',
  nome: 'SiSU',
};

function responderAoPut(url: string, esperado: { chave: string; corpo: unknown }): void {
  const req = TestBed.inject(HttpTestingController).expectOne(url);
  expect(req.request.method).toBe('PUT');
  expect(req.request.headers.get('Idempotency-Key')).toBe(esperado.chave);
  expect(req.request.body).toEqual(esperado.corpo);
  req.flush(null, { status: 204, statusText: 'No Content' });
}

const resumoSeed: ProcessoSeletivoResumoDto = {
  id: ID,
  nome: 'Processo Seletivo 2027',
  tipoProcesso,
  situacao: situacaoDoProcesso,
  criadoEm: '2026-08-11T12:00:00Z',
};

const criarCommand: CriarProcessoSeletivoCommand = {
  nome: 'Processo Seletivo 2027',
  tipoProcessoOrigemId: TIPO_ID,
  origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
  unidadeAdministradoraOrigemId: '01960000-0000-7000-000000000517',
  localidadeCodigoIbge: null,
  localidadeNome: null,
  localidadeUf: null,
  identificadorLegivel: null,
};

const URL_DO_IDENTIFICADOR = `${BASE}/api/selecao/processos-seletivos/${ID}/identificador-legivel`;
const URL_DA_PROVA_PRESENCIAL = `${BASE}/api/selecao/processos-seletivos/${ID}/prova-presencial`;
const URL_DO_ATENDIMENTO = `${BASE}/api/selecao/processos-seletivos/${ID}/atendimento-especializado`;

const identificadorDefinido = { identificadorLegivel: 'medicina-2027' };

const provaPresencialDeclarada: DefinirProvaPresencialRequest = {
  temProvaPresencial: true,
  municipios: [{ codigoIbge: '1504208', uf: 'PA' }],
};

const atendimentoCompleto: DefinirAtendimentoEspecializadoRequest = {
  condicaoIds: ['01960000-0000-7000-0000-000000000601'],
  recursoIds: ['01960000-0000-7000-0000-000000000602'],
  tipoDeficienciaIds: ['01960000-0000-7000-0000-000000000603'],
};

const atendimentoSoComTipoDeficiencia: DefinirAtendimentoEspecializadoRequest = {
  condicaoIds: [],
  recursoIds: [],
  tipoDeficienciaIds: ['01960000-0000-7000-0000-000000000603'],
};

const PROBLEMA_SEM_CONDICAO_PCD = {
  type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.selecao.atendimento_especializado.tipo_deficiencia_sem_condicao_pcd',
  title: 'Tipo de deficiência exige a condição PcD marcada',
  status: 422,
  code: 'uniplus.selecao.atendimento_especializado.tipo_deficiencia_sem_condicao_pcd',
  traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
};

function conferirRequisicaoDeCriacao(req: TestRequest): void {
  expect(req.request.method).toBe('POST');
  expect(req.request.headers.get('Idempotency-Key')).toBe('processo-create-key');
  expect(req.request.headers.get('Accept')).toBe('application/json');
  expect(req.request.body).toEqual(criarCommand);
  expect(req.request.body).toHaveProperty('tipoProcessoOrigemId', TIPO_ID);
  expect(req.request.body).not.toHaveProperty('tipo');
}

function definirAtendimento(
  api: ProcessosSeletivosApi,
  request: DefinirAtendimentoEspecializadoRequest,
  chave: string,
): Promise<ApiResult<void>> {
  return firstValueFrom(
    api.definirAtendimentoEspecializado(ID, request, withIdempotencyKey(chave)),
  );
}

function recusarOAtendimentoSemCondicaoPcd(): void {
  const req = TestBed.inject(HttpTestingController).expectOne(URL_DO_ATENDIMENTO);
  req.flush(PROBLEMA_SEM_CONDICAO_PCD, { status: 422, statusText: 'Unprocessable Entity' });
}

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

    conferirRequisicaoDeCriacao(req);
    req.flush(ID, { status: 201, statusText: 'Created' });

    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });
  it('definirIdentificadorLegivel() envia o identificador pelo PUT do campo', async () => {
    const chave = 'chave-identificador';
    const promise = firstValueFrom(
      api.definirIdentificadorLegivel(ID, identificadorDefinido, withIdempotencyKey(chave)),
    );

    responderAoPut(URL_DO_IDENTIFICADOR, { chave, corpo: identificadorDefinido });

    expect(isApiOk(await promise)).toBe(true);
  });
  it('definirProvaPresencial() envia a declaração completa e preserva a Idempotency-Key', async () => {
    const chave = 'chave-prova';
    const promise = firstValueFrom(
      api.definirProvaPresencial(ID, provaPresencialDeclarada, withIdempotencyKey(chave)),
    );

    responderAoPut(URL_DA_PROVA_PRESENCIAL, { chave, corpo: provaPresencialDeclarada });

    expect(isApiOk(await promise)).toBe(true);
  });
  it('definirAtendimentoEspecializado() envia os ids dos cadastros de Configuração', async () => {
    const chave = 'chave-atendimento';
    const promise = definirAtendimento(api, atendimentoCompleto, chave);

    responderAoPut(URL_DO_ATENDIMENTO, { chave, corpo: atendimentoCompleto });

    expect(isApiOk(await promise)).toBe(true);
  });
  it('definirAtendimentoEspecializado() propaga a recusa por tipo de deficiência sem condição PcD', async () => {
    const promise = definirAtendimento(api, atendimentoSoComTipoDeficiencia, 'chave-sem-pcd');

    recusarOAtendimentoSemCondicaoPcd();

    const result = await promise;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) expect(result.problem.status).toBe(422);
  });
});
