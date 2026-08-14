import * as fs from 'node:fs';
import * as path from 'node:path';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import {
  CalendarioDiasUteisApi,
  CriarCalendarioDiasUteisCommand,
  DiaNaoUtilCommandItem,
  DiaNaoUtilDto,
} from './calendario-dias-uteis.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const CALENDARIO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';

/**
 * Âncoras de contrato: os literais abaixo são tipados pelos aliases do
 * `schema.ts` gerado. Se o snapshot municipal (ADR-0090) sair do contrato ou
 * deixar de ser obrigatório, o `typecheck` quebra aqui — é o gate contra um DTO
 * manual divergir do OpenAPI committed.
 */
const itemMunicipal: DiaNaoUtilCommandItem = {
  abrangencia: 'MUNICIPAL',
  municipioIbge: '1504208',
  municipioNome: 'Marabá',
  municipioUf: 'PA',
  uf: null,
  data: '2026-04-05',
  descricao: 'Aniversário de Marabá',
};

const diaMunicipal: DiaNaoUtilDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b100',
  ...itemMunicipal,
};

const comandoValido: CriarCalendarioDiasUteisCommand = {
  versaoDataset: '2026.1',
  diasNaoUteis: [itemMunicipal],
};

describe('CalendarioDiasUteisApi', () => {
  let api: CalendarioDiasUteisApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(CalendarioDiasUteisApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('deriva o item e o DTO do contrato que exige o snapshot municipal', () => {
    const baseline = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../../../openapi/configuracao.openapi.json'),
        'utf8',
      ),
    ) as {
      components: { schemas: Record<string, { required?: readonly string[] }> };
    };

    // O `codegen-api-check` garante que o `schema.ts` bate com este baseline; o
    // que falta é alguém cobrar que o contrato continue exigindo os três campos
    // que a tela envia. Sem isso, uma regressão do backend viraria 422 em runtime.
    for (const nome of ['DiaNaoUtilCommandItem', 'DiaNaoUtilDto'] as const) {
      expect(baseline.components.schemas[nome].required).toEqual(
        expect.arrayContaining(['municipioIbge', 'municipioNome', 'municipioUf']),
      );
    }

    expect(Object.keys(itemMunicipal)).toEqual(
      expect.arrayContaining(['municipioIbge', 'municipioNome', 'municipioUf']),
    );
  });

  it('obter() faz GET com Accept versionado e devolve o snapshot do dia municipal', async () => {
    const promise = firstValueFrom(api.obter(CALENDARIO_ID));

    const req = controller.expectOne(
      `${BASE}/api/configuracao/calendarios-dias-uteis/${CALENDARIO_ID}`,
    );
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('calendario-dias-uteis', 1),
    );
    req.flush({
      id: CALENDARIO_ID,
      versaoDataset: '2026.1',
      vigente: true,
      criadoEm: '2026-08-13T00:00:00Z',
      diasNaoUteis: [diaMunicipal],
    });

    const result = await promise;
    expect(isApiOk(result)).toBe(true);
    if (isApiOk(result)) {
      expect(result.data.diasNaoUteis[0]).toMatchObject({
        municipioIbge: '1504208',
        municipioNome: 'Marabá',
        municipioUf: 'PA',
      });
    }
  });

  it('criar() envia o comando com o snapshot municipal e a Idempotency-Key', async () => {
    const promise = firstValueFrom(
      api.criar(comandoValido, withIdempotencyKey('019f41cf-69fd-759a-ac6d-09acabc1b0ff')),
    );

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
    expect(req.request.body.diasNaoUteis[0]).toMatchObject({
      municipioIbge: '1504208',
      municipioNome: 'Marabá',
      municipioUf: 'PA',
    });
    req.flush(CALENDARIO_ID);

    await promise;
  });

});
