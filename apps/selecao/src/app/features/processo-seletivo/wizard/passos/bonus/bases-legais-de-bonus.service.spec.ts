import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { BasesLegaisDeBonus } from './bases-legais-de-bonus.service';

const BASE = 'http://localhost:5000';

describe('BasesLegaisDeBonus', () => {
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        BasesLegaisDeBonus,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.match(() => true));

  it('trata como falha a resposta 500 das bases legais, sem deixar a espera presa', () => {
    const bases = TestBed.inject(BasesLegaisDeBonus);

    controller
      .expectOne((req) => req.url.includes('base-legal-bonus-regional'))
      .flush(
        { type: 'about:blank', title: 'Erro', status: 500, traceId: 't' },
        { status: 500, statusText: 'Server Error' },
      );

    expect(bases.carregando()).toBe(false);
    expect(bases.erro()).toBe('Não foi possível carregar as bases legais de bônus regional.');
  });
});
