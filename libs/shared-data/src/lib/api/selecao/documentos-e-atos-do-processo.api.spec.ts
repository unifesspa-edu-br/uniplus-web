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
  AtoDoProcessoDto,
  DocumentoAPublicarDto,
  IniciarEnvioDoDocumentoAPublicarDto,
} from './processos-seletivos.contrato';
import { FinalidadeDoDocumento } from './schema';
import { SELECAO_BASE_PATH } from './tokens';
import { DocumentosEAtosDoProcessoApi } from './documentos-e-atos-do-processo.api';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';
const TIPO_ID = '01960000-0000-7000-0000-000000000516';
const DOCUMENTO_ID = '01960000-0000-7000-0000-000000000518';

const URL_ASSINADA =
  'http://localhost:9000/uniplus-selecao/editais/documento.pdf?X-Amz-Signature=abc';

const iniciacaoSeed: IniciarEnvioDoDocumentoAPublicarDto = {
  documentoAPublicarId: DOCUMENTO_ID,
  urlUpload: URL_ASSINADA,
  contentTypeExigido: 'application/pdf',
  expiraEm: '2026-08-13T12:15:00Z',
};

const documentoSeed: DocumentoAPublicarDto = {
  id: DOCUMENTO_ID,
  processoSeletivoId: ID,
  finalidade: FinalidadeDoDocumento.documentoDoEdital,
  nomeArquivo: 'edital.pdf',
  tipoDeMidia: 'application/pdf',
  status: 'Confirmado',
  criadoEm: '2026-08-13T12:00:00Z',
  expiraEm: '2026-08-13T12:15:00Z',
  tamanhoBytes: 2048,
  hashSha256: 'a'.repeat(64),
  confirmadoEm: '2026-08-13T12:05:00Z',
};

const documentoPendenteSeed: DocumentoAPublicarDto = {
  id: '01960000-0000-7000-0000-000000000519',
  processoSeletivoId: ID,
  finalidade: FinalidadeDoDocumento.documentoDoEdital,
  nomeArquivo: 'edital.pdf',
  tipoDeMidia: 'application/pdf',
  status: 'Pendente',
  criadoEm: '2026-08-13T12:10:00Z',
  expiraEm: '2026-08-13T12:25:00Z',
  tamanhoBytes: null,
  hashSha256: null,
  confirmadoEm: null,
};

