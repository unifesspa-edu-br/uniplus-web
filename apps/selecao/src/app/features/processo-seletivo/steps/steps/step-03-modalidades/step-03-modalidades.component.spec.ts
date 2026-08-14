import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { Step03ModalidadesComponent } from './step-03-modalidades.component';

const BASE = 'http://localhost:5000';

const modalidadeSeed: ModalidadeDto = {
  id: '70da1000-0000-7000-8000-000000000001',
  codigo: 'AC',
  descricao: 'Ampla concorrência',
  naturezaLegal: 'AMPLA',
  composicaoVagas: 'RESIDUAL_DO_VO',
  composicaoOrigem: null,
  regraRemanejamento: null,
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
  criteriosCumulativos: [],
  acaoQuandoIndeferido: null,
  baseLegal: null,
  criadoEm: '2026-01-01T00:00:00+00:00',
};

describe('Step03ModalidadesComponent', () => {
  let componente: Step03ModalidadesComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step03ModalidadesComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        ProcessoSeletivoStore,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Step03ModalidadesComponent);
    fixture.detectChanges();
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('carrega as modalidades do catalogo de Configuracao', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`);
    expect(req.request.method).toBe('GET');
    req.flush([modalidadeSeed]);

    expect(componente.loading()).toBe(false);
    expect(componente.modalidades().length).toBe(1);
    expect(componente.modalidades()[0].code).toBe('AC');
  });

  it('grava o codigo canonico no rascunho', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`);
    req.flush([modalidadeSeed]);

    componente.toggle('LB_Q', true);
    expect(store.draft().modalidades.selected).toEqual(['LB_Q']);
  });

  it('mantem os documentos alinhados a selecao conforme ela cresce', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`);
    req.flush([modalidadeSeed, { ...modalidadeSeed, id: '2', codigo: 'LB_Q' }]);

    componente.toggle('LB_Q', true);
    componente.toggle('AC', true);

    const documentos = Object.values(store.draft().documentos);
    expect(documentos.every((config) => config.modalidades.includes('AC'))).toBe(true);
    expect(documentos.every((config) => config.modalidades.includes('LB_Q'))).toBe(true);
  });

  it('esvazia os documentos quando nada esta selecionado', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`);
    req.flush([modalidadeSeed]);

    componente.toggle('AC', true);
    componente.toggle('AC', false);

    const documentos = Object.values(store.draft().documentos);
    expect(documentos.every((config) => config.modalidades.length === 0)).toBe(true);
  });

  it('exige ao menos uma modalidade para avancar', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`);
    req.flush([modalidadeSeed]);

    expect(componente.validate().valid).toBe(false);
    componente.toggle('AC', true);
    expect(componente.validate().valid).toBe(true);
  });

  it('exibe mensagem de erro quando a listagem falha', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`);
    req.flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Erro' });

    expect(componente.errorMessage()).not.toBeNull();
    expect(componente.modalidades().length).toBe(0);
  });
});
