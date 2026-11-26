import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { GeoApi } from '@uniplus/shared-data/geo';
import { errorResult, mockProblemDetails, okResult } from '@uniplus/shared-testing';
import { describe, expect, it, vi } from 'vitest';
import { buscaDeMunicipiosDaConfiguracao } from './busca-de-municipios-da-configuracao';

describe('busca de municípios da Configuração', () => {
  it.each([500, 400, 200])('notifica somente falhas de servidor (status %s)', (status) => {
    const resultado = status === 200 ? okResult([]) : errorResult(mockProblemDetails({ status }));
    const notificar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: GeoApi, useValue: { listarCidades: () => of(resultado) } },
        { provide: NotificationService, useValue: { errorFromProblem: notificar } },
      ],
    });
    const buscar = TestBed.runInInjectionContext(buscaDeMunicipiosDaConfiguracao);
    buscar('Mar').subscribe();
    expect(notificar).toHaveBeenCalledTimes(status === 500 ? 1 : 0);
  });
});
