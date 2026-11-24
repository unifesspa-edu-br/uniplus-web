import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VocabulariosDaDeliberacaoService } from './vocabularios-da-deliberacao.service';

const caminhos = [
  'modos-deliberacao',
  'criterios-votacao',
  'desempates-votacao',
  'encerramentos-votacao',
  'resultados-sem-unanimidade',
];

describe('VocabulariosDaDeliberacaoService', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: '' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('carrega uma vez e mantém os rótulos recebidos', () => {
    const servico = TestBed.inject(VocabulariosDaDeliberacaoService);
    expect(servico.carregando()).toBe(true);
    for (const caminho of caminhos) {
      http
        .expectOne(`/api/selecao/vocabularios/${caminho}`)
        .flush([{ codigo: 'valor', rotulo: 'Da API' }]);
    }
    expect(servico.carregando()).toBe(false);
    expect(servico.opcoes()?.modos[0].rotulo).toBe('Da API');
    expect(TestBed.inject(VocabulariosDaDeliberacaoService)).toBe(servico);
  });

  it('informa falha quando uma consulta não é concluída', () => {
    const servico = TestBed.inject(VocabulariosDaDeliberacaoService);
    const pedidos = caminhos.map((caminho) =>
      http.expectOne(`/api/selecao/vocabularios/${caminho}`),
    );
    pedidos[0].flush({}, { status: 500, statusText: 'Erro' });
    expect(servico.erro()).toBe(true);
    expect(servico.carregando()).toBe(false);
    expect(servico.opcoes()).toBeNull();
  });
});
