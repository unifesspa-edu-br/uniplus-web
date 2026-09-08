import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EtapaPontuada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { EliminacaoStepComponent } from './eliminacao.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_CLASSIFICACAO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/classificacao`;

const ETAPA_PERSISTIDA: EtapaPontuada = {
  id: 'etapa-1',
  nome: 'Prova objetiva',
  carater: 'classificatoria',
  tipoEtapaOrigemId: 'tipo-1',
  peso: '1',
  notaMinima: '',
  ordem: 1,
};

describe('EliminacaoStepComponent', () => {
  let componente: EliminacaoStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EliminacaoStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        CatalogosDeClassificacaoService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EliminacaoStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
    fixture.detectChanges();

    store.processoSeletivoId.set(PROCESSO_ID);
    store.patchObjectSection('cronograma', { etapas: [ETAPA_PERSISTIDA] });
  });

  afterEach(() => controller.verify());

  /** Base local completa e válida — cada teste desvia dela para provocar uma recusa. */
  function prepararClassificacaoLocal(): void {
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
      regraCalculoVersao: '1.0',
      regraArredondamentoCodigo: 'ARRED-TRUNCAR',
      regraArredondamentoVersao: '1.0',
      casasArredondamento: '2',
      regraOrdemAlocacaoCodigo: 'ALOCACAO-OPCOES-RN04',
      regraOrdemAlocacaoVersao: '1.0',
      nOpcoesAlocacao: '2',
      baseadoEmEnem: false,
      regrasEliminacao: [],
    });
  }

  it('recusa sem a regra de cálculo escolhida no passo Fórmula', () => {
    expect(componente.validate().valid).toBe(false);
  });

  it('sob classificação importada, ainda exige ordem de alocação e número de opções', () => {
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
      regraCalculoVersao: '1.0',
    });

    // Regra de cálculo escolhida, mas o restante do passo Fórmula não — o
    // wizard navega livremente, e a Eliminação grava o comando inteiro.
    expect(componente.validate().valid).toBe(false);
  });

  it('sob classificação importada com Fórmula completa, ignora regras de eliminação e valida', () => {
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
      regraCalculoVersao: '1.0',
      regraOrdemAlocacaoCodigo: 'ALOCACAO-OPCOES-RN04',
      regraOrdemAlocacaoVersao: '1.0',
      nOpcoesAlocacao: '2',
    });

    expect(componente.validate().valid).toBe(true);
  });

  it('recusa quando a Fórmula não declarou a ordem de alocação, mesmo com o restante completo', () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      regraOrdemAlocacaoCodigo: '',
      regraOrdemAlocacaoVersao: '',
    });

    const resultado = componente.validate();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('ordem de alocação');
  });

  it('recusa quando a Fórmula não declarou o número de opções de curso', () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', { nOpcoesAlocacao: '' });

    const resultado = componente.validate();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('número de opções');
  });

  it('recusa sob fórmula local sem nenhuma etapa que componha a nota', () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('cronograma', { etapas: [] });

    const resultado = componente.validate();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('compõe a nota');
  });

  describe('ELIM-NOTA-MINIMA-ETAPA — exige etapaRef e notaMinima', () => {
    beforeEach(() => prepararClassificacaoLocal());

    it('recusa sem etapaRef nem notaMinima', () => {
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
            regraVersao: '1.0',
            etapaRef: '',
            notaMinima: '',
            minimo: '',
          },
        ],
      });

      expect(componente.validate().valid).toBe(false);
    });

    it('recusa quando a etapa referenciada não existe mais no cronograma', () => {
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
            regraVersao: '1.0',
            etapaRef: 'etapa-removida',
            notaMinima: '5',
            minimo: '',
          },
        ],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('não existe mais');
    });

    it('aceita com etapaRef existente e notaMinima informada', () => {
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
            regraVersao: '1.0',
            etapaRef: 'etapa-1',
            notaMinima: '5',
            minimo: '',
          },
        ],
      });

      expect(componente.validate().valid).toBe(true);
    });
  });

  describe('ELIM-CORTE-REDACAO — exige minimo e baseadoEmEnem', () => {
    beforeEach(() => prepararClassificacaoLocal());

    it('recusa sem baseadoEmEnem, mesmo com minimo informado', () => {
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-CORTE-REDACAO',
            regraVersao: '1.0',
            etapaRef: '',
            notaMinima: '',
            minimo: '400',
          },
        ],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('baseada em ENEM');
    });

    it('aceita com minimo informado e baseadoEmEnem verdadeiro', () => {
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-CORTE-REDACAO',
            regraVersao: '1.0',
            etapaRef: '',
            notaMinima: '',
            minimo: '400',
          },
        ],
      });

      expect(componente.validate().valid).toBe(true);
    });
  });

  describe('ELIM-ZERO-EM-AREA — não usa argumento', () => {
    beforeEach(() => prepararClassificacaoLocal());

    it('recusa sem baseadoEmEnem — a exigência não é exclusiva de ELIM-CORTE-REDACAO', () => {
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-ZERO-EM-AREA',
            regraVersao: '1.0',
            etapaRef: '',
            notaMinima: '',
            minimo: '',
          },
        ],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('baseada em ENEM');
    });

    it('aceita sem etapaRef, notaMinima nem minimo, desde que baseadoEmEnem', () => {
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-ZERO-EM-AREA',
            regraVersao: '1.0',
            etapaRef: '',
            notaMinima: '',
            minimo: '',
          },
        ],
      });

      expect(componente.validate().valid).toBe(true);
    });
  });

  describe('persistir()', () => {
    it('recusa sem processo criado', async () => {
      store.processoSeletivoId.set(null);
      const resultado = await componente.persistir();
      expect(resultado.valid).toBe(false);
    });

    it('não chama a API quando a validação recusa', async () => {
      const resultado = await componente.persistir();
      expect(resultado.valid).toBe(false);
      controller.verify();
    });

    it('grava o comando inteiro, com null explícito nos campos não aplicáveis', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
            regraVersao: '1.0',
            etapaRef: 'etapa-1',
            notaMinima: '5',
            minimo: '',
          },
        ],
      });

      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_CLASSIFICACAO);
      expect(requisicao.request.method).toBe('PUT');
      expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(requisicao.request.body).toMatchObject({
        regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
        regraArredondamentoCodigo: 'ARRED-TRUNCAR',
        casasArredondamento: 2,
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
            etapaRef: 'etapa-1',
            notaMinima: 5,
            minimo: null,
          },
        ],
      });

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('preserva o rascunho quando a API recusa', async () => {
      prepararClassificacaoLocal();
      const gravacao = componente.persistir();

      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'Regra não encontrada.',
          status: 422,
          code: 'ConfiguracaoClassificacao.RegraNaoEncontrada',
          traceId: 'trace-1',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(store.draft().classificacao.regraCalculoCodigo).toBe('FORMULA-MEDIA-PONDERADA');
      expect(store.salvando()).toBe(false);
    });
  });

  describe('confirmacaoDeGravacao()', () => {
    it('devolve null quando a configuração ainda é inválida', () => {
      expect(componente.confirmacaoDeGravacao()).toBeNull();
    });

    it('resume o que será gravado quando válida', () => {
      prepararClassificacaoLocal();

      const confirmacao = componente.confirmacaoDeGravacao();

      expect(confirmacao).not.toBeNull();
      expect(confirmacao?.itens.map((item) => item.rotulo)).toContain('Regra de cálculo');
    });
  });
});
