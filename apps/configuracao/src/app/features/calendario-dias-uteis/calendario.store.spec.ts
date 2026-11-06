import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CalendarioStore } from './calendario.store';
import { BASE, CALENDARIO_ID, DIA_ESTADUAL, calendarioCom } from './calendario-dias-uteis.testing';

describe('CalendarioStore', () => {
  let http: HttpTestingController;
  let parametros: BehaviorSubject<Record<string, string>>;

  const montar = (instantaneo: Record<string, string>): CalendarioStore => {
    parametros = new BehaviorSubject<Record<string, string>>(instantaneo);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(instantaneo) }, params: parametros },
        },
        CalendarioStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(CalendarioStore);
  };
  const tick = async (): Promise<void> => {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
  };

  afterEach(() => http.verify());

  describe('com o calendário na rota', () => {
    let store: CalendarioStore;
    beforeEach(() => {
      store = montar({ id: CALENDARIO_ID });
    });

    it('antes da primeira resposta, carrega sem dias e sem total', async () => {
      await tick();

      expect(store.carregandoPrimeiraVez()).toBe(true);
      expect(store.totalDiasNaoUteis()).toBe(0);
      expect(store.meses()).toHaveLength(12);
      http.expectOne(`${BASE}/api/configuracao/calendarios-dias-uteis/${CALENDARIO_ID}`);
    });

    it('lê o calendário da rota e o id acompanha a rota', async () => {
      await tick();
      http
        .expectOne(`${BASE}/api/configuracao/calendarios-dias-uteis/${CALENDARIO_ID}`)
        .flush(calendarioCom([DIA_ESTADUAL]));
      await tick();

      expect(store.calendario()?.versaoDataset).toBe('2026.1');
      expect(store.carregandoPrimeiraVez()).toBe(false);
      expect(store.totalDiasNaoUteis()).toBe(1);
      expect(store.mensagemDeErro()).toBeNull();

      parametros.next({ id: 'outro' });
      await tick();
      expect(store.calendarioId()).toBe('outro');
      http.expectOne(`${BASE}/api/configuracao/calendarios-dias-uteis/outro`);
    });
  });

  it('sem id na rota, o id é vazio', () => {
    const store = montar({});
    parametros.next({});

    expect(store.calendarioId()).toBe('');
    http.match(() => true);
  });
});
