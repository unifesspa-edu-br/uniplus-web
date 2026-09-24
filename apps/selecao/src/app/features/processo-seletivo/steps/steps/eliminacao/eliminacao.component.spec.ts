import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProblemI18nService, apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { SELECAO_BASE_PATH, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EtapaPontuada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { EliminacaoStepComponent } from './eliminacao.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_CLASSIFICACAO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/classificacao`;
const RESOLUCAO = 'Resolução nº 805/2024/Consepe';
const ROTA_DETALHE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;

/** O detalhe relido depois de gravar, com o quadro que o servidor acabou de congelar. */
function detalheCom(resolucao: string, peso: number) {
  return {
    id: PROCESSO_ID,
    classificacao: {
      resolucaoPesoAreaEnem: resolucao,
      quadroPesoAreaEnem: [
        {
          grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
          baseLegal: `${resolucao} – Anexo I`,
          areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso, corte: 400 }],
        },
      ],
    },
  };
}

/** Deixa a gravação chegar à releitura do detalhe, que só sai depois de o PUT responder. */
function aguardarReleitura(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

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
        ReleituraDoSnapshot,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
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
        resolucaoPesoAreaEnem: RESOLUCAO,
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
        resolucaoPesoAreaEnem: RESOLUCAO,
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

    it('envia a resolução de Peso por Área quando a classificação a exige', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_CLASSIFICACAO);
      expect(requisicao.request.body).toMatchObject({
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      controller.expectOne(ROTA_DETALHE).flush(detalheCom(RESOLUCAO, 2));
      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('depois de gravar, relê o que o processo congelou para a Fórmula mostrar a cópia nova', async () => {
      prepararClassificacaoLocal();
      store.registrarClassificacaoLida(
        (detalheCom('Resolução antiga', 1) as unknown as ProcessoSeletivoDto).classificacao,
      );
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      controller.expectOne(ROTA_DETALHE).flush(detalheCom(RESOLUCAO, 3));
      await gravacao;

      const congelado = store.quadroPesoAreaEnemCongelado();
      expect(congelado?.resolucao).toBe(RESOLUCAO);
      expect(congelado?.quadro[0].areas[0].peso).toBe(3);
      expect(store.quadroPesoAreaEnemDesatualizado()).toBe(false);
    });

    it('uma rejeição fora do envelope na releitura não desfaz a gravação que deu certo', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      const cadastro = TestBed.inject(CadastroInicialService);
      vi.spyOn(cadastro, 'obterDetalhe').mockRejectedValue(new Error('falha fora do envelope'));

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });

      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.quadroPesoAreaEnemDesatualizado()).toBe(true);
    });

    it('editor superado durante a releitura não relata a gravação como concluída', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      store.geracao.update((valor) => valor + 1);
      controller.expectOne(ROTA_DETALHE).flush(detalheCom(RESOLUCAO, 3));

      await expect(gravacao).resolves.toEqual({ valid: false, messages: [] });
    });

    it('na varredura da publicação não relê o detalhe, que a publicação relê no fim', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      store.travamentoDeOrquestracao.set(true);

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();

      expect(controller.match(ROTA_DETALHE)).toHaveLength(0);
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.quadroPesoAreaEnemDesatualizado()).toBe(true);
    });

    it('a releitura que começou antes da gravação não decide sobre o que a gravação copiou', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      const antiga = TestBed.inject(ReleituraDoSnapshot).reler();
      const leituraAntiga = controller.expectOne(ROTA_DETALHE);
      store.travamentoDeOrquestracao.set(true);

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await gravacao;
      leituraAntiga.flush(detalheCom('Resolução antiga', 1));

      await expect(antiga).resolves.toBe(false);
      expect(store.quadroPesoAreaEnemCongelado()).toBeNull();
      expect(store.quadroPesoAreaEnemDesatualizado()).toBe(true);
    });

    it('sem resolução antes e depois da gravação, não relê o detalhe e não herda marca velha', async () => {
      prepararClassificacaoLocal();
      store.quadroPesoAreaEnemDesatualizado.set(true);

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();

      expect(controller.match(ROTA_DETALHE)).toHaveLength(0);
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.quadroPesoAreaEnemDesatualizado()).toBe(false);
    });

    it('marca o quadro congelado como desatualizado quando a releitura falha', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      controller
        .expectOne(ROTA_DETALHE)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.quadroPesoAreaEnemDesatualizado()).toBe(true);
    });

    it('não grava a classificação baseada em ENEM sem a resolução, e aponta o passo Fórmula', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', { baseadoEmEnem: true });

      const resultado = await componente.persistir();

      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('resolução de Peso por Área');
      expect(resultado.messages?.join(' ')).toContain('passo Fórmula');
      controller.verify();
    });

    it('guarda a recusa do servidor à resolução para o passo Fórmula e a nomeia no resumo', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          // A raiz traz como título o do primeiro erro de campo — o mesmo da resolução.
          title: 'A resolução de Pesos por Área não tem pesos para todos os grupos de área',
          status: 422,
          code: 'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_incompleta',
          traceId: 'trace-1',
          errors: [
            {
              field: 'resolucaoPesoAreaEnem',
              code: 'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_incompleta',
              message: 'A resolução não tem o grupo Saúde e Biológicas.',
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );

      const resultado = await gravacao;
      const esperada =
        'A resolução escolhida não tem pesos cadastrados para todos os grupos de área. Complete-a no cadastro de Peso por Área ou escolha outra.';
      expect(resultado.valid).toBe(false);
      // O texto é o da tela para o código, e não o `message` que o servidor mandou — e a falha
      // aparece uma vez só, sem o título da raiz, que diria o mesmo.
      expect(resultado.messages).toEqual([
        `Resolução de Peso por Área, no passo Fórmula: ${esperada}`,
      ]);
      expect(store.recusaDaResolucaoPesoAreaEnem()).toBe(esperada);
    });

    it('recusas iguais da resolução aparecem uma vez só no resumo', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      const recusa = {
        field: 'resolucaoPesoAreaEnem',
        code: 'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_invalida',
        message: 'x',
      };

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'Resolução inválida.',
          status: 422,
          code: recusa.code,
          traceId: 'trace-1',
          errors: [recusa, { ...recusa, field: '$.resolucaoPesoAreaEnem' }],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );

      const resultado = await gravacao;
      expect(resultado.messages).toHaveLength(1);
    });

    it('uma recusa que não traz erro da resolução mantém a recusa guardada dela', async () => {
      prepararClassificacaoLocal();
      store.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'Campos inválidos.',
          status: 422,
          code: 'uniplus.selecao.validacao',
          traceId: 'trace-1',
          errors: [
            {
              field: 'casasArredondamento',
              code: 'uniplus.selecao.configuracao_classificacao.casas_arredondamento_obrigatorio',
              message: 'As casas decimais de arredondamento são obrigatórias.',
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );

      const resultado = await gravacao;
      expect(store.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa anterior.');
      expect(resultado.messages).toEqual(['Campos inválidos.']);
    });

    it('com a recusa da resolução, avisa também da recusa em outro campo pelo título traduzido', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      TestBed.inject(ProblemI18nService).register('uniplus.selecao.validacao', {
        title: 'A classificação tem campos a corrigir.',
      });

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'Campos inválidos.',
          status: 422,
          code: 'uniplus.selecao.validacao',
          traceId: 'trace-1',
          errors: [
            {
              field: 'resolucaoPesoAreaEnem',
              code: 'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_incompleta',
              message: 'x',
            },
            {
              field: 'casasArredondamento',
              code: 'uniplus.selecao.configuracao_classificacao.casas_arredondamento_obrigatorio',
              message: 'As casas decimais de arredondamento são obrigatórias.',
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );

      const resultado = await gravacao;
      expect(resultado.messages).toEqual([
        'Resolução de Peso por Área, no passo Fórmula: A resolução escolhida não tem pesos cadastrados para todos os grupos de área. Complete-a no cadastro de Peso por Área ou escolha outra.',
        'A classificação tem campos a corrigir.',
      ]);
    });

    it('falha inconclusiva sem resolução, nem enviada nem congelada, não marca o quadro como velho', async () => {
      prepararClassificacaoLocal();

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      await gravacao;

      expect(store.quadroPesoAreaEnemDesatualizado()).toBe(false);
    });

    it('falha inconclusiva: o servidor pode ter gravado, e o quadro congelado fica marcado como velho', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect((await gravacao).valid).toBe(false);
      expect(store.quadroPesoAreaEnemDesatualizado()).toBe(true);
    });

    it('usa um texto genérico para a recusa de código que a tela não conhece', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'A requisição tem campos inválidos.',
          status: 422,
          code: 'uniplus.selecao.validacao',
          traceId: 'trace-1',
          errors: [
            { field: 'resolucaoPesoAreaEnem', code: 'uniplus.selecao.codigo_novo', message: 'x' },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );

      await gravacao;
      expect(store.recusaDaResolucaoPesoAreaEnem()).toBe(
        'O servidor recusou a resolução de Peso por Área escolhida. Confira o cadastro de Peso por Área ou escolha outra.',
      );
    });

    it('mantém a recusa guardada quando a falha seguinte não julgou a resolução', async () => {
      prepararClassificacaoLocal();
      store.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(store.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa anterior.');
    });

    it('não grava a resolução que o cadastro lido já não tem', async () => {
      TestBed.inject(CatalogosDeClassificacaoService).garantirPesosAreaEnem(0);
      controller
        .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
        .flush([]);
      controller
        .expectOne((requisicao) =>
          requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'),
        )
        .flush([]);
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      // Responde o que tiver saído, para o teste falhar pela asserção e não por espera.
      const pedidos = controller.match(ROTA_CLASSIFICACAO);
      for (const pedido of pedidos) pedido.flush(null, { status: 204, statusText: 'No Content' });
      const resultado = await gravacao;

      expect(pedidos).toHaveLength(0);
      expect(resultado.valid).toBe(false);
      expect(resultado.messages).toContain(
        'A resolução de Peso por Área escolhida não está no cadastro lido. Se ela foi criada ou corrigida agora, use "Atualizar lista" no passo Fórmula; senão, escolha outra.',
      );
    });

    it('limpa a recusa guardada quando a gravação seguinte dá certo', async () => {
      prepararClassificacaoLocal();
      store.recusaDaResolucaoPesoAreaEnem.set('Recusa antiga.');

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });

      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.recusaDaResolucaoPesoAreaEnem()).toBeNull();
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

    it('mostra a resolução de Peso por Área que será gravada', () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const item = componente
        .confirmacaoDeGravacao()
        ?.itens.find((linha) => linha.rotulo === 'Resolução de Peso por Área');

      expect(item?.valor).toBe(RESOLUCAO);
    });
  });
});
