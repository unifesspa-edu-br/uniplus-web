import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiOk, apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH, StatusProcesso } from '@uniplus/shared-data/selecao';
import { TiposAtoApi } from '@uniplus/shared-data/publicacoes';

import { FaseUpload, UploadItem, WizardDraft } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { RevisaoStepComponent } from './revisao.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000009aa';
const DOCUMENTO_ID = '01960000-0000-7000-0000-0000000009bb';

const ROTA_CONFORMIDADE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/conformidade`;
const ROTA_CONFORMIDADE_LEGAL = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/conformidade-legal`;
const ROTA_PUBLICACAO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/publicacao`;
const ROTA_DETALHE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
const ROTA_SNAPSHOT = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/snapshot-vigente`;

function edital(fase: FaseUpload): UploadItem {
  return {
    id: 'u1',
    name: 'edital.pdf',
    extension: 'pdf',
    progress: 100,
    fase,
    documentoEditalId: fase === 'confirmado' ? DOCUMENTO_ID : undefined,
  };
}

function atoCompleto(): WizardDraft['publicacao']['ato'] {
  return {
    orgao: 'Reitoria',
    serie: '1',
    ano: '2027',
    dataPublicacao: '2027-01-15',
    assinante: 'Reitor',
    tipoAtoCodigo: 'PORTARIA',
  };
}

const TIPO_ATO_DTO = {
  id: 't1',
  codigo: 'PORTARIA',
  nome: 'Portaria',
  congelaConfiguracao: true,
  unicoPorObjeto: false,
  efeitoIrreversivel: true,
  ehResultado: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2020-01-01T00:00:00Z',
};

const CONFORMIDADE_VERDE = { processoSeletivoId: PROCESSO_ID, itens: [] };
const CONFORMIDADE_LEGAL_VERDE = {
  processoSeletivoId: PROCESSO_ID,
  dataReferencia: '2027-01-01',
  regras: [],
  avisos: [],
};

const PROCESSO_DTO_MINIMO = {
  id: PROCESSO_ID,
  nome: 'x',
  tipoProcesso: { origemId: 't1', codigo: 'T', nome: 'x' },
  status: StatusProcesso.publicado,
  origemCandidatos: 'InscricaoPropria',
  unidadeAdministradora: {
    origemId: 'u1',
    sigla: 'x',
    slug: 'x',
    nome: 'x',
    tipo: 'x',
    cidadeCodigoIbge: null,
    cidadeNome: null,
    cidadeUf: null,
  },
  localidade: { codigoIbge: '1500107', nome: 'x', uf: 'PA' },
  etapas: [],
  ofertaAtendimento: null,
  distribuicaoVagas: [],
  bonusRegional: null,
  cascata: null,
  criteriosDesempate: [],
  classificacao: null,
  cronogramaFases: [],
  documentosExigidos: [],
  raizesExigencia: [],
  referenciaTemporalFatos: null,
  fatosColetados: [],
  regrasDerivacao: [],
  formularioTitulo: null,
  formularioTermoAceiteTexto: null,
  configuracaoDivulgacao: null,
  configuracaoTaxaInscricao: null,
  algoritmoContagemPrazo: null,
  criadoEm: '2027-01-01T00:00:00Z',
};

const SNAPSHOT_DTO = {
  snapshotPublicacaoId: '01960000-0000-7000-0000-0000000009cc',
  atoId: '01960000-0000-7000-0000-0000000009dd',
  schemaVersion: '1',
  algoritmoHash: 'hash-a',
  hashConfiguracao: 'hash-configuracao-123456',
  hashEdital: 'hash-edital-123456',
  configuracao: {},
};

