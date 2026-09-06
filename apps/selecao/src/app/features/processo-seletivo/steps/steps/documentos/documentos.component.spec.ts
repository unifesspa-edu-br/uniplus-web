import { TestBed } from '@angular/core/testing';
import { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { DocumentosStepComponent } from './documentos.component';

const DOC_ID = 'rg-cnh';

/** Uma distribuição mínima só para declarar quais modalidades o processo aceita. */
function ofertaComModalidade(codigo: string) {
  return {
    ofertaCursoId: 'oferta-1',
    voBase: '40',
    pr: '0,5',
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    regraDistribuicaoVersao: '1.0',
    regraAjusteCodigo: null,
    regraAjusteVersao: null,
    referenciaReservaDemograficaId: null,
    modalidades: [{ id: codigo, codigo }],
    quadro: [],
  };
}

/** Uma fase mínima do cronograma — só o que o passo de documentos lê. */
function faseCom(codigo: string, ordem: number): FaseDoCronograma {
  return {
    faseCanonicaId: `catalogo-${codigo}`,
    codigo,
    ordem,
    inicio: null,
    fim: null,
    atoProduzidoCodigo: null,
    tiposBancaIds: [],
    regraRecurso: null,
    congelados: null,
  };
}

describe('DocumentosStepComponent', () => {
  let componente: DocumentosStepComponent;
  let store: ProcessoSeletivoStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentosStepComponent],
      providers: [ProcessoSeletivoStore],
    }).compileComponents();

    const fixture = TestBed.createComponent(DocumentosStepComponent);
    fixture.detectChanges();
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
  });

  it('nasce sem etapa selecionada e com todasEtapas ligado', () => {
    const config = store.draft().documentos[DOC_ID];
    expect(config.etapas).toEqual([]);
    expect(config.todasEtapas).toBe(true);
  });

  it('a seleção de etapa sobrevive a patchSection seguido de releitura do store', () => {
    store.patchObjectSection('cronograma', { fases: [faseCom('INSCRICAO', 1)] });
    componente.toggleTodasEtapas(DOC_ID, false);

    componente.toggleEtapa(DOC_ID, 'INSCRICAO', true);
    expect(store.draft().documentos[DOC_ID].etapas).toEqual(['INSCRICAO']);

    // Releitura independente do componente, direto do signal do store.
    expect(store.draft().documentos[DOC_ID].etapas).toEqual(['INSCRICAO']);
  });

  it('fase removida do cronograma deixa de aparecer sem apagar a seleção guardada', () => {
    store.patchObjectSection('cronograma', {
      fases: [faseCom('INSCRICAO', 1), faseCom('HOMOLOGACAO', 2)],
    });
    componente.toggleTodasEtapas(DOC_ID, false);
    componente.toggleEtapa(DOC_ID, 'INSCRICAO', true);
    componente.toggleEtapa(DOC_ID, 'HOMOLOGACAO', true);

    // A fase HOMOLOGACAO sai do cronograma — o rascunho de documentos não é
    // reescrito, só a leitura passa a ignorar a referência órfã.
    store.patchObjectSection('cronograma', { fases: [faseCom('INSCRICAO', 1)] });

    expect(componente.etapasEfetivas(DOC_ID)).toEqual(['INSCRICAO']);
    expect(store.draft().documentos[DOC_ID].etapas).toEqual(['INSCRICAO', 'HOMOLOGACAO']);

    // A fase volta ao cronograma: a seleção guardada reaparece sem precisar
    // ser marcada de novo.
    store.patchObjectSection('cronograma', {
      fases: [faseCom('INSCRICAO', 1), faseCom('HOMOLOGACAO', 2)],
    });
    expect(componente.etapasEfetivas(DOC_ID)).toEqual(['INSCRICAO', 'HOMOLOGACAO']);
  });

  it('recusa documento incluído sem nenhuma etapa efetiva', () => {
    store.patchObjectSection('vagas', { ofertas: [ofertaComModalidade('AC')] });
    store.patchObjectSection('cronograma', { fases: [faseCom('INSCRICAO', 1)] });
    componente.patch(DOC_ID, { included: true, todasEtapas: false, etapas: [] });

    expect(componente.validate()).toEqual({
      valid: false,
      message: 'Todo documento incluído deve ter ao menos uma etapa.',
    });
  });

  it('aceita documento incluído com ao menos uma etapa efetiva', () => {
    store.patchObjectSection('vagas', { ofertas: [ofertaComModalidade('AC')] });
    store.patchObjectSection('cronograma', { fases: [faseCom('INSCRICAO', 1)] });
    componente.patch(DOC_ID, {
      included: true,
      todasEtapas: false,
      etapas: ['INSCRICAO'],
      modalidades: ['AC'],
      modalidadesRecortadas: true,
    });

    expect(componente.validate().valid).toBe(true);
  });
});
