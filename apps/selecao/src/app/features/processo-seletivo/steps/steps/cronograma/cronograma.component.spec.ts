import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CronogramaStepComponent } from './cronograma.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_ETAPAS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/etapas`;
const ROTA_FASES = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/cronograma-fases`;

const ID_INSCRICAO = '01960000-0000-7000-0000-0000000000c1';
const ID_AVALIACAO = '01960000-0000-7000-0000-0000000000c2';
const ID_RESULTADO = '01960000-0000-7000-0000-0000000000c3';
const TIPO_ETAPA = '01960000-0000-7000-0000-0000000000e1';

const FASES_CANONICAS = [
  {
    id: ID_INSCRICAO,
    codigo: 'COLETA_INSCRICAO',
    nome: 'Inscrição',
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    produzResultado: false,
    resultadoDefinitivo: false,
    coletaInscricao: true,
    origemData: 'PROPRIA',
  },
  {
    id: ID_AVALIACAO,
    codigo: 'AVALIACAO',
    nome: 'Avaliação',
    donoTipico: 'CEPS',
    agrupaEtapas: true,
    permiteComplementacao: false,
    produzResultado: false,
    resultadoDefinitivo: false,
    coletaInscricao: false,
    origemData: 'PROPRIA',
  },
  {
    id: ID_RESULTADO,
    codigo: 'RESULTADO_FINAL',
    nome: 'Resultado final',
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    produzResultado: true,
    resultadoDefinitivo: true,
    coletaInscricao: false,
    origemData: 'DERIVADA',
  },
];

const TIPOS_ETAPA = [
  { id: TIPO_ETAPA, codigo: 'PROVA_OBJETIVA', nome: 'Prova objetiva', ativo: true },
];

describe('CronogramaStepComponent', () => {
  let componente: CronogramaStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CronogramaStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CronogramaStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    detectar = () => fixture.detectChanges();

    detectar();

    for (const requisicao of controller.match(() => true)) {
      const { url } = requisicao.request;
      if (url.includes('fases-canonicas')) requisicao.flush(FASES_CANONICAS);
      else if (url.includes('tipos-etapa')) requisicao.flush(TIPOS_ETAPA);
      else requisicao.flush([]);
    }
    detectar();
  });

  afterEach(() => controller.verify());

  /** Deixa a cadeia de `await` do comando avançar antes da próxima expectativa. */
  const proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

  function comFases(...ids: readonly string[]): void {
    store.patchObjectSection('cronograma', {
      fases: ids.map((faseCanonicaId, indice) => ({
        faseCanonicaId,
        codigo: FASES_CANONICAS.find((f) => f.id === faseCanonicaId)?.codigo ?? '',
        ordem: indice + 1,
        inicio: '2026-03-01T08:00:00-03:00',
        fim: '2026-03-10T18:00:00-03:00',
        atoProduzidoCodigo: null,
        tiposBancaIds: [],
        regraRecurso: null,
      })),
    });
    detectar();
  }

  function comUmaEtapa(): void {
    store.patchObjectSection('cronograma', {
      etapas: [
        {
          id: null,
          nome: 'Prova objetiva',
          carater: 'classificatoria' as const,
          tipoEtapaOrigemId: TIPO_ETAPA,
          peso: '1',
          notaMinima: '',
          ordem: 1,
        },
      ],
    });
    detectar();
  }

  it('oferece cada fase canônica uma vez só', () => {
    comFases(ID_INSCRICAO);

    const disponiveis = componente.fasesDisponiveis().map((fase) => fase.id);

    expect(disponiveis).not.toContain(ID_INSCRICAO);
    expect(disponiveis).toContain(ID_AVALIACAO);
  });

  /**
   * O cronograma gravado não aceita ficar vazio. Deixar o botão ativo levaria a
   * uma recusa do servidor depois de o operador já ter perdido a fase da tela.
   */
  it('não deixa remover a última fase, e diz por quê', () => {
    comFases(ID_INSCRICAO);

    expect(componente.podeRemoverFase()).toBe(false);

    componente.removerFase(0);
    expect(store.draft().cronograma.fases).toHaveLength(1);
  });

  /**
   * As etapas vivem no agregado, não na fase. Removê-la sem levá-las deixaria
   * etapas sem a fase que as avalia — e a recusa só apareceria na publicação,
   * apontando para outro lugar.
   */
  it('remover a fase que agrupa etapas leva as etapas junto', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comUmaEtapa();

    componente.removerFase(1);

    expect(store.draft().cronograma.fases).toHaveLength(1);
    expect(store.draft().cronograma.etapas).toEqual([]);
  });

  it('remover fase que não agrupa etapas preserva as etapas', () => {
    comFases(ID_AVALIACAO, ID_INSCRICAO);
    comUmaEtapa();

    componente.removerFase(1);

    expect(store.draft().cronograma.etapas).toHaveLength(1);
  });

  /**
   * Trocar duas fases adjacentes de lugar forma o ciclo que o servidor não
   * persiste numa chamada só: cada linha precisa que a outra libere a ordem
   * primeiro. A tela orienta em vez de gravar e receber a recusa.
   */
  it('orienta em vez de aplicar a troca que fecha ciclo de ordem', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    const antes = store.draft().cronograma.fases.map((fase) => fase.faseCanonicaId);

    componente.mover(0, 1);

    expect(componente.avisoDeReordenacao()).not.toBeNull();
    expect(store.draft().cronograma.fases.map((fase) => fase.faseCanonicaId)).toEqual(antes);
  });

  it('renumera a partir de 1 ao acrescentar fase', () => {
    comFases(ID_INSCRICAO);
    componente.faseAAcrescentar.set(ID_AVALIACAO);

    componente.acrescentarFase();

    expect(store.draft().cronograma.fases.map((fase) => fase.ordem)).toEqual([1, 2]);
    expect(componente.faseAAcrescentar()).toBe('');
  });

  /**
   * A hora digitada vale no fuso do certame. Guardá-la como veio do campo — sem
   * fuso — deixaria o instante à mercê de quem o lê depois.
   */
  it('grava a janela como instante no fuso institucional', () => {
    comFases(ID_INSCRICAO);

    componente.definirJanela(0, 'inicio', '2026-03-05T09:30');

    expect(store.draft().cronograma.fases[0].inicio).toBe('2026-03-05T09:30:00-03:00');
    expect(componente.janelaNoCampo(store.draft().cronograma.fases[0].inicio)).toBe(
      '2026-03-05T09:30',
    );
  });

  it('campo de janela esvaziado volta a não declarar instante', () => {
    comFases(ID_INSCRICAO);

    componente.definirJanela(0, 'fim', '');

    expect(store.draft().cronograma.fases[0].fim).toBeNull();
  });

  /**
   * A fase que agrupa etapas é recusada de imediato quando não há etapa, então
   * gravar o cronograma antes das etapas derrubaria uma gravação válida.
   */
  it('grava as etapas antes do cronograma de fases', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    const etapas = controller.expectOne(ROTA_ETAPAS);
    expect(etapas.request.method).toBe('PUT');
    controller.expectNone(ROTA_FASES);
    etapas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    const fases = controller.expectOne(ROTA_FASES);
    expect(fases.request.method).toBe('PUT');
    fases.flush(null, { status: 204, statusText: 'No Content' });

    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  it('não tenta gravar o cronograma quando as etapas são recusadas', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    controller
      .expectOne(ROTA_ETAPAS)
      .flush(
        { type: 'about:blank', title: 'Etapa recusada', status: 422, code: 'uniplus.selecao.x' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await proximoPasso();

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_FASES);
  });

  it('recusa gravar enquanto a conferência aponta problema, sem chamar a API', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_ETAPAS);
    controller.expectNone(ROTA_FASES);
  });
});