describe('DocumentosEAtosDoProcessoApi', () => {
  let api: DocumentosEAtosDoProcessoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(DocumentosEAtosDoProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());
  it('listarDocumentosAPublicar() lê a coleção do processo pelo vendor MIME do documento', async () => {
    const promise = firstValueFrom(api.listarDocumentosAPublicar(ID));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/documentos-a-publicar`,
    );

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('documento-a-publicar', 1),
    );
    req.flush([documentoSeed, documentoPendenteSeed]);

    const result = (await promise) as ApiResult<readonly DocumentoAPublicarDto[]>;
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
  it('listarDocumentosAPublicar() codifica o id na rota', async () => {
    const promise = firstValueFrom(api.listarDocumentosAPublicar('a/b'));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/a%2Fb/documentos-a-publicar`,
    );

    req.flush([]);
    await promise;
  });
  it('listarDocumentosAPublicar() devolve a coleção vazia de um processo sem anexo', async () => {
    const promise = firstValueFrom(api.listarDocumentosAPublicar(ID));
    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/documentos-a-publicar`)
      .flush([]);

    const result = (await promise) as ApiResult<readonly DocumentoAPublicarDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });
  it('listarDocumentosAPublicar() filtra a coleção pela finalidade pedida', async () => {
    const promise = firstValueFrom(
      api.listarDocumentosAPublicar(ID, FinalidadeDoDocumento.documentoDoEdital),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/documentos-a-publicar?finalidade=documentoDoEdital`,
    );

    req.flush([documentoSeed]);
    await promise;
  });
  it('listarAtosDoProcesso() lê os atos do processo pelo vendor MIME do ato', async () => {
    const promise = firstValueFrom(api.listarAtosDoProcesso(ID));
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/atos`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('ato-do-processo', 1));
    req.flush([]);

    const result = (await promise) as ApiResult<readonly AtoDoProcessoDto[]>;
    expect(isApiOk(result)).toBe(true);
  });
  it('publicarAtoAvulso() posta o ato com a chave de idempotência e devolve o ato aceito', async () => {
    const request = {
      tipoAtoCodigo: 'ERRATA',
      numero: '02/2026',
      dataPublicacao: '2026-10-19',
      assinante: 'Pró-reitoria de Ensino',
      documentoPrincipalId: DOCUMENTO_ID,
      anexos: [{ documentoId: TIPO_ID, nome: 'Planilha' }],
      atoCorrigidoId: ID,
      motivoDaCorrecao: 'Corrige a data de abertura.',
    };
    const promise = firstValueFrom(
      api.publicarAtoAvulso(ID, request, withIdempotencyKey('ato-avulso-key')),
    );
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/atos`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(req.request.headers.get('Idempotency-Key')).toBe('ato-avulso-key');
    req.flush({ atoId: TIPO_ID }, { status: 202, statusText: 'Accepted' });

    const result = await promise;
    expect(isApiOk(result)).toBe(true);
  });
  it('obterProdutosPrevistos() lê os itens do edital pelo vendor MIME dos produtos previstos', async () => {
    const promise = firstValueFrom(api.obterProdutosPrevistos(ID));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/produtos-previstos`,
    );

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('produtos-previstos-do-processo', 1),
    );
    req.flush({
      numeroDaVersao: 1,
      politicaDeDivulgacao: { camposPublicos: ['numero_inscricao'], justificativa: null },
      fases: [],
      etapasSemFase: [],
    });

    expect(isApiOk(await promise)).toBe(true);
  });
  it('publicarProdutoPrevisto() posta no item, com a chave de idempotência, e devolve o ato aceito', async () => {
    const request = {
      numero: '01/2026',
      dataPublicacao: '2026-10-19',
      assinante: 'Pró-reitoria de Ensino',
      documentoPrincipalId: DOCUMENTO_ID,
      politicaDeDivulgacaoConfirmada: true,
    };
    const promise = firstValueFrom(
      api.publicarProdutoPrevisto(ID, TIPO_ID, request, withIdempotencyKey('produto-key')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/produtos-previstos/${TIPO_ID}/publicacoes`,
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(req.request.headers.get('Idempotency-Key')).toBe('produto-key');
    req.flush({ atoId: ID }, { status: 202, statusText: 'Accepted' });

    expect(isApiOk(await promise)).toBe(true);
  });
  it('listarCamposDivulgacao() lê o vocabulário dos campos da política pelo vendor MIME', async () => {
    const promise = firstValueFrom(api.listarCamposDivulgacao());
    const req = controller.expectOne(`${BASE}/api/selecao/campos-divulgacao`);

    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('campo-divulgacao', 1));
    req.flush([]);

    expect(isApiOk(await promise)).toBe(true);
  });
  it('iniciarEnvioDocumentoAPublicar() posta finalidade, nome e tipo de mídia e devolve a URL assinada', async () => {
    const request = {
      finalidade: FinalidadeDoDocumento.documentoDoEdital,
      nomeArquivo: 'edital.pdf',
      tipoDeMidia: 'application/pdf',
    };
    const promise = firstValueFrom(
      api.iniciarEnvioDocumentoAPublicar(ID, request, withIdempotencyKey('documento-init-key')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/documentos-a-publicar`,
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(req.request.headers.get('Idempotency-Key')).toBe('documento-init-key');
    req.flush(iniciacaoSeed, { status: 201, statusText: 'Created' });

    const result = (await promise) as ApiResult<IniciarEnvioDoDocumentoAPublicarDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.contentTypeExigido).toBe('application/pdf');
  });
  it('confirmarEnvioDocumentoAPublicar() usa os dois ids na rota de confirmação', async () => {
    const promise = firstValueFrom(
      api.confirmarEnvioDocumentoAPublicar(
        ID,
        DOCUMENTO_ID,
        withIdempotencyKey('documento-conf-key'),
      ),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/documentos-a-publicar/${DOCUMENTO_ID}/confirmacao`,
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('Idempotency-Key')).toBe('documento-conf-key');
    req.flush(documentoSeed);

    const result = (await promise) as ApiResult<DocumentoAPublicarDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.status).toBe('Confirmado');
  });
});
