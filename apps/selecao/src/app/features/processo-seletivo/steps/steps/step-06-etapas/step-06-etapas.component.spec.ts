import { TestBed } from '@angular/core/testing';
import { Step06EtapasComponent } from './step-06-etapas.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

describe('Step06EtapasComponent', () => {
  let componente: Step06EtapasComponent;
  let store: ProcessoSeletivoStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step06EtapasComponent],
      providers: [ProcessoSeletivoStore],
    }).compileComponents();

    const fixture = TestBed.createComponent(Step06EtapasComponent);
    fixture.detectChanges();
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
  });

  /**
   * Datas predefinidas passam na validação sem o operador confirmar nada — e
   * um intervalo fixo de 2026 envelhece já no ciclo seguinte.
   */
  it('cria etapa sem datas predefinidas', () => {
    componente.add();

    const nova = store.draft().etapas.at(-1);
    expect(nova?.inicio).toBe('');
    expect(nova?.fim).toBe('');
  });

  it('recusa etapa sem tipo e sem datas', () => {
    componente.add();

    const resultado = componente.validate();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.length).toBeGreaterThan(0);
  });

  it('recusa fim anterior ao início', () => {
    const [primeira] = store.draft().etapas;
    componente.update(primeira.id, {
      tipo: 'INSCRICAO_CANDIDATOS',
      inicio: '2026-03-10',
      fim: '2026-03-01',
    });

    const resultado = componente.validate();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('anterior ao início'))).toBe(true);
  });

  it('não move além dos extremos da lista', () => {
    const antes = store.draft().etapas.map((etapa) => etapa.id);

    componente.move(0, -1);

    expect(store.draft().etapas.map((etapa) => etapa.id)).toEqual(antes);
  });
});
