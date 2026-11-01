import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';

import { CamposDaInscricaoDoProcessoApi } from './campos-da-inscricao-do-processo.api';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ROTA = `${BASE}/api/selecao/processos-seletivos/p-1/inscricoes/i-1/campos/CPF/revelacao`;

describe('CamposDaInscricaoDoProcessoApi', () => {
  let controller: HttpTestingController;
  let api: CamposDaInscricaoDoProcessoApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(CamposDaInscricaoDoProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('pede a revelação de um campo pela rota da inscrição, sem ocorrência fora de grupo', async () => {
    const promessa = firstValueFrom(api.revelar('p-1', 'i-1', 'CPF', null));

    const req = controller.expectOne(ROTA);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('campo-revelado-da-inscricao', 1),
    );
    req.flush({ fatoCodigo: 'CPF', valor: '699.598.363-71' });

    const resultado = await promessa;
    expect(resultado.ok && resultado.data.valor).toBe('699.598.363-71');
  });

  it('leva a ocorrência quando o campo está em grupo', () => {
    void firstValueFrom(api.revelar('p-1', 'i-1', 'CPF', 'oc-2'));

    const req = controller.expectOne(`${ROTA}?ocorrencia=oc-2`);
    req.flush({ fatoCodigo: 'CPF', valor: '699.598.363-71' });
  });
});
