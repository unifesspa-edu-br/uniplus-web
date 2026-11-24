import { HttpContext, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ObrigatoriedadesLegaisApi } from './obrigatoriedades-legais.api';
import { CategoriaObrigatoriedadeCodigo } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

describe('ObrigatoriedadesLegaisApi', () => {
  let api: ObrigatoriedadesLegaisApi;
  let http: HttpTestingController;
  const base = '/api/selecao/obrigatoriedades-legais';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: '' },
      ],
    });
    api = TestBed.inject(ObrigatoriedadesLegaisApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('envia os filtros por código e omite a categoria ausente', async () => {
    const result = firstValueFrom(
      api.listar({
        tipoEdital: 'edital',
        categoria: CategoriaObrigatoriedadeCodigo.ETAPA,
        vigentes: false,
      }),
    );
    const req = http.expectOne((request) => request.url === base);
    expect(req.request.params.get('categoria')).toBe(CategoriaObrigatoriedadeCodigo.ETAPA);
    expect(req.request.params.get('tipoEdital')).toBe('edital');
    expect(req.request.params.get('vigentes')).toBe('false');
    req.flush([]);
    await result;
    const vazio = firstValueFrom(api.listar({ categoria: null }));
    const semCategoria = http.expectOne((request) => request.url === base);
    expect(semCategoria.request.params.has('categoria')).toBe(false);
    semCategoria.flush([]);
    await vazio;
  });

  it('consulta e desativa pelo identificador codificado', async () => {
    const leitura = firstValueFrom(api.obter('a/b'));
    http.expectOne(`${base}/a%2Fb`).flush({});
    await leitura;
    const remocao = firstValueFrom(api.remover('a/b'));
    const req = http.expectOne('/api/selecao/admin/obrigatoriedades-legais/a%2Fb');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await remocao;
  });

  it('encaminha os comandos de criação e atualização', async () => {
    const context = new HttpContext();
    const criar = firstValueFrom(api.criar({} as Parameters<typeof api.criar>[0], context));
    const criacao = http.expectOne('/api/selecao/admin/obrigatoriedades-legais');
    expect(criacao.request.method).toBe('POST');
    criacao.flush('id');
    await criar;
    const atualizar = firstValueFrom(
      api.atualizar('a/b', {} as Parameters<typeof api.atualizar>[1], context),
    );
    const atualizacao = http.expectOne('/api/selecao/admin/obrigatoriedades-legais/a%2Fb');
    expect(atualizacao.request.method).toBe('PUT');
    atualizacao.flush(null);
    await atualizar;
  });
});
