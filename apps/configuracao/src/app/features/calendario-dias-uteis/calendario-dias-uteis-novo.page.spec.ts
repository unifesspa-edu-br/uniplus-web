import { afterEach, beforeEach, describe, it } from 'vitest';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import {
  CONFIGURACAO_BASE_PATH,
} from '@uniplus/shared-data/configuracao';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CalendarioDiasUteisNovoPage } from './calendario-dias-uteis-novo.page';

const BASE = 'http://localhost:5000';

describe('CalendarioDiasUteisNovoPage', async () => {
  let fixture: ComponentFixture<CalendarioDiasUteisNovoPage>;
  let component: CalendarioDiasUteisNovoPage;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendarioDiasUteisNovoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CalendarioDiasUteisNovoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  it('valida client-side quando tenta salvar sem dia não util', async () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
  });
});
