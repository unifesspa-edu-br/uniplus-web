import { TestBed } from '@angular/core/testing';
import { Step03ModalidadesComponent } from './step-03-modalidades.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { MODALIDADES, MODALIDADES_CANONICAS } from '../../processo-seletivo.data';

describe('Step03ModalidadesComponent', () => {
  let componente: Step03ModalidadesComponent;
  let store: ProcessoSeletivoStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step03ModalidadesComponent],
      providers: [ProcessoSeletivoStore],
    }).compileComponents();

    const fixture = TestBed.createComponent(Step03ModalidadesComponent);
    fixture.detectChanges();
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
  });

  /**
   * A lista tinha 7 entradas e omitia LB_PPI, LB_EP e LI_PcD — sem LB_PPI não
   * dá para configurar Baixa Renda + PPI, cota central da Lei 12.711/2012.
   */
  it('oferece as dez modalidades canônicas', () => {
    expect(MODALIDADES.length).toBe(10);
    expect(MODALIDADES.map((m) => m.code)).toEqual([...MODALIDADES_CANONICAS]);
    expect(MODALIDADES.map((m) => m.code)).toContain('LB_PPI');
  });

  /** O passo 3 gravava id kebab enquanto 7 e 10 gravavam o código canônico. */
  it('grava o código canônico no rascunho', () => {
    componente.toggle('LB_Q', true);

    expect(store.draft().modalidades.selected).toEqual(['LB_Q']);
  });

  /**
   * Marcar uma modalidade de cada vez não pode deixar os documentos presos à
   * primeira: como o padrão é o documento valer para todas as aceitas, ele
   * precisa acompanhar a seleção nos dois sentidos.
   */
  it('mantém os documentos alinhados à seleção conforme ela cresce', () => {
    componente.toggle('AC', true);
    componente.toggle('LB_Q', true);
    componente.toggle('LB_PPI', true);

    const documentos = Object.values(store.draft().documentos);
    expect(documentos.every((config) => config.modalidades.includes('LB_Q'))).toBe(true);
    expect(documentos.every((config) => config.modalidades.includes('LB_PPI'))).toBe(true);
    expect(documentos.every((config) => config.modalidades.length === 3)).toBe(true);
  });

  it('esvazia os documentos quando nada está selecionado', () => {
    componente.toggle('AC', true);
    componente.toggle('AC', false);

    const documentos = Object.values(store.draft().documentos);
    expect(documentos.every((config) => config.modalidades.length === 0)).toBe(true);
  });

  /**
   * Sem a sincronização, desmarcar aqui deixava a modalidade configurada no
   * bônus e nos documentos — rascunho com exigência para modalidade que o
   * processo não aceita.
   */
  it('remove do bônus e dos documentos a modalidade desmarcada', () => {
    componente.toggle('LB_Q', true);
    componente.toggle('AC', true);
    store.patchObjectSection('bonus', { modalidades: ['LB_Q', 'AC'] });

    componente.toggle('LB_Q', false);

    expect(store.draft().bonus.modalidades).toEqual(['AC']);
    const documentos = Object.values(store.draft().documentos);
    expect(documentos.every((config) => !config.modalidades.includes('LB_Q'))).toBe(true);
  });

  it('exige ao menos uma modalidade para avançar', () => {
    expect(componente.validate().valid).toBe(false);

    componente.toggle('AC', true);
    expect(componente.validate().valid).toBe(true);
  });
});
