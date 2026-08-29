import { TestBed } from '@angular/core/testing';
import { BonusStepComponent } from './bonus.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

/** Uma distribuição mínima só para declarar quais modalidades o processo aceita. */
function ofertaCom(modalidades: readonly { id: string; codigo: string }[]) {
  return {
    ofertaCursoId: 'oferta-1',
    voBase: '40',
    pr: '0,5',
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    regraDistribuicaoVersao: '1.0',
    regraAjusteCodigo: null,
    regraAjusteVersao: null,
    referenciaReservaDemograficaId: null,
    modalidades,
    quadro: [],
  };
}

describe('BonusStepComponent', () => {
  let componente: BonusStepComponent;
  let store: ProcessoSeletivoStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BonusStepComponent],
      providers: [ProcessoSeletivoStore],
    }).compileComponents();

    const fixture = TestBed.createComponent(BonusStepComponent);
    fixture.detectChanges();
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
  });

  /** O que vale é a escolha do operador cruzada com o que o processo aceita. */
  it('considera apenas as modalidades aceitas pelo processo', () => {
    store.patchObjectSection('vagas', {
      ofertas: [ofertaCom([{ id: 'AC', codigo: 'AC' }])],
    });
    store.patchObjectSection('bonus', { modalidades: ['AC', 'LB_Q'] });

    expect(componente.modalidadesEfetivas()).toEqual(['AC']);
  });

  it('recupera a modalidade quando ela volta a ser aceita', () => {
    store.patchObjectSection('vagas', {
      ofertas: [ofertaCom([{ id: 'AC', codigo: 'AC' }])],
    });
    store.patchObjectSection('bonus', { modalidades: ['AC', 'LB_Q'] });
    expect(componente.modalidadesEfetivas()).toEqual(['AC']);

    store.patchObjectSection('vagas', {
      ofertas: [
        ofertaCom([
          { id: 'AC', codigo: 'AC' },
          { id: 'LB_Q', codigo: 'LB_Q' },
        ]),
      ],
    });
    expect(componente.modalidadesEfetivas()).toEqual(['AC', 'LB_Q']);
  });

  /**
   * Bônus cuja escolha inteira deixou de ser aceita não pode passar na
   * validação só porque a lista guardada continua preenchida.
   */
  it('recusa bônus sem nenhuma modalidade aceita', () => {
    store.patchObjectSection('vagas', {
      ofertas: [ofertaCom([{ id: 'AC', codigo: 'AC' }])],
    });
    store.patchObjectSection('bonus', {
      ativo: true,
      tipo: 'ADITIVO',
      valor: 0.2,
      criterio: 'RESIDENCIA_MUNICIPIO_CONVENIO',
      modalidades: ['LB_Q'],
    });

    expect(componente.validate().valid).toBe(false);
  });

  it('aceita bônus com ao menos uma modalidade aceita', () => {
    store.patchObjectSection('vagas', {
      ofertas: [ofertaCom([{ id: 'AC', codigo: 'AC' }])],
    });
    store.patchObjectSection('bonus', {
      ativo: true,
      tipo: 'ADITIVO',
      valor: 0.2,
      criterio: 'RESIDENCIA_MUNICIPIO_CONVENIO',
      modalidades: ['AC', 'LB_Q'],
    });

    expect(componente.validate().valid).toBe(true);
  });
});
