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

  it('aceita o passo sem cobrança de taxa', () => {
    expect(componente.validate().valid).toBe(true);
  });

  it('recusa taxa obrigatória sem nenhum campo preenchido', () => {
    store.patchObjectSection('pagamento', { taxaObrigatoria: true });

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toEqual([
      'Informe o valor da taxa de inscrição.',
      'Selecione ao menos uma forma de pagamento.',
      'Informe o início da solicitação de isenção.',
      'Informe o encerramento da solicitação de isenção.',
      'Selecione o prazo para recurso da isenção.',
    ]);
  });

  it('aceita taxa obrigatória com todos os campos preenchidos corretamente', () => {
    store.patchObjectSection('pagamento', {
      taxaObrigatoria: true,
      valorTaxa: 120,
      formasPagamento: ['PIX'],
      isencao: {
        inicioSolicitacao: '2026-09-01T00:00',
        fimSolicitacao: '2026-09-06T23:59',
        prazoRecursoDiasUteis: 2,
      },
    });

    expect(componente.validate().valid).toBe(true);
  });

  it('recusa período de isenção com menos de 5 dias corridos', () => {
    store.patchObjectSection('pagamento', {
      taxaObrigatoria: true,
      valorTaxa: 120,
      formasPagamento: ['PIX'],
      isencao: {
        inicioSolicitacao: '2026-09-01T00:00',
        fimSolicitacao: '2026-09-04T23:59',
        prazoRecursoDiasUteis: 2,
      },
    });

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toEqual([
      'O período de solicitação de isenção deve ter no mínimo 5 dias corridos.',
    ]);
  });

  it('aceita o período de isenção com exatamente 5 dias corridos', () => {
    store.patchObjectSection('pagamento', {
      taxaObrigatoria: true,
      valorTaxa: 120,
      formasPagamento: ['PIX'],
      isencao: {
        inicioSolicitacao: '2026-09-01T00:00',
        fimSolicitacao: '2026-09-06T00:00',
        prazoRecursoDiasUteis: 2,
      },
    });

    expect(componente.validate().valid).toBe(true);
  });

  it('alterna forma de pagamento sem duplicar nem perder as demais', () => {
    componente.toggleFormaPagamento('PIX', true);
    componente.toggleFormaPagamento('GRU', true);
    expect(store.draft().pagamento.formasPagamento).toEqual(['PIX', 'GRU']);

    componente.toggleFormaPagamento('PIX', false);
    expect(store.draft().pagamento.formasPagamento).toEqual(['GRU']);
  });

  it('expõe as três modalidades de isenção obrigatórias', () => {
    expect(componente.criteriosIsencao.map((c) => c.id)).toEqual([
      'lei-12799-2013',
      'cadastro-unico',
      'doador-medula-ossea',
    ]);
  });
});
