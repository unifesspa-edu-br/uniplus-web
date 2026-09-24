import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProblemI18nService, apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import {
  SELECAO_BASE_PATH,
  StatusProcesso,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EtapaPontuada, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { AcompanhamentoDoCadastroDePesos } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
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
  let fixture: ComponentFixture<EliminacaoStepComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EliminacaoStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        CatalogosDeClassificacaoService,
        AcompanhamentoDoCadastroDePesos,
        ReleituraDoSnapshot,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EliminacaoStepComponent);
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

  function linhaDoCadastro(peso: number) {
    return {
      id: 'g',
      resolucao: RESOLUCAO,
      grupoCurso: { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
      areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso, corte: null }],
      baseLegal: 'Anexo I',
      criadoEm: '2026-09-01T00:00:00Z',
    };
  }

  /** O cadastro de Peso por Área lido, com a resolução no peso informado. */
  function lerCadastroComPeso(peso: number): void {
    TestBed.inject(CatalogosDeClassificacaoService).garantirPesosAreaEnem(0);
    controller
      .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
      .flush([linhaDoCadastro(peso)]);
    controller
      .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'))
      .flush([]);
  }

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
            areaCodigo: '',
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
            areaCodigo: '',
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
            areaCodigo: '',
          },
        ],
      });

      expect(componente.validate().valid).toBe(true);
    });
  });

  describe('ELIM-CORTE-EM-AREA — área do quadro e mínimo', () => {
    const CORTE = {
      regraCodigo: 'ELIM-CORTE-EM-AREA',
      regraVersao: 'v1',
      etapaRef: '',
      notaMinima: '',
      minimo: '',
      areaCodigo: '',
    };

    /** Classificação ENEM pela média ponderada, com o cadastro da resolução lido. */
    function comCadastroLido(corte: number | null = null): void {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      TestBed.inject(CatalogosDeClassificacaoService).garantirPesosAreaEnem(0);
      controller
        .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
        .flush([
          {
            ...linhaDoCadastro(1),
            areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte }],
          },
        ]);
      controller
        .expectOne((requisicao) =>
          requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'),
        )
        .flush([
          { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
          { codigo: 'REDACAO', rotulo: 'Redação' },
        ]);
    }

    it('recusa sem baseadoEmEnem, mesmo com área e mínimo informados', () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('baseada em ENEM');
    });

    it('recusa sem a área', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, minimo: '400' }],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('selecione a área do ENEM');
    });

    it('aceita a área que está em todos os grupos do quadro, com o mínimo informado', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }],
      });

      expect(componente.validate()).toEqual({ valid: true });
    });

    it('recusa a área que o quadro da resolução não tem em todos os grupos', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'MATEMATICA', minimo: '400' }],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain(
        'Matemática e suas Tecnologias não está em todos os grupos',
      );
    });

    it('recusa dois cortes na mesma área e aponta a segunda regra', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [
          { ...CORTE, areaCodigo: 'REDACAO', minimo: '400' },
          { ...CORTE, areaCodigo: 'REDACAO', minimo: '500' },
        ],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages).toContain(
        'Regra de eliminação 2: Redação já tem um corte em outra regra.',
      );
    });

    it('não oferece a área que outro corte já cita', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }, CORTE],
      });

      expect(componente.areasEscolhiveis(1).map((area) => area.codigo)).not.toContain('REDACAO');
      expect(componente.areasEscolhiveis(0).map((area) => area.codigo)).toContain('REDACAO');
    });

    it('sugere o corte da área no quadro quando o mínimo está vazio', () => {
      comCadastroLido(450);
      store.patchObjectSection('classificacao', { regrasEliminacao: [CORTE] });

      componente.escolherArea(0, 'REDACAO');

      expect(store.draft().classificacao.regrasEliminacao[0]).toMatchObject({
        areaCodigo: 'REDACAO',
        minimo: '450',
      });
    });

    /** O cadastro com Redação (corte 450) e Matemática (corte 300) em todos os grupos. */
    function comDuasAreasComCorte(): void {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      TestBed.inject(CatalogosDeClassificacaoService).garantirPesosAreaEnem(0);
      controller
        .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
        .flush([
          {
            ...linhaDoCadastro(1),
            areas: [
              { codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: 450 },
              { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias', peso: 1, corte: 300 },
            ],
          },
        ]);
      controller
        .expectOne((requisicao) =>
          requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'),
        )
        .flush([
          { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
          { codigo: 'REDACAO', rotulo: 'Redação' },
        ]);
    }

    it('trocar de área troca o mínimo que veio da sugestão da área anterior', () => {
      comDuasAreasComCorte();
      store.patchObjectSection('classificacao', { regrasEliminacao: [CORTE] });

      componente.escolherArea(0, 'REDACAO');
      componente.escolherArea(0, 'MATEMATICA');

      expect(store.draft().classificacao.regrasEliminacao[0]).toMatchObject({
        areaCodigo: 'MATEMATICA',
        minimo: '300',
      });
    });

    it('trocar de área preserva o mínimo que o operador digitou', () => {
      comDuasAreasComCorte();
      store.patchObjectSection('classificacao', { regrasEliminacao: [CORTE] });

      componente.escolherArea(0, 'REDACAO');
      componente.alterarMinimo(0, '500');
      componente.escolherArea(0, 'MATEMATICA');

      expect(store.draft().classificacao.regrasEliminacao[0].minimo).toBe('500');
    });

    it('não troca o mínimo que o operador já informou pelo corte do quadro', () => {
      comCadastroLido(450);
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, minimo: '380' }],
      });

      componente.escolherArea(0, 'REDACAO');

      expect(store.draft().classificacao.regrasEliminacao[0].minimo).toBe('380');
    });

    it('dá ao mínimo o rótulo completo, com a área, e liga a sugestão ao campo', () => {
      comCadastroLido(450);
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '450' }],
      });
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('label[for="elim-minimo-0"]')?.textContent?.trim()).toBe(
        'Nota mínima em Redação',
      );
      const minimo = raiz.querySelector('#elim-minimo-0');
      const dica = raiz.querySelector(`#${minimo?.getAttribute('aria-describedby') ?? 'ausente'}`);
      expect(dica?.textContent).toContain('corte 450');
    });

    it('com a cópia congelada em vigor e sem cadastro lido, mostra a área gravada e o corte do quadro', () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '450' }],
      });
      store.classificacaoGravada.set({
        estado: 'com-quadro',
        resolucao: RESOLUCAO,
        confirmada: true,
        grupos: [
          {
            codigo: 'TECNOLOGICA',
            rotulo: 'Tecnológica',
            baseLegal: 'Anexo I',
            areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: 450 }],
          },
        ],
      });
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      const area = raiz.querySelector<HTMLSelectElement>('#elim-area-0');
      expect(area?.value).toBe('REDACAO');
      expect(area?.selectedOptions[0]?.textContent?.trim()).toBe('Redação');
      expect(raiz.querySelector('#elim-area-dica-0')).toBeNull();
      expect(raiz.querySelector('#elim-minimo-dica-0')?.textContent).toContain('corte 450');
      expect(raiz.querySelector('label[for="elim-minimo-0"]')?.textContent?.trim()).toBe(
        'Nota mínima em Redação',
      );
    });

    /** A cópia gravada de R1: só Matemática em todos os grupos, com corte 300. */
    function gravadaComMatematica(resolucao = RESOLUCAO): void {
      store.classificacaoGravada.set({
        estado: 'com-quadro',
        resolucao,
        confirmada: true,
        grupos: [
          {
            codigo: 'TECNOLOGICA',
            rotulo: 'Tecnológica',
            baseLegal: 'Anexo I',
            areas: [
              {
                codigo: 'MATEMATICA',
                rotulo: 'Matemática e suas Tecnologias',
                peso: 1,
                corte: 300,
              },
            ],
          },
        ],
      });
    }

    it('com outra resolução no rascunho, confere contra o quadro que a gravação vai copiar', () => {
      comCadastroLido(450);
      gravadaComMatematica('Resolução anterior');

      expect(componente.areasDoCorte()?.map((area) => area.codigo)).toEqual(['REDACAO']);
    });

    it('com o cadastro da mesma resolução alterado, vale o cadastro, não a cópia gravada', () => {
      comCadastroLido(450);
      gravadaComMatematica();

      expect(componente.areasDoCorte()?.map((area) => area.codigo)).toEqual(['REDACAO']);
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO' }],
      });
      expect(componente.corteSugerido(componente.regras()[0])).toBe(450);
    });

    it('com o rascunho fora da média ponderada do ENEM, oferece qualquer área, mesmo com cópia gravada', () => {
      comCadastroLido();
      gravadaComMatematica();
      store.patchObjectSection('classificacao', { baseadoEmEnem: false });

      expect(componente.areasDoCorte()?.map((area) => area.codigo)).toEqual([
        'MATEMATICA',
        'REDACAO',
      ]);
    });

    it('sem o cadastro lido, a cópia gravada de outra resolução não decide', () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      gravadaComMatematica('Resolução anterior');

      expect(componente.areasDoCorte()).toBeNull();
    });

    it('mostra a área gravada no seletor mesmo fora das áreas oferecidas', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'MATEMATICA', minimo: '400' }],
      });

      expect(componente.areasEscolhiveis(0).map((area) => area.codigo)).toContain('MATEMATICA');
    });

    it('põe a recusa do servidor junto do campo, com aria-invalid, e a tira quando a regra muda', async () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }],
      });

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'Recusada.',
          status: 422,
          code: 'uniplus.validacao',
          traceId: 't',
          errors: [
            {
              field: 'regrasEliminacao[0]',
              code: 'uniplus.selecao.configuracao_classificacao.corte_em_area_repetido',
              message: 'repetido',
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      await gravacao;
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      const area = raiz.querySelector('#elim-area-0');
      expect(area?.getAttribute('aria-invalid')).toBe('true');
      expect(area?.getAttribute('aria-describedby')).toContain('elim-area-erro-0');
      expect(raiz.querySelector('#elim-area-erro-0')?.textContent).toContain('já tem um corte');
      expect(raiz.querySelector('#elim-minimo-0')?.getAttribute('aria-invalid')).toBeNull();

      componente.alterarMinimo(0, '410');
      fixture.detectChanges();
      expect(raiz.querySelector('#elim-area-erro-0')).toBeNull();
    });

    it('traduz a recusa do servidor ao corte fora do quadro, nomeando a regra', async () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }],
      });

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'Recusada.',
          status: 422,
          code: 'uniplus.validacao',
          traceId: 't',
          errors: [
            {
              field: 'regrasEliminacao[0].areaCodigo',
              code: 'uniplus.selecao.configuracao_classificacao.corte_em_area_fora_do_quadro',
              message: 'fora',
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

      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.[0]).toMatch(
        /^Regra de eliminação 1: a área não está em todos os grupos/,
      );
    });
  });

  describe('ELIM-ZERO-EM-AREA — não usa argumento', () => {
    beforeEach(() => prepararClassificacaoLocal());

    it('recusa sem baseadoEmEnem — a exigência não é exclusiva do corte por área', () => {
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [
          {
            regraCodigo: 'ELIM-ZERO-EM-AREA',
            regraVersao: '1.0',
            etapaRef: '',
            notaMinima: '',
            minimo: '',
            areaCodigo: '',
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
            areaCodigo: '',
          },
        ],
      });

      expect(componente.validate().valid).toBe(true);
    });
  });

  describe('critério de desempate que compara a nota de área do ENEM', () => {
    const CRITERIO_POR_AREA = {
      regraCodigo: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM',
      regraVersao: '1',
      etapaRef: '',
      idadeMinima: '',
      fato: '',
      operador: '',
      valor: '',
      areas: ['REDACAO', 'MATEMATICA'],
    };

    function lerCadastro(areasDaSaude: unknown[]): void {
      TestBed.inject(CatalogosDeClassificacaoService).garantirPesosAreaEnem(0);
      const grupo = (codigo: string, areas: unknown[]) => ({
        id: codigo,
        resolucao: RESOLUCAO,
        grupoCurso: { codigo, rotulo: codigo },
        areas,
        baseLegal: 'Anexo I',
        criadoEm: '2026-09-01T00:00:00Z',
      });
      controller
        .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
        .flush([
          grupo('TECNOLOGICA', [
            { codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null },
            { codigo: 'MATEMATICA', rotulo: 'Matemática', peso: 1, corte: null },
          ]),
          grupo('SAUDE_E_BIOLOGICAS', areasDaSaude),
        ]);
      controller
        .expectOne((requisicao) =>
          requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'),
        )
        .flush([{ codigo: 'LINGUAGENS', rotulo: 'Linguagens' }]);
    }

    function classificacaoPeloEnem(): void {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
    }

    /** Responde a gravação e a releitura, se saírem: a conferência recusada não chama a API. */
    async function gravar(): Promise<StepValidation> {
      const gravacao = componente.persistir();
      for (const pedido of controller.match(ROTA_CLASSIFICACAO)) {
        pedido.flush(null, { status: 204, statusText: 'No Content' });
      }
      await aguardarReleitura();
      for (const pedido of controller.match(ROTA_DETALHE)) {
        pedido.flush(detalheCom(RESOLUCAO, 2));
      }
      return gravacao;
    }

    it('recusa gravar a classificação sem ENEM, que deixaria o critério gravado sem a nota de área', async () => {
      prepararClassificacaoLocal();
      store.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);

      const resultado = await gravar();

      expect(resultado).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1 gravado: compara a nota de área do ENEM, que só existe com a classificação baseada no ENEM pela média ponderada. Troque a regra do critério ou remova-o no passo Desempate e grave o passo, ou marque o ENEM e a média ponderada no passo Fórmula.',
        ],
      });
      controller.expectNone(ROTA_CLASSIFICACAO);
    });

    it('uma tecla em outro passo não refaz a conferência do desempate gravado', () => {
      lerCadastro([{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }]);
      classificacaoPeloEnem();
      store.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
      const antes = componente.avisoDoDesempatePorArea();

      store.patchObjectSection('identificacao', { nome: 'Processo de teste' });

      expect(componente.avisoDoDesempatePorArea()).toBe(antes);
    });

    it('pelo cadastro lido, só avisa da área que a resolução não tem em todos os grupos, e deixa o servidor julgar', async () => {
      lerCadastro([{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }]);
      classificacaoPeloEnem();
      store.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);

      const aviso = `Pelo cadastro de Peso por Área lido, o critério de desempate 1 gravado cita Matemática, que a resolução ${RESOLUCAO} não tem em todos os grupos, e a gravação deve ser recusada: retire a área no passo Desempate e grave o passo, ou escolha outra resolução no passo Fórmula. Se o cadastro mudou, atualize a lista.`;
      expect(componente.avisoDoDesempatePorArea()).toEqual([aviso]);
      expect(componente.confirmacaoDeGravacao()?.aviso).toContain(aviso);
      // O cadastro lido pode estar velho: a gravação vai ao servidor.
      await expect(gravar()).resolves.toEqual({ valid: true });
    });

    it('só para consulta, não avisa de gravação nenhuma', () => {
      lerCadastro([{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }]);
      classificacaoPeloEnem();
      store.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);

      expect(componente.avisoDoDesempatePorArea()).toEqual([]);
    });

    it('"Atualizar lista" do aviso relê o cadastro', () => {
      lerCadastro([{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }]);
      classificacaoPeloEnem();
      store.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('#elim-atualizar-cadastro')
        ?.click();

      controller
        .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
        .flush([]);
    });

    it('grava a resolução que tem as áreas citadas em todos os grupos', async () => {
      lerCadastro([
        { codigo: 'MATEMATICA', rotulo: 'Matemática', peso: 1, corte: null },
        { codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null },
      ]);
      classificacaoPeloEnem();
      store.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);

      await expect(gravar()).resolves.toEqual({ valid: true });
    });

    it('não confere o critério que só está no rascunho: o servidor confere o gravado', async () => {
      prepararClassificacaoLocal();
      store.patchSection('desempate', [CRITERIO_POR_AREA]);

      await expect(gravar()).resolves.toEqual({ valid: true });
    });

    it('não abre a confirmação de uma gravação que já se sabe recusada', () => {
      prepararClassificacaoLocal();
      expect(componente.confirmacaoDeGravacao()).not.toBeNull();

      store.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);

      expect(componente.confirmacaoDeGravacao()).toBeNull();
    });

    it('sem saber o que está gravado, deixa o servidor decidir', async () => {
      prepararClassificacaoLocal();
      // O rascunho do desempate não é o que o servidor tem, e não serve de substituto.
      store.patchSection('desempate', [CRITERIO_POR_AREA]);
      store.criteriosDesempateGravados.set(null);

      await expect(gravar()).resolves.toEqual({ valid: true });
    });

    it('com todas as áreas do critério fora, orienta a trocar a regra ou remover o critério', async () => {
      lerCadastro([{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }]);
      classificacaoPeloEnem();
      store.criteriosDesempateGravados.set([{ ...CRITERIO_POR_AREA, areas: ['MATEMATICA'] }]);

      expect(componente.avisoDoDesempatePorArea()).toEqual([
        `Pelo cadastro de Peso por Área lido, o critério de desempate 1 gravado cita Matemática, que a resolução ${RESOLUCAO} não tem em todos os grupos, e a gravação deve ser recusada: troque a regra do critério ou remova-o no passo Desempate e grave o passo, ou escolha outra resolução no passo Fórmula. Se o cadastro mudou, atualize a lista.`,
      ]);
    });

    it('nomeia pela lista canônica a área que a resolução não tem em grupo nenhum', async () => {
      lerCadastro([
        { codigo: 'MATEMATICA', rotulo: 'Matemática', peso: 1, corte: null },
        { codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null },
      ]);
      classificacaoPeloEnem();
      store.criteriosDesempateGravados.set([
        { ...CRITERIO_POR_AREA, areas: ['REDACAO', 'LINGUAGENS'] },
      ]);

      expect(componente.avisoDoDesempatePorArea()[0]).toContain('cita Linguagens,');
    });

    it('a publicação não barra na validação o que a varredura corrige gravando o Desempate antes', async () => {
      prepararClassificacaoLocal();
      store.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
      store.patchSection('desempate', [
        { ...CRITERIO_POR_AREA, regraCodigo: 'DESEMPATE-MAIOR-IDADE', areas: [] },
      ]);

      expect(componente.validate()).toEqual({ valid: true });

      // A varredura grava o Desempate, e o que está gravado passa a ser o rascunho.
      store.criteriosDesempateGravados.set(store.draft().desempate);
      await expect(gravar()).resolves.toEqual({ valid: true });
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
            areaCodigo: '',
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

      const congelado = store.copiaCongeladaEmVigor();
      expect(congelado?.resolucao).toBe(RESOLUCAO);
      expect(congelado?.grupos[0].areas[0].peso).toBe(3);
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
      expect(store.motivoDaReleituraDaClassificacao()).toBe('desconhecida');
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
      expect(store.motivoDaReleituraDaClassificacao()).toBe('desconhecida');
    });

    it('na varredura, a gravação conclusiva com a resolução registra a cópia do cadastro lido como por confirmar', async () => {
      lerCadastroComPeso(2);
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
      await expect(gravacao).resolves.toEqual({ valid: true });

      // A gravação chegou: se a releitura do fim da varredura falhar, não é "desconhecida". Mas o
      // servidor copiou o cadastro dele, e só a releitura diz o que ficou congelado.
      expect(store.classificacaoGravada()).toMatchObject({
        estado: 'com-quadro',
        resolucao: RESOLUCAO,
        confirmada: false,
      });
      expect(store.copiaCongeladaEmVigor()).toBeNull();
    });

    it('fora da varredura, relê e confirma a cópia com o que o servidor congelou', async () => {
      lerCadastroComPeso(2);
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
      expect(store.motivoDaReleituraDaClassificacao()).toBe('por-confirmar');
      controller.expectOne(ROTA_DETALHE).flush(detalheCom(RESOLUCAO, 3));
      await gravacao;

      expect(store.motivoDaReleituraDaClassificacao()).not.toBe('por-confirmar');
      expect(store.copiaCongeladaEmVigor()?.grupos[0].areas[0].peso).toBe(3);
    });

    it('fora da varredura, a releitura que falha deixa a cópia por confirmar', async () => {
      lerCadastroComPeso(2);
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
      expect(store.motivoDaReleituraDaClassificacao()).toBe('por-confirmar');
      expect(store.motivoDaReleituraDaClassificacao()).not.toBe('desconhecida');
    });

    it('linhas do cadastro sem leitura válida não servem de cópia presumida', async () => {
      TestBed.inject(CatalogosDeClassificacaoService).pesosAreaEnem.set([linhaDoCadastro(2)]);
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
      await gravacao;

      expect(store.motivoDaReleituraDaClassificacao()).toBe('desconhecida');
    });

    it('a gravação recusada também descarta a releitura em curso', async () => {
      prepararClassificacaoLocal();
      const antiga = TestBed.inject(ReleituraDoSnapshot).reler();
      const leituraAntiga = controller.expectOne(ROTA_DETALHE);

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        { type: 'about:blank', title: 'Recusada.', status: 422, code: 'x', traceId: 't' },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      await gravacao;
      leituraAntiga.flush(detalheCom('Resolução antiga', 1));

      await expect(antiga).resolves.toBe(false);
      expect(store.classificacaoGravada()).toEqual({ estado: 'nunca-gravada' });
    });

    it('a gravação que lança também descarta a releitura em curso, e relê depois dela', async () => {
      prepararClassificacaoLocal();
      store.marcarClassificacaoDesconhecida();
      const antiga = TestBed.inject(ReleituraDoSnapshot).reler();
      const leituraAntiga = controller.expectOne(ROTA_DETALHE);
      vi.spyOn(TestBed.inject(CadastroInicialService), 'definirClassificacao').mockRejectedValue(
        new Error('falha fora do envelope'),
      );

      const gravacao = componente.persistir();
      await aguardarReleitura();
      const leituraNova = controller.expectOne(ROTA_DETALHE);
      leituraAntiga.flush(detalheCom('Resolução antiga', 1));
      leituraNova.flush(detalheCom(RESOLUCAO, 3));

      await expect(gravacao).rejects.toThrow('falha fora do envelope');
      await expect(antiga).resolves.toBe(false);
      expect(store.copiaCongeladaEmVigor()?.resolucao).toBe(RESOLUCAO);
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
      expect(store.classificacaoGravada()).toEqual({ estado: 'desconhecida' });
    });

    it('sem resolução antes e depois da gravação, não relê o detalhe', async () => {
      prepararClassificacaoLocal();

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();

      expect(controller.match(ROTA_DETALHE)).toHaveLength(0);
      await expect(gravacao).resolves.toEqual({ valid: true });
      // O servidor tem agora uma classificação sem quadro, e o desempate é conferido contra ela.
      expect(store.classificacaoGravada()).toEqual({ estado: 'sem-quadro' });
    });

    it('gravada com sucesso sem resolução, a classificação fica sem quadro, mesmo se antes era desconhecida', async () => {
      prepararClassificacaoLocal();
      store.marcarClassificacaoDesconhecida();

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();

      // A gravação conclusiva já prova o que o servidor tem: não há o que reler.
      expect(controller.match(ROTA_DETALHE)).toHaveLength(0);
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(store.classificacaoGravada()).toEqual({ estado: 'sem-quadro' });
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
      expect(store.motivoDaReleituraDaClassificacao()).toBe('desconhecida');
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

    describe('recusa por um critério de desempate já gravado', () => {
      const FORA_DO_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_fora_do_quadro';
      const SEM_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_sem_quadro';
      const TEXTO_FORA_DO_QUADRO =
        'Um critério de desempate gravado cita área do ENEM que a resolução escolhida não tem em todos os grupos. No passo Desempate, retire a área — ou, se nenhuma área do critério sobrar, troque a regra dele ou remova-o — e grave o passo; ou escolha outra resolução.';
      const TEXTO_SEM_QUADRO =
        'Um critério de desempate gravado compara a nota de área do ENEM, que só existe com a classificação baseada no ENEM pela média ponderada. Troque a regra do critério ou remova-o no passo Desempate e grave o passo, ou marque o ENEM e a média ponderada no passo Fórmula.';
      const TEXTO_SEM_QUADRO_NA_RESOLUCAO =
        'Um critério de desempate gravado compara a nota de área do ENEM, que exige o quadro da resolução de Peso por Área. Troque a regra do critério no passo Desempate e grave o passo, ou escolha a resolução no passo Fórmula.';

      async function recusar(
        codigo: string,
        errors: readonly { field: string; code: string; message: string }[],
      ): Promise<StepValidation> {
        prepararClassificacaoLocal();
        store.patchObjectSection('classificacao', {
          baseadoEmEnem: true,
          resolucaoPesoAreaEnem: RESOLUCAO,
        });
        const gravacao = componente.persistir();
        controller.expectOne(ROTA_CLASSIFICACAO).flush(
          {
            type: 'about:blank',
            title: 'Título genérico da raiz.',
            status: 422,
            code: codigo,
            traceId: 'trace-1',
            errors,
          },
          {
            status: 422,
            statusText: 'Unprocessable Entity',
            headers: { 'content-type': 'application/problem+json' },
          },
        );
        return gravacao;
      }

      it('guarda com a recusa a última leitura do cadastro pedida: só uma pedida depois conta como posterior', async () => {
        lerCadastroComPeso(2);
        const catalogos = TestBed.inject(CatalogosDeClassificacaoService);
        // Uma leitura pedida antes da recusa e respondida depois dela não é posterior.
        catalogos.recarregarPesosAreaEnem(0);
        const emVoo = controller.expectOne((requisicao) =>
          requisicao.url.endsWith('/api/configuracao/pesos-area-enem'),
        );

        await recusar(FORA_DO_QUADRO, [
          { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério 1.' },
        ]);
        emVoo.flush([linhaDoCadastro(2)]);

        expect(store.leituraDoCadastroNaRecusaPeloDesempate()).toBe(2);
        expect(catalogos.pesosLidosNaLeitura()).toBe(2);
      });

      it('no campo da resolução, explica com o texto da tela e o guarda sob o campo', async () => {
        const resultado = await recusar(FORA_DO_QUADRO, [
          { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério 1.' },
        ]);

        expect(resultado.messages).toEqual([TEXTO_FORA_DO_QUADRO]);
        // Guardada à parte da recusa da resolução, e mostrada sob o mesmo campo.
        expect(store.recusaPeloDesempatePorArea()).toBe(TEXTO_FORA_DO_QUADRO);
        expect(store.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      });

      it('a resposta nova pelo desempate substitui a recusa antiga da resolução', async () => {
        store.recusaDaResolucaoPesoAreaEnem.set('Recusa antiga da resolução.');

        await recusar(FORA_DO_QUADRO, [
          { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério 1.' },
        ]);

        expect(store.recusaDaResolucaoPesoAreaEnem()).toBeNull();
        expect(store.recusaPeloDesempatePorArea()).toBe(TEXTO_FORA_DO_QUADRO);
      });

      it('sem quadro no campo da resolução, orienta a escolher a resolução', async () => {
        const resultado = await recusar(SEM_QUADRO, [
          { field: 'resolucaoPesoAreaEnem', code: SEM_QUADRO, message: 'Critério 1.' },
        ]);

        expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO_NA_RESOLUCAO]);
      });

      it('noutro campo, explica com o texto da tela, sem o título genérico', async () => {
        const resultado = await recusar(SEM_QUADRO, [
          { field: 'baseadoEmEnem', code: SEM_QUADRO, message: 'Critério 1.' },
        ]);

        expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO]);
        expect(store.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      });

      it('sem campo, explica pelo código da raiz', async () => {
        const resultado = await recusar(SEM_QUADRO, []);

        expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO]);
      });

      it('com outro erro junto, mantém o título da raiz para ele', async () => {
        const resultado = await recusar(SEM_QUADRO, [
          { field: 'baseadoEmEnem', code: SEM_QUADRO, message: 'Critério 1.' },
          { field: 'nOpcoesAlocacao', code: 'outro', message: 'Outro.' },
        ]);

        expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO, 'Título genérico da raiz.']);
      });
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

    it('falha inconclusiva, mesmo sem resolução, deixa a classificação gravada desconhecida até a releitura', async () => {
      prepararClassificacaoLocal();

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      await aguardarReleitura();

      // O servidor pode ter gravado a classificação sem quadro, ou não ter gravado nada.
      expect(store.classificacaoGravada()).toEqual({ estado: 'desconhecida' });
      controller.expectOne(ROTA_DETALHE).flush({ id: PROCESSO_ID, classificacao: null });
      await gravacao;
      expect(store.classificacaoGravada()).toEqual({ estado: 'nunca-gravada' });
    });

    it('falha inconclusiva: o servidor pode ter gravado, e o quadro fica desconhecido se a releitura também falha', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const gravacao = componente.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      await aguardarReleitura();
      controller
        .expectOne(ROTA_DETALHE)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect((await gravacao).valid).toBe(false);
      expect(store.motivoDaReleituraDaClassificacao()).toBe('desconhecida');
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
      await aguardarReleitura();
      controller.expectOne(ROTA_DETALHE).flush({ id: PROCESSO_ID, classificacao: null });

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
