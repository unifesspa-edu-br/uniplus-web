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
  ConformidadeLegalProcessoSeletivoDto,
  ConformidadeProcessoSeletivoDto,
  DadosDoAtoRequest,
  PublicarProcessoSeletivoRequest,
  SnapshotVigenteDto,
} from './processos-seletivos.contrato';
import { SELECAO_BASE_PATH } from './tokens';
import { PublicacaoDoProcessoApi } from './publicacao-do-processo.api';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';

describe('PublicacaoDoProcessoApi', () => {
  let api: PublicacaoDoProcessoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(PublicacaoDoProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());
  it('obterConformidade() lê o preflight estrutural com o vendor MIME do recurso', async () => {
    const conformidade: ConformidadeProcessoSeletivoDto = {
      processoSeletivoId: ID,
      itens: [
        { codigo: 'classificacao_ausente', dimensao: 'classificacao', mensagem: 'x', ok: false },
      ],
      avisos: [],
    };

    const promise = firstValueFrom(api.obterConformidade(ID));
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/conformidade`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('conformidade-processo-seletivo', 1),
    );
    req.flush(conformidade);

    const result = (await promise) as ApiResult<ConformidadeProcessoSeletivoDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.itens[0].ok).toBe(false);
  });
  it('obterConformidadeLegal() sem dataReferencia deixa o servidor decidir a referência', async () => {
    const conformidadeLegal: ConformidadeLegalProcessoSeletivoDto = {
      processoSeletivoId: ID,
      dataReferencia: '2027-03-01',
      regras: [],
      avisos: [],
    };

    const promise = firstValueFrom(api.obterConformidadeLegal(ID));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/conformidade-legal`,
    );

    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('dataReferencia')).toBe(false);
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('conformidade-legal-processo-seletivo', 1),
    );
    req.flush(conformidadeLegal);

    expect(isApiOk(await promise)).toBe(true);
  });
  it('obterConformidadeLegal() com dataReferencia envia a data de início da inscrição', async () => {
    const promise = firstValueFrom(api.obterConformidadeLegal(ID, '2027-03-01'));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/conformidade-legal?dataReferencia=2027-03-01`,
    );

    expect(req.request.params.get('dataReferencia')).toBe('2027-03-01');
    req.flush({
      processoSeletivoId: ID,
      dataReferencia: '2027-03-01',
      regras: [],
      avisos: [],
    } satisfies ConformidadeLegalProcessoSeletivoDto);

    expect(isApiOk(await promise)).toBe(true);
  });
  it('obterSnapshotVigente() lê o snapshot congelado com o vendor MIME do recurso', async () => {
    const snapshot: SnapshotVigenteDto = {
      snapshotPublicacaoId: '01960000-0000-7000-0000-000000000519',
      atoId: '01960000-0000-7000-0000-00000000051a',
      schemaVersion: '1',
      algoritmoHash: 'hash-algoritmo',
      hashConfiguracao: 'hash-configuracao',
      hashEdital: 'hash-edital',
      configuracao: { qualquerCoisa: true },
    };

    const promise = firstValueFrom(api.obterSnapshotVigente(ID));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/snapshot-vigente`,
    );

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('snapshot-vigente-processo-seletivo', 1),
    );
    req.flush(snapshot);

    const result = (await promise) as ApiResult<SnapshotVigenteDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.snapshotPublicacaoId).toBe(snapshot.snapshotPublicacaoId);
  });
  /**
   * O período de inscrição não é derivado aqui: quem chama decide `null` ou os
   * dois campos preenchidos antes de montar o corpo. O teste só afirma que o
   * cliente transporta o que recebeu, sem reescrever nenhum dos dois ramos.
   */
  it('publicar() transporta null nos dois campos de período quando o cronograma tem fase de coleta', async () => {
    const ato: DadosDoAtoRequest = {
      orgao: 'Reitoria',
      serie: '1',
      ano: 2027,
      dataPublicacao: '2027-01-15',
      assinante: 'Reitor',
      tipoAtoCodigo: 'PORTARIA',
    };
    const request: PublicarProcessoSeletivoRequest = {
      numero: '001/2027',
      periodoInscricaoInicio: null,
      periodoInscricaoFim: null,
      documentoEditalId: '01960000-0000-7000-0000-000000000518',
      ato,
    };

    const promise = firstValueFrom(
      api.publicar(ID, request, withIdempotencyKey('chave-publicacao')),
    );
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/publicacao`);

    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-publicacao');
    expect(req.request.body).toEqual(request);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });
  /**
   * A recusa por pendência chega tipada a quem chamou — `ApiResult.fail` com o
   * `ProblemDetails` do 422 — sem catch genérico que a esconda do chamador.
   */
  it('publicar() propaga o 422 de pendência como ApiResult.fail tipado', async () => {
    const ato: DadosDoAtoRequest = {
      orgao: 'Reitoria',
      serie: '1',
      ano: 2027,
      dataPublicacao: '2027-01-15',
      assinante: 'Reitor',
      tipoAtoCodigo: 'PORTARIA',
    };
    const request: PublicarProcessoSeletivoRequest = {
      numero: '001/2027',
      periodoInscricaoInicio: null,
      periodoInscricaoFim: null,
      documentoEditalId: '01960000-0000-7000-0000-000000000518',
      ato,
    };

    const promise = firstValueFrom(
      api.publicar(ID, request, withIdempotencyKey('chave-publicacao-pendente')),
    );
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/publicacao`);

    req.flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.selecao.processo_seletivo.conformidade_estrutural_insuficiente',
        title: 'O processo tem pendências estruturais',
        status: 422,
        code: 'uniplus.selecao.processo_seletivo.conformidade_estrutural_insuficiente',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        pendencias: ['classificacao_ausente'],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    const result = await promise;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) {
      expect(result.problem.status).toBe(422);
      expect(result.problem.code).toBe(
        'uniplus.selecao.processo_seletivo.conformidade_estrutural_insuficiente',
      );
    }
  });
});
