import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, isApiOk } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { DefinirCascataRemanejamentoRequest } from './processos-seletivos.contrato';
import { SELECAO_BASE_PATH } from './tokens';
import { VagasDoProcessoApi } from './vagas-do-processo.api';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';

describe('VagasDoProcessoApi', () => {
  let api: VagasDoProcessoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(VagasDoProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());
  /**
   * A tela não compõe a matriz: envia o que a regra do catálogo já congelou.
   * O teste afirma o corpo exato — fallback e destinos — para provar que o
   * cliente não reordena nem reformata o que o chamador montou.
   */
  it('definirCascataRemanejamento() envia a matriz congelada pela regra', async () => {
    const request: DefinirCascataRemanejamentoRequest = {
      regraCodigo: 'REMANEJ-CASCATA-LEI-12711',
      regraVersao: 'v1',
      fallbackCodigo: 'AC_ESCOLA_PUBLICA_RENDA_ATE_1_5',
      destinos: [
        {
          modalidadeOrigemCodigo: 'AC_ESCOLA_PUBLICA_PPI_RENDA_ATE_1_5',
          ordem: 1,
          modalidadeDestinoCodigo: 'AC_ESCOLA_PUBLICA_RENDA_ATE_1_5',
        },
      ],
    };

    const promise = firstValueFrom(
      api.definirCascataRemanejamento(ID, request, withIdempotencyKey('chave-cascata')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/cascata-remanejamento`,
    );

    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-cascata');
    expect(req.request.body).toEqual(request);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });
  it('definirCascataRemanejamento() propaga a matriz divergente da regra sem lançar', async () => {
    const request: DefinirCascataRemanejamentoRequest = {
      regraCodigo: 'REMANEJ-CASCATA-LEI-12711',
      regraVersao: 'v1',
      fallbackCodigo: 'CODIGO_INVENTADO',
      destinos: [],
    };

    const promise = firstValueFrom(
      api.definirCascataRemanejamento(ID, request, withIdempotencyKey('chave-cascata-invalida')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/cascata-remanejamento`,
    );

    req.flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.selecao.configuracao_cascata_remanejamento.matriz_divergente_da_regra',
        title: 'A matriz enviada diverge do esquema congelado pela regra',
        status: 422,
        code: 'uniplus.selecao.configuracao_cascata_remanejamento.matriz_divergente_da_regra',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const result = await promise;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) expect(result.problem.status).toBe(422);
  });
});
