import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { CaraterEtapa, OrigemCandidatos, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EtapaPontuada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { AcompanhamentoDoCadastroDePesos } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { FormulaStepComponent } from './formula.component';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';

const BASE = 'http://localhost:5000';

function etapaQueCompoeNota(): EtapaPontuada {
  return {
    id: 'etapa-1',
    nome: 'Prova objetiva',
    carater: CaraterEtapa.classificatoria,
    tipoEtapaOrigemId: 'tipo-1',
    peso: '1',
    notaMinima: '',
    ordem: 1,
    faseCodigo: '',
    produtos: [],
    inicio: '',
    fim: '',
    emiteParecerIndividual: false,
    bancas: [],
    recursos: [],
  };
}

describe('FormulaStepComponent', () => {
  let fixture: ComponentFixture<FormulaStepComponent>;
  let componente: FormulaStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormulaStepComponent],
      providers: [
        { provide: PermissoesService, useValue: { tem: () => false } },
        ProcessoSeletivoStore,
        CatalogosDeClassificacaoService,
        AcompanhamentoDoCadastroDePesos,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        // O passo relê o processo só pelo botão do aviso de quadro velho; esta suíte não o aciona.
        { provide: ReleituraDoSnapshot, useValue: { reler: async () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FormulaStepComponent);
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
      regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
      regraOrdemAlocacaoVersao: '1.0',
    });

    expect(componente.validate().valid).toBe(true);
  });

  it('sob fórmula local, exige regra de arredondamento e casas maior que zero', () => {
    componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
    store.patchObjectSection('classificacao', {
      regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
      regraOrdemAlocacaoVersao: '1.0',
    });

    expect(componente.validate().valid).toBe(false);

    componente.escolherRegraArredondamento('ARRED-TRUNCAR|1.0');
    componente.alterarCasasArredondamento('2');

    expect(componente.validate().valid).toBe(true);
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
  describe('escala da nota final', () => {
    const campo = (): HTMLInputElement =>
      (fixture.nativeElement as HTMLElement).querySelector(
        '#f-escala-nota-final',
      ) as HTMLInputElement;
    const erro = (): string | undefined =>
      (fixture.nativeElement as HTMLElement)
        .querySelector('#f-escala-nota-final-erro')
        ?.textContent?.trim();

    function passoValidoComEscala(escala: string): void {
      componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
      componente.escolherRegraArredondamento('ARRED-TRUNCAR|1.0');
      componente.alterarCasasArredondamento('2');
      store.patchObjectSection('classificacao', {
        regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
        regraOrdemAlocacaoVersao: '1.0',
      });
      componente.alterarEscalaNotaFinal(escala);
      fixture.detectChanges();
    }

    it('o campo tem rótulo e dica associados, e o rascunho sem a escala segue válido', () => {
      passoValidoComEscala('');

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('label[for="f-escala-nota-final"]')
          ?.textContent,
      ).toContain('Escala da nota final');
      expect(campo().getAttribute('aria-describedby')).toBe('f-escala-nota-final-dica');
      expect(componente.validate().valid).toBe(true);
    });

    it('sob classificação importada, o campo não aparece e a recusa guardada some', () => {
      passoValidoComEscala('100');
      store.recusaDaEscalaDaNotaFinal.set('Recusa antiga.');

      componente.escolherRegraCalculo('CLASSIFICACAO-IMPORTADA|1.0');
      fixture.detectChanges();

      expect(campo()).toBeNull();
      expect(store.recusaDaEscalaDaNotaFinal()).toBeNull();
    });

    it('o texto que não é número recusa o passo e o erro descreve o campo', () => {
      passoValidoComEscala('cem');

      const validacao = componente.validate();
      fixture.detectChanges();

      expect(validacao.valid).toBe(false);
      expect(campo().getAttribute('aria-invalid')).toBe('true');
      expect(campo().getAttribute('aria-describedby')).toBe(
        'f-escala-nota-final-erro f-escala-nota-final-dica',
      );
      expect(erro()).toContain('Use apenas números');
    });

    it('a recusa da gravação aparece no campo e some quando o valor muda', () => {
      passoValidoComEscala('0');

      store.recusaDaEscalaDaNotaFinal.set(
        'A escala da nota final deve ser um número maior que zero.',
      );
      fixture.detectChanges();
      expect(erro()).toBe('A escala da nota final deve ser um número maior que zero.');
      expect(campo().getAttribute('aria-invalid')).toBe('true');

      componente.alterarEscalaNotaFinal('10');
      fixture.detectChanges();
      expect(erro()).toBeUndefined();
    });

    it('a recusa da escala sobrevive a alternar o ENEM, que não a julgou', () => {
      passoValidoComEscala('0');
      store.recusaDaEscalaDaNotaFinal.set('A escala deve ser maior que zero.');

      componente.alternarBaseadoEmEnem(true);

      expect(store.recusaDaEscalaDaNotaFinal()).toBe('A escala deve ser maior que zero.');
    });

    it('a pendência de publicação aparece no campo vazio e não no preenchido', () => {
      passoValidoComEscala('');
      store.pendenciasDaConferencia.set(['classificacao_escala_nota_final_nao_declarada']);
      fixture.detectChanges();
      expect(erro()).toBe('Declare a escala da nota final para publicar o processo.');

      componente.alterarEscalaNotaFinal('100');
      fixture.detectChanges();
      expect(erro()).toBeUndefined();
    });

    it('em consulta, exibe a faixa da nota final congelada', () => {
      passoValidoComEscala('1000');
      store.remoteSnapshot.set({ status: 'publicado' } as never);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('0 a 1000');
    });
  });

  describe('edições do ENEM aceitas', () => {
    function processoDeInscricaoComEnem(edicoesEnem: readonly string[]): void {
      store.patchObjectSection('identificacao', {
        origemCandidatos: OrigemCandidatos.inscricaoPropria,
      });
      store.patchObjectSection('classificacao', { baseadoEmEnem: true, edicoesEnem });
      fixture.detectChanges();
      for (const requisicao of controller.match(() => true)) requisicao.flush([]);
      fixture.detectChanges();
    }

    const campoDoAno = (): HTMLInputElement =>
      (fixture.nativeElement as HTMLElement).querySelector('#f-edicao-enem') as HTMLInputElement;

    it('sem edição escolhida, o passo é recusado e o campo do ano fica marcado como inválido', () => {
      processoDeInscricaoComEnem([]);

      const validacao = componente.validate();
      fixture.detectChanges();

      expect(validacao.valid).toBe(false);
      expect(validacao.messages).toContain('Escolha ao menos uma edição do ENEM aceita.');
      expect(campoDoAno().getAttribute('aria-invalid')).toBe('true');
    });

    it('a recusa do servidor às edições aparece junto da lista e descreve o campo do ano', () => {
      processoDeInscricaoComEnem(['2026']);

      store.recusaDasEdicoesDoEnem.set('A edição informada não é aceita.');
      fixture.detectChanges();

      const recusa = (fixture.nativeElement as HTMLElement).querySelector('#edicoes-enem-servidor');
      expect(recusa?.textContent?.trim()).toBe('A edição informada não é aceita.');
      expect(campoDoAno().getAttribute('aria-describedby')).toContain('edicoes-enem-servidor');
    });
  });
});
