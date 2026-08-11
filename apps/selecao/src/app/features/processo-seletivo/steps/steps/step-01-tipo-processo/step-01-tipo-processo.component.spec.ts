import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import { TypeCardComponent } from '../../../components/type-card/type-card.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { Step01TipoProcessoComponent } from './step-01-tipo-processo.component';

const BASE = 'http://localhost:5000';
const ID = '019fe8f8-1400-7000-8000-000000000001';

const tipoProcessoSeed: TipoProcessoDto = {
  id: ID,
  codigo: 'SiSU',
  nome: 'SiSU',
  descricao: null,
  ativo: true,
  criadoEm: '2026-08-10T00:00:00+00:00',
};

describe('Step01TipoProcessoComponent', () => {
  let componente: Step01TipoProcessoComponent;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step01TipoProcessoComponent, TypeCardComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        ProcessoSeletivoStore,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Step01TipoProcessoComponent);
    fixture.detectChanges();
    componente = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('carrega os tipos de processo da API e exibe somente os ativos', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`);
    expect(req.request.method).toBe('GET');
    req.flush([
      tipoProcessoSeed,
      { ...tipoProcessoSeed, id: '2', codigo: 'PS', nome: 'PS', ativo: false },
    ]);

    expect(componente.loading()).toBe(false);
    expect(componente.options().map((opt) => opt.value)).toEqual(['SiSU']);
  });

  it('filtra por nome na busca', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`);
    req.flush([tipoProcessoSeed]);

    componente.query.set('SiSU');
    expect(componente.filteredOptions().length).toBe(1);

    componente.query.set('PS');
    expect(componente.filteredOptions().length).toBe(0);
  });

  it('grava a seleção no rascunho', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`);
    req.flush([tipoProcessoSeed]);

    componente.select('SiSU');
    expect(componente.store.draft().tipoProcesso.selected).toBe('SiSU');
  });

  it('valida se um tipo foi selecionado', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`);
    req.flush([tipoProcessoSeed]);

    expect(componente.validate().valid).toBe(false);
    componente.select('SiSU');
    expect(componente.validate().valid).toBe(true);
  });

  it('sinaliza erro de carregamento e permite tentar novamente', () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`);
    req.flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Internal Server Error' });

    expect(componente.loadError()).toBe(true);
    expect(componente.options().length).toBe(0);

    componente.tentarNovamente();
    const retry = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`);
    retry.flush([tipoProcessoSeed]);

    expect(componente.loadError()).toBe(false);
    expect(componente.options().length).toBe(1);
  });
});
