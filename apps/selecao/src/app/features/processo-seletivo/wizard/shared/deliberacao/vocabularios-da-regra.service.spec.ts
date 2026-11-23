import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { VocabulariosDaRegra } from './vocabularios-da-regra.service';

const ROTAS = [
  'modos-deliberacao',
  'criterios-votacao',
  'desempates-votacao',
  'encerramentos-votacao',
  'resultados-sem-unanimidade',
];

function responderComFalha(http: HttpTestingController): void {
  for (const rota of ROTAS) {
    const pedido = http.expectOne(`/api/selecao/vocabularios/${rota}`);
    if (rota === ROTAS[1]) pedido.flush('Erro', { status: 503, statusText: 'Erro' });
    else pedido.flush({ ok: true, data: [] });
  }
}

describe('VocabulariosDaRegra', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: '' },
      ],
    }),
  );

  it('carrega cada lista e conserva os rótulos recebidos', () => {
    const vocabularios = TestBed.inject(VocabulariosDaRegra);
    const http = TestBed.inject(HttpTestingController);
    expect(vocabularios.pronta()).toBe(false);
    for (const rota of ROTAS) {
      http.expectOne(`/api/selecao/vocabularios/${rota}`).flush({
        ok: true,
        data: [{ codigo: 'codigo', rotulo: 'Rótulo da API' }],
      });
    }
    expect(vocabularios.pronta()).toBe(true);
    expect(vocabularios.modos().opcoes[0].rotulo).toBe('Rótulo da API');
    http.verify();
  });

  it('mantém a lista indisponível separada das demais', () => {
    const vocabularios = TestBed.inject(VocabulariosDaRegra);
    const http = TestBed.inject(HttpTestingController);
    for (const rota of ROTAS) {
      http
        .expectOne(`/api/selecao/vocabularios/${rota}`)
        .flush(rota === ROTAS[1] ? { ok: false } : { ok: true, data: [] });
    }
    expect(vocabularios.indisponivel()).toBe(true);
    expect(vocabularios.criterios().situacao).toBe('indisponivel');
    expect(vocabularios.modos().situacao).toBe('pronta');
    expect(vocabularios.pronta()).toBe(false);
    http.verify();
  });
  it('recupera apenas a lista que falhou', () => {
    const vocabularios = TestBed.inject(VocabulariosDaRegra);
    const http = TestBed.inject(HttpTestingController);
    responderComFalha(http);
    vocabularios.recarregarIndisponiveis();
    expect(vocabularios.criterios().situacao).toBe('carregando');
    vocabularios.recarregarIndisponiveis();
    http.expectOne(`/api/selecao/vocabularios/${ROTAS[1]}`).flush({ ok: true, data: [] });
    expect(vocabularios.pronta()).toBe(true);
    expect(vocabularios.criterios().situacao).toBe('pronta');
    http.verify();
  });
});
