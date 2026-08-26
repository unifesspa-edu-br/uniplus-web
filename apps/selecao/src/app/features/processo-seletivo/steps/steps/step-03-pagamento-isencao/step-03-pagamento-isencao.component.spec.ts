import { TestBed } from '@angular/core/testing';
import { Step03PagamentoIsencaoComponent } from './step-03-pagamento-isencao.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

describe('Step03PagamentoIsencaoComponent', () => {
  let componente: Step03PagamentoIsencaoComponent;
  let store: ProcessoSeletivoStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step03PagamentoIsencaoComponent],
      providers: [ProcessoSeletivoStore],
    }).compileComponents();

    const fixture = TestBed.createComponent(Step03PagamentoIsencaoComponent);
    fixture.detectChanges();
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
  });

  it('aceita o passo sem taxa de inscrição', () => {
    expect(componente.validate().valid).toBe(true);
  });

  it('recusa taxa obrigatória sem valor, forma de pagamento ou data limite', () => {
    store.patchObjectSection('pagamento', { taxaObrigatoria: true });

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toEqual([
      'Informe o valor da taxa de inscrição.',
      'Selecione ao menos uma forma de pagamento.',
      'Informe a data limite para pagamento.',
    ]);
  });

  it('aceita taxa obrigatória com todos os campos preenchidos', () => {
    store.patchObjectSection('pagamento', {
      taxaObrigatoria: true,
      valorTaxa: 80,
      formasPagamento: ['PIX'],
      dataLimite: '2026-10-01',
    });

    expect(componente.validate().valid).toBe(true);
  });

  it('alterna forma de pagamento sem duplicar nem perder as demais', () => {
    componente.toggleFormaPagamento('PIX', true);
    componente.toggleFormaPagamento('BOLETO', true);
    expect(store.draft().pagamento.formasPagamento).toEqual(['PIX', 'BOLETO']);

    componente.toggleFormaPagamento('PIX', false);
    expect(store.draft().pagamento.formasPagamento).toEqual(['BOLETO']);
  });

  it('recusa isenção habilitada sem critério ou prazo', () => {
    store.patchObjectSection('pagamento', {
      taxaObrigatoria: true,
      valorTaxa: 80,
      formasPagamento: ['PIX'],
      dataLimite: '2026-10-01',
      isencao: { disponivel: true, criterios: [], prazoSolicitacao: '' },
    });

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toEqual([
      'Selecione ao menos um critério de isenção.',
      'Informe o prazo para solicitação de isenção.',
    ]);
  });

  it('aceita isenção habilitada com critério e prazo preenchidos', () => {
    store.patchObjectSection('pagamento', {
      taxaObrigatoria: true,
      valorTaxa: 80,
      formasPagamento: ['PIX'],
      dataLimite: '2026-10-01',
      isencao: { disponivel: true, criterios: ['renda-per-capita'], prazoSolicitacao: '2026-09-15' },
    });

    expect(componente.validate().valid).toBe(true);
  });

  it('alterna critério de isenção sem duplicar nem perder os demais', () => {
    componente.toggleCriterioIsencao('renda-per-capita', true);
    componente.toggleCriterioIsencao('cadastro-unico', true);
    expect(store.draft().pagamento.isencao.criterios).toEqual(['renda-per-capita', 'cadastro-unico']);

    componente.toggleCriterioIsencao('renda-per-capita', false);
    expect(store.draft().pagamento.isencao.criterios).toEqual(['cadastro-unico']);
  });
});
