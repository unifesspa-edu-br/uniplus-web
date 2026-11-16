import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { expect } from 'vitest';
import { CATALOGO } from './catalogo-de-fatos.fixture';
import { ModalidadesListPage } from './modalidades-list.page';
import { BASE, URL, URL_CATALOGO, modalidade } from './modalidades-de-teste.testing';

/** V retira suas vagas de AC e remaneja para AC (referencia AC como origem e destino). */
export const V = modalidade({
  id: 'id-v',
  codigo: 'V',
  legalFixa: false,
  descricao: 'PcD ampla concorrência',
  naturezaLegal: 'ACAO_AFIRMATIVA',
  composicaoVagas: 'RETIRADA_DE_OUTRA_MODALIDADE',
  composicaoOrigem: 'AC',
  regraRemanejamento: 'DESTINO_UNICO',
  remanejamentoDestino: 'AC',
  regraDeAplicabilidade: [
    [
      { fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: true },
      { fato: 'COR_RACA', operador: 'EM', valor: ['PRETA', 'INDIGENA'] },
    ],
    [{ fato: 'COR_RACA', operador: 'IGUAL', valor: 'PARDA' }],
  ],
});

function configurarModuloDaLista(): void {
  TestBed.configureTestingModule({
    imports: [ModalidadesListPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([{ path: 'modalidades', children: [] }]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
}

/** A página da lista de modalidades montada no TestBed, com o servidor simulado. */
export class PaginaDaListaDeModalidades {
  readonly fixture: ComponentFixture<ModalidadesListPage>;
  readonly component: ModalidadesListPage;
  readonly controller: HttpTestingController;
  private readonly appRef: ApplicationRef;

  constructor() {
    configurarModuloDaLista();
    this.fixture = TestBed.createComponent(ModalidadesListPage);
    this.component = this.fixture.componentInstance;
    this.controller = TestBed.inject(HttpTestingController);
    this.appRef = TestBed.inject(ApplicationRef);
    this.fixture.detectChanges();
  }

  verificar(): void {
    this.controller.verify();
  }

  async propagate(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }

  async flushLista(itens: readonly ModalidadeDto[]): Promise<void> {
    const req = this.controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('limit')).toBe('100');
    req.flush(itens);
    for (const catalogo of this.controller.match(URL_CATALOGO)) catalogo.flush(CATALOGO);
    await this.propagate();
  }
}