describe('RevisaoStepComponent', () => {
  let fixture: ComponentFixture<RevisaoStepComponent>;
  let componente: RevisaoStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RevisaoStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        {
          provide: TiposAtoApi,
          useValue: { listar: () => of(apiOk([TIPO_ATO_DTO], 200, new HttpHeaders())) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RevisaoStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  /**
   * `setTimeout(0)` espera a fila de microtarefas inteira drenar antes de
   * continuar — não importa quantos saltos de microtarefa (scheduler de
   * `effect()`, cadeia de `firstValueFrom`/`Promise.all`) aconteçam por
   * dentro, o que uma única `await Promise.resolve()` não garante.
   */
  function flushMicrotasks(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** O `effect()` que dispara o preflight roda no scheduler do Angular, não na mesma tarefa síncrona de `.set()`. */
  async function criarProcesso(): Promise<void> {
    store.processoSeletivoId.set(PROCESSO_ID);
    await flushMicrotasks();
    fixture.detectChanges();
  }

  /** Prepara o rascunho com tudo que `mensagensDePublicacao` cobra, exceto o preflight do servidor. */
  function prepararCamposLocais(): void {
    store.patchObjectSection('identificacao', { uploads: [edital('confirmado')] });
    store.patchObjectSection('publicacao', {
      numero: '001/2027',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
    });
  }

  async function flushPreflightVerde(): Promise<void> {
    controller.expectOne(ROTA_CONFORMIDADE).flush(CONFORMIDADE_VERDE);
    controller
      .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
      .flush(CONFORMIDADE_LEGAL_VERDE);
    await flushMicrotasks();
  }

  describe('validate()', () => {
    it('recusa sem processo criado', () => {
      expect(componente.validate().valid).toBe(false);
    });

    it('recusa enquanto o preflight ainda carrega', async () => {
      await criarProcesso();
      expect(componente.validate().valid).toBe(false);

      controller.expectOne(ROTA_CONFORMIDADE).flush(CONFORMIDADE_VERDE);
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
    });

    it('recusa com checklist estrutural pendente', async () => {
      await criarProcesso();
      prepararCamposLocais();

      controller.expectOne(ROTA_CONFORMIDADE).flush({
        processoSeletivoId: PROCESSO_ID,
        itens: [
          { codigo: 'x', dimensao: 'taxa_inscricao', mensagem: 'falta declarar', ok: false },
        ],
      });
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
      await flushMicrotasks();

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.some((m) => m.includes('estruturais'))).toBe(true);
    });

    it('recusa sem documento confirmado escolhido', async () => {
      await criarProcesso();
      store.patchObjectSection('publicacao', { ato: atoCompleto() });
      await flushPreflightVerde();

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.some((m) => m.includes('documento'))).toBe(true);
    });

    it('válido com preflight verde, documento confirmado e ato completo', async () => {
      await criarProcesso();
      prepararCamposLocais();
      await flushPreflightVerde();

      expect(componente.validate()).toEqual({ valid: true });
    });
  });

  describe('rotuloDeAvanco()', () => {
    it('diz "Publicar processo"', () => {
      expect(componente.rotuloDeAvanco()).toBe('Publicar processo');
    });
  });

  describe('confirmacaoDeGravacao()', () => {
    it('null enquanto inválido', () => {
      expect(componente.confirmacaoDeGravacao()).toBeNull();
    });

    it('resume os dados do ato quando válido', async () => {
      await criarProcesso();
      prepararCamposLocais();
      await flushPreflightVerde();

      const confirmacao = componente.confirmacaoDeGravacao();
      expect(confirmacao).not.toBeNull();
      expect(confirmacao?.itens.some((item) => item.valor.includes('Portaria'))).toBe(true);
    });
  });

  describe('persistir()', () => {
    it('recusa sem processo criado', async () => {
      const resultado = await componente.persistir();
      expect(resultado.valid).toBe(false);
    });

    it('publica, relê /{id} e /snapshot-vigente, e hidrata o store como publicado', async () => {
      await criarProcesso();
      prepararCamposLocais();
      await flushPreflightVerde();

      const gravacao = componente.persistir();

      const requisicaoPublicacao = controller.expectOne(ROTA_PUBLICACAO);
      expect(requisicaoPublicacao.request.method).toBe('POST');
      expect(requisicaoPublicacao.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(requisicaoPublicacao.request.body).toMatchObject({
        numero: '001/2027',
        documentoEditalId: DOCUMENTO_ID,
        ato: { orgao: 'Reitoria', tipoAtoCodigo: 'PORTARIA' },
      });
      requisicaoPublicacao.flush(null, { status: 204, statusText: 'No Content' });

      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);

      const resultado = await gravacao;
      expect(resultado).toEqual({ valid: true });
      expect(store.remoteSnapshot()?.status).toBe(StatusProcesso.publicado);
      expect(componente.snapshotConfirmado()?.snapshotPublicacaoId).toBe(
        SNAPSHOT_DTO.snapshotPublicacaoId,
      );
      expect(store.salvando()).toBe(false);
    });

    it('em 422 estrutural, guarda as pendências da extension e não marca como publicado', async () => {
      await criarProcesso();
      prepararCamposLocais();
      await flushPreflightVerde();

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(
        {
          type: 'about:blank',
          title: 'O processo tem pendências estruturais',
          status: 422,
          code: 'ProcessoSeletivo.ConformidadeEstruturalInsuficiente',
          traceId: 't1',
          pendencias: [{ codigo: 'x', dimensao: 'taxa_inscricao', mensagem: 'falta declarar' }],
        },
        { status: 422, statusText: 'Unprocessable Entity', headers: { 'Content-Type': 'application/problem+json' } },
      );

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(componente.ultimaRecusa()?.pendencias).toHaveLength(1);
      // obrigatoriedadesReprovadas não foi avaliada nesta tentativa — null, não [].
      expect(componente.ultimaRecusa()?.obrigatoriedadesReprovadas).toBeNull();
      expect(componente.estruturalOk()).toBe(false);
      expect(store.remoteSnapshot()).toBeNull();
    });

    it('em 422 de conformidade legal, guarda as obrigatoriedades reprovadas', async () => {
      await criarProcesso();
      prepararCamposLocais();
      await flushPreflightVerde();

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(
        {
          type: 'about:blank',
          title: 'Conformidade legal insuficiente',
          status: 422,
          code: 'ProcessoSeletivo.ConformidadeLegalInsuficiente',
          traceId: 't2',
          obrigatoriedadesReprovadas: [
            { regraCodigo: 'R1', descricaoHumana: 'x', baseLegal: 'Lei x', motivo: 'y' },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity', headers: { 'Content-Type': 'application/problem+json' } },
      );

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(componente.ultimaRecusa()?.obrigatoriedadesReprovadas).toHaveLength(1);
      expect(componente.legalOk()).toBe(false);
    });

    it('em erro nomeado de documento/ato, marca o bloco próprio sem tocar nos dois checklists', async () => {
      await criarProcesso();
      prepararCamposLocais();
      await flushPreflightVerde();

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(
        {
          type: 'about:blank',
          title: 'Somente um documento confirmado pode ser referenciado na publicação.',
          status: 422,
          code: 'ProcessoSeletivo.DocumentoNaoConfirmado',
          traceId: 't3',
        },
        { status: 422, statusText: 'Unprocessable Entity', headers: { 'Content-Type': 'application/problem+json' } },
      );

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(componente.ultimaRecusa()?.documentoOuAto).toContain('documento confirmado');
      expect(componente.ultimaRecusa()?.pendencias).toEqual([]);
      expect(componente.ultimaRecusa()?.obrigatoriedadesReprovadas).toBeNull();
    });

    it('a segunda tentativa depois de um 422 usa uma Idempotency-Key diferente (CA-07)', async () => {
      await criarProcesso();
      prepararCamposLocais();
      await flushPreflightVerde();

      const primeira = componente.persistir();
      const requisicao1 = controller.expectOne(ROTA_PUBLICACAO);
      const chave1 = requisicao1.request.headers.get('Idempotency-Key');
      requisicao1.flush(
        {
          type: 'about:blank',
          title: 'x',
          status: 422,
          code: 'ProcessoSeletivo.DocumentoNaoConfirmado',
          traceId: 't',
        },
        { status: 422, statusText: 'Unprocessable Entity', headers: { 'Content-Type': 'application/problem+json' } },
      );
      await primeira;

      const segunda = componente.persistir();
      const requisicao2 = controller.expectOne(ROTA_PUBLICACAO);
      const chave2 = requisicao2.request.headers.get('Idempotency-Key');
      requisicao2.flush(null, { status: 204, statusText: 'No Content' });
      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await segunda;

      expect(chave1).toBeTruthy();
      expect(chave2).toBeTruthy();
      expect(chave2).not.toBe(chave1);
    });

    it('marca salvando() true durante o comando em curso, e false ao concluir', async () => {
      await criarProcesso();
      prepararCamposLocais();
      await flushPreflightVerde();

      const gravacao = componente.persistir();
      expect(store.salvando()).toBe(true);

      controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });
      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await gravacao;

      expect(store.salvando()).toBe(false);
    });
  });
});
