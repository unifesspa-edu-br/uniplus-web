import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { ModalidadeFormPage } from './modalidade-form.page';
import { ModalidadesListPage } from './modalidades-list.page';
import { BASE } from './modalidades-de-teste.testing';

export const modalidade: ModalidadeDto = {
  id: 'id-v',
  codigo: 'V',
  legalFixa: false,
  descricao: 'Modalidade V',
  naturezaLegal: 'AMPLA',
  composicaoVagas: 'RESTANTE_DAS_VAGAS_OFERTADAS',
  composicaoOrigem: null,
  regraRemanejamento: null,
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
  regraDeAplicabilidade: [],
  acaoQuandoIndeferido: null,
  baseLegal: null,
  criadoEm: '2026-07-03T12:00:00Z',
};

export function configurar(): void {
  TestBed.configureTestingModule({
    imports: [ModalidadesListPage, ModalidadeFormPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([{ path: 'modalidades', children: [] }]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
    ],
  });
}
