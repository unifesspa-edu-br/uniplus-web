import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EtapaPontuada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { FormulaStepComponent } from './formula.component';

const BASE = 'http://localhost:5000';

function etapaQueCompoeNota(): EtapaPontuada {
  return {
    id: 'etapa-1',
    nome: 'Prova objetiva',
    carater: 'classificatoria',
    tipoEtapaOrigemId: 'tipo-1',
    peso: '1',
    notaMinima: '',
    ordem: 1,
  };
}

describe('FormulaStepComponent', () => {
  let componente: FormulaStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormulaStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CatalogosDeClassificacaoService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FormulaStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  it('recusa sem a regra de cálculo escolhida', () => {
    expect(componente.validate().valid).toBe(false);
  });

  it('sob classificação importada, não exige arredondamento nem casas', () => {
    componente.escolherRegraCalculo('CLASSIFICACAO-IMPORTADA|1.0');
    store.patchObjectSection('classificacao', {
      regraOrdemAlocacaoCodigo: 'ALOCACAO-OPCOES-RN04',
      regraOrdemAlocacaoVersao: '1.0',
      nOpcoesAlocacao: '2',
    });

    expect(componente.validate().valid).toBe(true);
  });

  it('sob fórmula local, exige regra de arredondamento e casas maior que zero', () => {
    componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
    store.patchObjectSection('classificacao', {
      regraOrdemAlocacaoCodigo: 'ALOCACAO-OPCOES-RN04',
      regraOrdemAlocacaoVersao: '1.0',
      nOpcoesAlocacao: '2',
    });

    expect(componente.validate().valid).toBe(false);

    componente.escolherRegraArredondamento('ARRED-TRUNCAR|1.0');
    componente.alterarCasasArredondamento('2');

    expect(componente.validate().valid).toBe(true);
  });

  it('recusa número de opções de alocação diferente de 1 ou 2', () => {
    componente.escolherRegraCalculo('CLASSIFICACAO-IMPORTADA|1.0');
    store.patchObjectSection('classificacao', {
      regraOrdemAlocacaoCodigo: 'ALOCACAO-OPCOES-RN04',
      regraOrdemAlocacaoVersao: '1.0',
      nOpcoesAlocacao: '3',
    });

    expect(componente.validate().valid).toBe(false);
  });

  /**
   * Trocar de ramo de cálculo não apaga o que o operador já digitou do outro
   * lado — só a saída explícita do formulário local zera a exibição do
   * `<select>` de arredondamento, para não sugerir uma escolha que o ramo
   * atual não usa.
   */
  it('some com a escolha de arredondamento ao trocar para classificação importada', () => {
    componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
    componente.escolherRegraArredondamento('ARRED-TRUNCAR|1.0');
    expect(store.draft().classificacao.regraArredondamentoCodigo).toBe('ARRED-TRUNCAR');

    componente.escolherRegraCalculo('CLASSIFICACAO-IMPORTADA|1.0');

    expect(store.draft().classificacao.regraArredondamentoCodigo).toBe('');
  });

  describe('aviso de divisor da média inválido', () => {
    it('não avisa sob classificação importada', () => {
      componente.escolherRegraCalculo('CLASSIFICACAO-IMPORTADA|1.0');
      expect(componente.avisoDeDivisorInvalido()).toBe(false);
    });

    it('avisa sob fórmula local sem etapa que componha a nota', () => {
      componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
      expect(componente.avisoDeDivisorInvalido()).toBe(true);
    });

    it('para de avisar quando o Cronograma declara uma etapa que compõe a nota', () => {
      componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
      store.patchObjectSection('cronograma', { etapas: [etapaQueCompoeNota()] });

      expect(componente.avisoDeDivisorInvalido()).toBe(false);
    });
  });
});
