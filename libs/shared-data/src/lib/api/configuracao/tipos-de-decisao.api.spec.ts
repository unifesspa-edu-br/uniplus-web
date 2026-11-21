import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { TiposDeDecisaoApi } from './tipos-de-decisao.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

describe('TiposDeDecisaoApi', () => {
  it('consulta o vocabulário com a mídia versionada e preserva a resposta', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });
    const resposta = firstValueFrom(TestBed.inject(TiposDeDecisaoApi).listar());
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne(
      'http://localhost:5000/api/configuracao/vocabularios/tipos-de-decisao',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('codigo-tipo-de-decisao', 1),
    );
    const tipos = [{ codigo: 'NOTA_DA_ETAPA', rotulo: 'Nota da etapa' }];
    req.flush(tipos);
    const resultado = await resposta;
    expect(resultado.ok && resultado.data).toEqual(tipos);
    http.verify();
  });
});
