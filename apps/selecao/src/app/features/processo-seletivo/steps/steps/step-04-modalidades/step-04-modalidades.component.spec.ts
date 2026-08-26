import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { Step04ModalidadesComponent } from './step-04-modalidades.component';

const BASE = 'http://localhost:5000';

function modalidade(id: string, codigo: string): ModalidadeDto {
  return {
    id,
    codigo,
    descricao: `Descricao de ${codigo}`,
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
}

describe('Step04ModalidadesComponent', () => {
  let componente: Step04ModalidadesComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step04ModalidadesComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        ProcessoSeletivoStore,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Step04ModalidadesComponent);
    fixture.detectChanges();
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('exibe todas as modalidades retornadas pela API e as torna selecionaveis', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`);
    req.flush([
      modalidade('1', 'AC'),
      modalidade('2', 'AC_PCD'),
      modalidade('3', 'LB_PCD'),
      modalidade('4', 'LI_PCD'),
    ]);
    expect(componente.modalidades().map((m) => m.code)).toEqual([
      'AC',
      'AC_PCD',
      'LB_PCD',
      'LI_PCD',
    ]);
    componente.toggle('AC_PCD', true);
    expect(store.draft().modalidades.selected).toContain('AC_PCD');
  });

  it('mantem loading true antes da resposta e false depois', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`);
    expect(componente.loading()).toBe(true);
    req.flush([modalidade('1', 'AC')]);
    expect(componente.loading()).toBe(false);
  });

  it('acumula paginas seguindo o cursor do header Link', () => {
    const links = new HttpHeaders({
      Link: `<${BASE}/api/configuracao/modalidades?cursor=abc&direction=next>; rel="next"`,
    });
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`)
      .flush([modalidade('1', 'AC')], { headers: links });
    controller
      .expectOne(
        (r) =>
          r.url === `${BASE}/api/configuracao/modalidades` &&
          r.params.get('cursor') === 'abc' &&
          r.params.get('direction') === 'next',
      )
      .flush([modalidade('2', 'LB_PPI')]);
    expect(componente.modalidades().map((m) => m.code)).toEqual(['AC', 'LB_PPI']);
  });

  it('exibe erro e permite retry que limpa o erro e recarrega', () => {
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`)
      .flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Erro' });
    expect(componente.errorMessage()).not.toBeNull();
    expect(componente.modalidades().length).toBe(0);

    componente.carregar();
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`)
      .flush([modalidade('1', 'AC')]);
    expect(componente.errorMessage()).toBeNull();
    expect(componente.modalidades().length).toBe(1);
  });

  it('preserva recorte de documento do passo 10', () => {
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`)
      .flush([modalidade('1', 'AC'), modalidade('2', 'LB_PPI')]);
    componente.toggle('AC', true);
    const [primeiroId] = Object.keys(store.draft().documentos);
    store.patchSection('documentos', {
      ...store.draft().documentos,
      [primeiroId]: {
        ...store.draft().documentos[primeiroId],
        modalidades: ['AC'],
        modalidadesRecortadas: true,
      },
    });
    componente.toggle('LB_PPI', true);
    expect(store.draft().documentos[primeiroId].modalidades).toEqual(['AC']);
  });

  it('preserva escolha de bonus quando a modalidade sai e volta', () => {
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`)
      .flush([modalidade('1', 'AC')]);
    store.patchObjectSection('bonus', { modalidades: ['AC'] });
    componente.toggle('AC', false);
    expect(store.draft().bonus.modalidades).toEqual(['AC']);
    componente.toggle('AC', true);
    expect(store.draft().bonus.modalidades).toEqual(['AC']);
  });

  it('exige ao menos uma modalidade para avancar', () => {
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/modalidades`)
      .flush([modalidade('1', 'AC')]);
    expect(componente.validate().valid).toBe(false);
    componente.toggle('AC', true);
    expect(componente.validate().valid).toBe(true);
  });
});
