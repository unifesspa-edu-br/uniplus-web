import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  BaseLegalBonusRegionalDto,
  CONFIGURACAO_BASE_PATH,
  TipoInstrumentoNormativoCodigo,
  type TipoInstrumentoNormativoComDescricao,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { detalhe } from '../../../processo-seletivo.retomada.testing';
import { BasesLegaisDeBonus } from './bases-legais-de-bonus.service';

const BASE = 'http://localhost:5000';
const ROTA_DAS_BASES = `${BASE}/api/configuracao/base-legal-bonus-regional`;
const ROTA_DOS_TIPOS = `${BASE}/api/configuracao/vocabularios/tipos-instrumento-normativo`;
const ID_DA_BASE_DO_SNAPSHOT = 'ba5e0000-0000-7000-8000-000000000002';

const baseDoCadastro: BaseLegalBonusRegionalDto = {
  id: 'ba5e0000-0000-7000-8000-000000000001',
  codigo: 'BASE_DE_TESTE',
  tipoInstrumento: {
    codigo: TipoInstrumentoNormativoCodigo.PORTARIA,
    rotulo: 'Rótulo do tipo de teste',
  },
  identificacao: 'Identificação de teste',
  descricao: 'Descrição de teste.',
  municipios: [],
  criadoEm: '2026-01-01T00:00:00Z',
};

const tipoDoVocabulario: TipoInstrumentoNormativoComDescricao = {
  codigo: TipoInstrumentoNormativoCodigo.LEI,
  rotulo: 'Rótulo do vocabulário de teste',
  descricao: 'Descrição do tipo de teste.',
};

const PROBLEMA = { type: 'about:blank', title: 'Erro', status: 500, traceId: 't' };

describe('BasesLegaisDeBonus', () => {
  let controller: HttpTestingController;
  let store: ProcessoSeletivoStore;
  let bases: BasesLegaisDeBonus;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        BasesLegaisDeBonus,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ProcessoSeletivoStore);
    bases = TestBed.inject(BasesLegaisDeBonus);
  });

  afterEach(() => controller.verify());

  function responderBases(corpo: readonly BaseLegalBonusRegionalDto[]): void {
    controller.expectOne((req) => req.url === ROTA_DAS_BASES).flush(corpo);
  }

  function responderTipos(corpo: readonly TipoInstrumentoNormativoComDescricao[]): void {
    controller.expectOne((req) => req.url === ROTA_DOS_TIPOS).flush(corpo);
  }

  function falharTipos(): void {
    controller
      .expectOne((req) => req.url === ROTA_DOS_TIPOS)
      .flush(PROBLEMA, { status: 500, statusText: 'Server Error' });
  }

  function gravarBaseSoNoSnapshot(codigoDoTipo: string): void {
    store.patchObjectSection('bonus', { baseLegalBonusRegionalId: ID_DA_BASE_DO_SNAPSHOT });
    store.remoteSnapshot.set(
      detalhe({
        bonusRegional: {
          id: 'c0000000-0000-7000-8000-000000000001',
          regra: { codigo: 'REGRA_DE_TESTE', versao: '1', hash: 'hash-de-teste' },
          fator: 1.2,
          teto: null,
          fatoElegibilidadeCodigo: null,
          baseLegal: {
            id: ID_DA_BASE_DO_SNAPSHOT,
            tipoInstrumento: codigoDoTipo,
            identificacao: 'Identificação do snapshot',
            descricao: 'Descrição do snapshot.',
            municipios: [],
          },
        },
      }),
    );
  }

  it('trata como falha a resposta 500 das bases legais, sem deixar a espera presa', () => {
    controller
      .expectOne((req) => req.url === ROTA_DAS_BASES)
      .flush(PROBLEMA, { status: 500, statusText: 'Server Error' });
    responderTipos([]);

    expect(bases.carregando()).toBe(false);
    expect(bases.erro()).toBe('Não foi possível carregar as bases legais de FADA.');
  });

  it('mostra o rótulo do tipo que veio na base do cadastro', () => {
    responderBases([baseDoCadastro]);
    responderTipos([]);

    expect(bases.escolhiveis().map((base) => base.tipo)).toEqual([
      baseDoCadastro.tipoInstrumento.rotulo,
    ]);
    expect(bases.rotuloDaBaseLegal(bases.escolhiveis()[0])).toBe(
      `${baseDoCadastro.tipoInstrumento.rotulo} ${baseDoCadastro.identificacao}`,
    );
  });

  it('a norma sem tipo nem identificação não deixa espaço sobrando no rótulo', () => {
    responderBases([]);
    responderTipos([]);

    expect(bases.rotuloDaBaseLegal({ tipo: '', identificacao: '' })).toBe('');
  });

  it('a base que só o snapshot conhece mostra o rótulo do vocabulário de tipos', () => {
    gravarBaseSoNoSnapshot(tipoDoVocabulario.codigo);
    responderBases([]);
    responderTipos([tipoDoVocabulario]);

    expect(bases.escolhiveis().map((base) => base.tipo)).toEqual([tipoDoVocabulario.rotulo]);
  });

  it('enquanto o vocabulário não responde, a base do snapshot não mostra o código do tipo', () => {
    gravarBaseSoNoSnapshot(tipoDoVocabulario.codigo);
    responderBases([]);

    expect(bases.tiposInstrumentoCarregando()).toBe(true);
    expect(bases.escolhiveis().map((base) => base.tipo)).toEqual(['']);

    responderTipos([tipoDoVocabulario]);
    expect(bases.tiposInstrumentoCarregando()).toBe(false);
  });

  it('se o vocabulário falha, avisa e não mostra o código do tipo', () => {
    gravarBaseSoNoSnapshot(tipoDoVocabulario.codigo);
    responderBases([]);
    falharTipos();

    expect(bases.tiposInstrumentoErro()).toBe(
      'Não foi possível carregar como se lê o tipo de cada norma.',
    );
    expect(bases.escolhiveis().map((base) => base.tipo)).toEqual(['']);
  });

  it('lê o vocabulário de novo ao tentar outra vez depois da falha', () => {
    responderBases([]);
    falharTipos();

    bases.carregarTiposDeInstrumento();
    responderTipos([tipoDoVocabulario]);

    expect(bases.tiposInstrumentoErro()).toBeNull();
  });

  it('não pede o vocabulário de novo enquanto a leitura anterior não terminou', () => {
    responderBases([]);

    bases.carregarTiposDeInstrumento();

    expect(controller.match((req) => req.url === ROTA_DOS_TIPOS)).toHaveLength(1);
  });

  it('o código do tipo que o vocabulário não conhece não aparece como rótulo', () => {
    gravarBaseSoNoSnapshot('TIPO_QUE_O_VOCABULARIO_NAO_TEM');
    responderBases([]);
    responderTipos([tipoDoVocabulario]);

    expect(bases.escolhiveis().map((base) => base.tipo)).toEqual(['']);
  });
});
