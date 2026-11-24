import { VocabulariosDeConfiguracaoApi } from '@uniplus/shared-data/configuracao';
import { of } from 'rxjs';
import { ORIGENS_DE_DATA } from './origens-de-data.testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdicaoDasFasesCanonicas } from './edicao-das-fases-canonicas';
import { FasesCanonicasPage } from './fases-canonicas.page';

const BASE = 'http://localhost:5000';

const fase: FaseCanonicaDto = {
  id: '01960000-0000-7000-0000-0000000000f3',
  codigo: 'HOMOLOGACAO_INSCRICOES',
  nome: 'Homologação das inscrições',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: false,
  permiteComplementacao: true,
  admiteAgruparEtapas: false,
  admiteComplementacao: true,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: ORIGENS_DE_DATA.NO_EDITAL,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('FasesCanonicasPage — sinalizadores da fase', () => {
  let edicao: EdicaoDasFasesCanonicas;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [FasesCanonicasPage],
      providers: [
        {
          provide: VocabulariosDeConfiguracaoApi,
          useValue: { listar: () => of({ ok: true, data: Object.values(ORIGENS_DE_DATA) }) },
        },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    const fixture = TestBed.createComponent(FasesCanonicasPage);
    edicao = fixture.debugElement.injector.get(EdicaoDasFasesCanonicas);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`).flush([fase]);
    controller
      .match((r) => r.url === `${BASE}/api/organizacao/unidades`)
      .forEach((r) => r.flush([]));
    await Promise.resolve();
    appRef.tick();
  });

  afterEach(() => controller.verify());

  async function concluir(put: TestRequest, lida: FaseCanonicaDto): Promise<void> {
    put.flush(null, { status: 204, statusText: 'No Content' });
    await Promise.resolve();
    appRef.tick();
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`).flush([lida]);
  }

  function salvarEdicaoDe(lida: FaseCanonicaDto): TestRequest {
    edicao.abrirEdicao(lida);
    edicao.salvar();
    const put = controller.expectOne(`${BASE}/api/configuracao/admin/fases-canonicas/${lida.id}`);
    expect(put.request.method).toBe('PUT');
    return put;
  }

  it('o PUT da fase de homologação devolve a complementação como foi lida', async () => {
    const put = salvarEdicaoDe(fase);

    expect(put.request.body).toMatchObject({ agrupaEtapas: false, permiteComplementacao: true });
    await concluir(put, fase);
  });

  it('o PUT devolve o agrupamento lido mesmo numa fase que não é a de avaliação', async () => {
    const lida = { ...fase, agrupaEtapas: true, permiteComplementacao: false };
    const put = salvarEdicaoDe(lida);

    expect(put.request.body).toMatchObject({ agrupaEtapas: true, permiteComplementacao: false });
    await concluir(put, lida);
  });
});
