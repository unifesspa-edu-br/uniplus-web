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
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import {
  CriarProcessoSeletivoCommand,
  DocumentoEditalDto,
  IniciarUploadDocumentoEditalDto,
  ProcessoSeletivoDto,
  ProcessoSeletivoResumoDto,
  ProcessosSeletivosApi,
  TipoProcessoSnapshotDto,
} from './processos-seletivos.api';
import { OrigemCandidatos } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';
const TIPO_ID = '01960000-0000-7000-0000-000000000516';
const DOCUMENTO_ID = '01960000-0000-7000-0000-000000000518';
const URL_ASSINADA =
  'http://localhost:9000/uniplus-selecao/editais/documento.pdf?X-Amz-Signature=abc';

const tipoProcesso: TipoProcessoSnapshotDto = {
  origemId: TIPO_ID,
  codigo: 'SISU',
  nome: 'SiSU',
};

const resumoSeed: ProcessoSeletivoResumoDto = {
  id: ID,
  nome: 'Processo Seletivo 2027',
  tipoProcesso,
  status: 'rascunho',
  criadoEm: '2026-08-11T12:00:00Z',
};

const iniciacaoSeed: IniciarUploadDocumentoEditalDto = {
  documentoEditalId: DOCUMENTO_ID,
  urlUpload: URL_ASSINADA,
  contentTypeExigido: 'application/pdf',
  expiraEm: '2026-08-13T12:15:00Z',
};

const documentoSeed: DocumentoEditalDto = {
  id: DOCUMENTO_ID,
  processoSeletivoId: ID,
  status: 'Confirmado',
  criadoEm: '2026-08-13T12:00:00Z',
  expiraEm: '2026-08-13T12:15:00Z',
  tamanhoBytes: 2048,
  hashSha256: 'a'.repeat(64),
  confirmadoEm: '2026-08-13T12:05:00Z',
};

const documentoPendenteSeed: DocumentoEditalDto = {
  id: '01960000-0000-7000-0000-000000000519',
  processoSeletivoId: ID,
  status: 'Pendente',
  criadoEm: '2026-08-13T12:10:00Z',
  expiraEm: '2026-08-13T12:25:00Z',
  tamanhoBytes: null,
  hashSha256: null,
  confirmadoEm: null,
};

const criarCommand: CriarProcessoSeletivoCommand = {
  nome: 'Processo Seletivo 2027',
  tipoProcessoOrigemId: TIPO_ID,
  origemCandidatos: OrigemCandidatos.inscricaoPropria,
  unidadeAdministradoraOrigemId: '01960000-0000-7000-000000000517',
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

  it('listarDocumentosEdital() lê a coleção do processo pelo vendor MIME do documento', async () => {
    const promise = firstValueFrom(api.listarDocumentosEdital(ID));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/documentos-edital`,
    );

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('documento-edital', 1));
    req.flush([documentoSeed, documentoPendenteSeed]);

    const result = (await promise) as ApiResult<readonly DocumentoEditalDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.map((documento) => documento.status)).toEqual(['Confirmado', 'Pendente']);
    }
  });

  /**
   * O id vai na rota; um valor com caractere reservado não pode escapar para o
   * path sem codificação.
   */
  it('listarDocumentosEdital() codifica o id na rota', async () => {
    const promise = firstValueFrom(api.listarDocumentosEdital('a/b'));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/a%2Fb/documentos-edital`,
    );

    req.flush([]);
    await promise;
  });

  it('listarDocumentosEdital() devolve a coleção vazia de um processo sem anexo', async () => {
    const promise = firstValueFrom(api.listarDocumentosEdital(ID));
    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/documentos-edital`)
      .flush([]);

    const result = (await promise) as ApiResult<readonly DocumentoEditalDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it('iniciarUploadDocumentoEdital() posta sem corpo e devolve a URL assinada', async () => {
    const promise = firstValueFrom(
      api.iniciarUploadDocumentoEdital(ID, withIdempotencyKey('documento-init-key')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/documentos-edital`,
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('Idempotency-Key')).toBe('documento-init-key');
    req.flush(iniciacaoSeed, { status: 201, statusText: 'Created' });

    const result = (await promise) as ApiResult<IniciarUploadDocumentoEditalDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.contentTypeExigido).toBe('application/pdf');
  });

  it('confirmarUploadDocumentoEdital() usa os dois ids na rota de confirmação', async () => {
    const promise = firstValueFrom(
      api.confirmarUploadDocumentoEdital(ID, DOCUMENTO_ID, withIdempotencyKey('documento-conf-key')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/documentos-edital/${DOCUMENTO_ID}/confirmacao`,
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('Idempotency-Key')).toBe('documento-conf-key');
    req.flush(documentoSeed);

    const result = (await promise) as ApiResult<DocumentoEditalDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.status).toBe('Confirmado');
  });

});
