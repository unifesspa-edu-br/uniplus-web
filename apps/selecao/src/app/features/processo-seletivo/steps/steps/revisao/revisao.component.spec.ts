import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  apiOk,
  apiResultInterceptor,
  errorResult,
  mockProblemDetails,
} from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH, StatusProcesso } from '@uniplus/shared-data/selecao';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { AtoNormativoDto, AtosApi, TiposAtoApi } from '@uniplus/shared-data/publicacoes';

import { FaseDoCronograma, FaseUpload, UploadItem, WizardDraft } from '../../processo-seletivo.models';
import { PASSOS } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { nomeDoPasso } from './publicacao-para-comando';
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

const ATO_PUBLICADO: AtoNormativoDto = {
  id: SNAPSHOT_DTO.atoId,
  orgao: 'CEPS/Unifesspa',
  serie: 'Edital de Abertura',
  ano: 2026,
  numero: '001/2026',
  tipoCodigo: 'PORTARIA',
  congelaConfiguracao: true,
  efeitoIrreversivel: true,
  unicoPorObjeto: false,
  dataPublicacao: '2026-09-25',
  documentoHash: 'hash-do-documento',
  assinante: 'Reitor da Unifesspa',
  registradoEm: '2026-09-25T12:00:00Z',
  versaoInvocadaId: null,
  versaoInvocadaHash: null,
  atoRetificadoId: null,
  motivoRetificacao: null,
  avisos: null,
  _links: null,
};

describe('RevisaoStepComponent', () => {
  let fixture: ComponentFixture<RevisaoStepComponent>;
  let componente: RevisaoStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  /** Mutável por teste — a fase de coleta pode não ter `congelados` ainda, e é o catálogo quem resolve. */
  let fasePorId: ReturnType<typeof signal<ReadonlyMap<string, FaseCanonicaDto>>>;

  /** Resposta do `GET …/atos/{id}`, trocada por teste; conta as chamadas para provar quando lê. */
  let respostaDoAto: ReturnType<AtosApi['obter']>;
  let atosLidos: string[];
  const atosApi = {
    obter: (id: string) => {
      atosLidos.push(id);
      return respostaDoAto;
    },
  };

  beforeEach(async () => {
    fasePorId = signal(new Map());
    atosLidos = [];
    respostaDoAto = of(apiOk(ATO_PUBLICADO, 200, new HttpHeaders()));

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
        { provide: AtosApi, useValue: atosApi },
        // Stub minimalista: só o que RevisaoStepComponent lê do catálogo de
        // fases — evita puxar as sete APIs que o serviço real injeta.
        { provide: CatalogosDoCronogramaService, useValue: { fasePorId } },
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

  /**
   * O `effect()` que dispara o preflight roda no scheduler do Angular, não na
   * mesma tarefa síncrona de `.set()`. Recarrega ao ENTRAR no passo
   * (`store.isLast()`, #486) — a Revisão é sempre o último, então o cenário
   * de teste também precisa estar lá para o `effect` dessa condição disparar.
   */
  async function criarProcesso(): Promise<void> {
    store.currentStep.set(store.totalSteps - 1);
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
      prepararCamposLocais();
      await criarProcesso();

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
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();

      expect(componente.validate()).toEqual({ valid: true });
    });

    /**
     * O checklist legal foi avaliado para a data de referência de QUANDO ele
     * carregou — se o operador muda o período depois, sem recarregar,
     * `validate()` não pode aprovar um checklist que já não corresponde ao
     * que vai ser publicado (achado do Codex na #486).
     */
    it('recusa quando a data de referência mudou depois do último carregamento do checklist legal', async () => {
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();
      expect(componente.validate()).toEqual({ valid: true });

      // Sem fase de coleta nestes testes — a data de referência vem do campo.
      // Mudar o início do período invalida o checklist legal já carregado.
      store.patchObjectSection('publicacao', { periodoInscricaoInicio: '2027-06-15T09:00' });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.some((m) => m.includes('Atualizar checklist'))).toBe(true);
    });
  });

  describe('#742 — conformidade legal não avaliável', () => {
    const PROBLEM_SEM_FASE_DE_COLETA = {
      type: 'about:blank',
      title: 'Período de inscrição obrigatório',
      status: 422,
      detail:
        'O processo não tem fase do cronograma que colete inscrição, então o período de inscrição precisa ser informado na publicação.',
      code: 'uniplus.selecao.processo_seletivo.periodo_inscricao_obrigatorio_sem_fase_de_coleta',
      traceId: 't',
    };

    async function flushPreflightComPendenciaLegal(): Promise<void> {
      controller.expectOne(ROTA_CONFORMIDADE).flush(CONFORMIDADE_VERDE);
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(PROBLEM_SEM_FASE_DE_COLETA, {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/problem+json' },
        });
      await flushMicrotasks();
    }

    /**
     * O defeito que originou a issue: o 422 acendia o alerta de erro, e a seção
     * "Documento e ato de publicação" — que mora dentro do `@else` desse erro —
     * não renderizava. O campo onde o período seria informado ficava escondido
     * atrás da recusa que só o período resolveria, e o certame de origem
     * importada não tinha como ser publicado.
     */
    it('mantém em tela o campo de período, que é o que destrava a avaliação', async () => {
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightComPendenciaLegal();
      fixture.detectChanges();

      const html: HTMLElement = fixture.nativeElement;
      expect(html.querySelector('#rev-periodo-inicio')).not.toBeNull();
      expect(html.querySelector('#rev-periodo-fim')).not.toBeNull();
      expect(html.querySelector('#rev-tipo-ato')).not.toBeNull();
      expect(html.querySelector('.alert--danger')).toBeNull();
    });

    it('anuncia o motivo do servidor, sem oferecer "Tentar novamente"', async () => {
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightComPendenciaLegal();
      fixture.detectChanges();

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('período de inscrição precisa ser informado');
      expect(texto).not.toContain('Tentar novamente');
    });

    it('recusa a publicação com o motivo, e não com "obrigatoriedades reprovadas"', async () => {
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightComPendenciaLegal();

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.some((m) => m.includes('período de inscrição precisa ser informado'))).toBe(true);
      expect(resultado.messages?.some((m) => m.includes('obrigatoriedades legais reprovadas'))).toBe(false);
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
      prepararCamposLocais();
      await criarProcesso();
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
      prepararCamposLocais();
      await criarProcesso();
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

    /**
     * O `POST` já publicou de verdade quando esta releitura roda — se o
     * snapshot falhar por um blip transitório, o processo continua
     * publicado no servidor, e o rascunho não pode seguir parecendo editável
     * (achado do Codex na #486: perder a hidratação aqui reabriria os
     * controles de um processo já imutável).
     */
    it('hidrata o detalhe publicado mesmo quando a releitura do snapshot falha', async () => {
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });

      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(
        { type: 'about:blank', title: 'x', status: 503, code: 'erro', traceId: 't' },
        { status: 503, statusText: 'Service Unavailable' },
      );

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      // O snapshot não confirmou, mas o detalhe publicado já está no store.
      expect(store.remoteSnapshot()?.status).toBe(StatusProcesso.publicado);
      expect(store.edicaoPermitida()).toBe(false);
      expect(componente.snapshotConfirmado()).toBeNull();
    });

    /**
     * O `POST` já devolveu `204` quando esta releitura roda — mas ela ainda
     * mostra `rascunho`, um status que só é consistente ANTES da publicação.
     * Atraso de propagação (réplica desatualizada) ou falha real de aplicar:
     * as duas exigem manter a tela travada, não tratar o status desatualizado
     * como se fosse a verdade definitiva (achado do Codex na #486, P1 — a
     * mesma família de "estado intermediário tratado como final" que já
     * apareceu nesta frente).
     */
    it('mantém a tela travada quando a releitura pós-204 ainda mostra rascunho', async () => {
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });

      await flushMicrotasks();
      controller
        .expectOne(ROTA_DETALHE)
        .flush({ ...PROCESSO_DTO_MINIMO, status: StatusProcesso.rascunho });
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(store.publicacaoNaoConfirmada()).toBe(true);
      expect(store.edicaoPermitida()).toBe(false);
      expect(componente.snapshotConfirmado()).toBeNull();
    });

    /**
     * A fase acrescentada nesta sessão (`acrescentarFase()` do passo
     * Cronograma) nasce com `congelados: null` — só uma releitura do
     * servidor preenche esse campo, e `persistir()` do Cronograma reconcilia
     * só as etapas. Sem o fallback pelo catálogo, o comando mandaria o
     * período preenchido onde o servidor exige `null`, e a publicação mais
     * comum (processo com inscrição própria) recusaria com 422
     * `PeriodoInscricaoNaoInformavel`.
     */
    it('reconhece fase de coleta sem congelados ainda, pelo catálogo (fase recém-acrescentada nesta sessão)', async () => {
      const faseSemCongelados: FaseDoCronograma = {
        faseCanonicaId: 'fase-inscricao-1',
        codigo: 'INSCRICAO',
        ordem: 1,
        inicio: null,
        fim: null,
        produtos: [],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: null,
        congelados: null,
      };
      fasePorId.set(
        new Map([
          [
            'fase-inscricao-1',
            { id: 'fase-inscricao-1', codigo: 'INSCRICAO', coletaInscricao: true } as FaseCanonicaDto,
          ],
        ]),
      );

      store.patchObjectSection('cronograma', { fases: [faseSemCongelados] });
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();

      // A tela não pode cobrar o período: a fase de coleta existe, só ainda
      // não foi relida do servidor.
      expect(componente.validate()).toEqual({ valid: true });

      const gravacao = componente.persistir();
      const requisicao = controller.expectOne(ROTA_PUBLICACAO);
      expect(requisicao.request.body).toMatchObject({
        periodoInscricaoInicio: null,
        periodoInscricaoFim: null,
      });
      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await gravacao;
    });

    it('em 422 estrutural, guarda as pendências da extension e não marca como publicado', async () => {
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(
        {
          type: 'about:blank',
          title: 'O processo tem pendências estruturais',
          status: 422,
          code: 'uniplus.selecao.processo_seletivo.conformidade_insuficiente',
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
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(
        {
          type: 'about:blank',
          title: 'Conformidade legal insuficiente',
          status: 422,
          code: 'uniplus.selecao.processo_seletivo.conformidade_legal_insuficiente',
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
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(
        {
          type: 'about:blank',
          title: 'Somente um documento confirmado pode ser referenciado na publicação.',
          status: 422,
          code: 'uniplus.selecao.processo_seletivo.documento_nao_confirmado',
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
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();

      const primeira = componente.persistir();
      const requisicao1 = controller.expectOne(ROTA_PUBLICACAO);
      const chave1 = requisicao1.request.headers.get('Idempotency-Key');
      requisicao1.flush(
        {
          type: 'about:blank',
          title: 'x',
          status: 422,
          code: 'uniplus.selecao.processo_seletivo.documento_nao_confirmado',
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
      prepararCamposLocais();
      await criarProcesso();
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

  describe('select de tipo de ato — sobrevive a destruir e recriar a seção', () => {
    /**
     * O bloco do formulário só existe dentro do `@else` de
     * `preflight.erro()`: uma recarga que falhe destrói o `<select>`
     * inteiro, e uma recarga seguinte que dê certo o recria do zero, com as
     * `<option>` do `@for` de novo. O binding é `formControlName`, não
     * `[value]` cru — `NgSelectOption` reaplica `writeValue()` do controle a
     * cada `<option>` que se registra, então a seleção sobrevive mesmo
     * quando as opções são criadas depois do valor já estar no controle.
     */
    /**
     * Regressão de `#738`. Os demais testes deste arquivo preenchem o rascunho
     * pelo store, então o mapeador sempre recebia texto — e o defeito vivia
     * justamente **entre** o template e o mapeador: com `type="number"`, o
     * `NumberValueAccessor` do Angular grava número num controle declarado
     * como texto, e `validate()` estourava com `texto.trim is not a function`.
     *
     * Por isso este teste atravessa o DOM: escreve no `<input>` e dispara o
     * evento, que é o caminho que o operador percorre. Preencher o controle por
     * `setValue` não reproduz o defeito, porque aí o valor já é do tipo
     * declarado.
     */
    it('valida sem estourar quando o ano é digitado no campo, e não posto no controle', async () => {
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();
      fixture.detectChanges();

      const ano = fixture.nativeElement.querySelector<HTMLInputElement>('#rev-ano');
      expect(ano).not.toBeNull();

      ano!.value = '2027';
      ano!.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(() => componente.validate()).not.toThrow();
      expect(componente.form.controls.ano.value).toBe('2027');
    });

    it('mantém o tipo de ato escolhido visível depois de uma recarga que falha e outra que dá certo', async () => {
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();

      componente.form.controls.tipoAtoCodigo.setValue('PORTARIA');
      fixture.detectChanges();

      let select = fixture.nativeElement.querySelector<HTMLSelectElement>('#rev-tipo-ato');
      expect(select?.value).toBe('PORTARIA');

      // Recarga que falha — o `@else` inteiro sai da árvore, o `<select>` é destruído.
      componente.recarregarPreflight();
      controller.expectOne(ROTA_CONFORMIDADE).flush(
        { type: 'about:blank', title: 'x', status: 500, code: 'erro', traceId: 't' },
        { status: 500, statusText: 'Internal Server Error', headers: { 'Content-Type': 'application/problem+json' } },
      );
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
      await flushMicrotasks();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#rev-tipo-ato')).toBeNull();

      // Recarga que dá certo — o `@else` volta, o `<select>` é recriado do zero.
      componente.recarregarPreflight();
      controller.expectOne(ROTA_CONFORMIDADE).flush(CONFORMIDADE_VERDE);
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
      await flushMicrotasks();
      fixture.detectChanges();

      select = fixture.nativeElement.querySelector<HTMLSelectElement>('#rev-tipo-ato');
      expect(select?.value).toBe('PORTARIA');
      expect(store.draft().publicacao.ato.tipoAtoCodigo).toBe('PORTARIA');
    });
  });

  describe('pendências do processo ENEM', () => {
    const OFERTA_A = '01960000-0000-7000-0000-00000000aaa1';
    const OFERTA_B = '01960000-0000-7000-0000-00000000aaa2';

    async function abrirComPendenciasDoEnem(): Promise<void> {
      prepararCamposLocais();
      await criarProcesso();
      controller.expectOne(ROTA_CONFORMIDADE).flush({
        processoSeletivoId: PROCESSO_ID,
        itens: [
          {
            codigo: 'distribuicao_vagas_ausente',
            dimensao: 'distribuicao_vagas',
            mensagem: 'Distribuição de vagas',
            ok: false,
          },
          {
            codigo: 'classificacao_resolucao_peso_area_enem_ausente',
            dimensao: 'classificacao',
            mensagem:
              'Resolução de Pesos por Área com quadro congelado (classificação baseada em ENEM com cálculo local)',
            ok: false,
          },
          {
            codigo: 'distribuicao_vagas_oferta_sem_grupo_area_enem',
            dimensao: 'distribuicao_vagas',
            mensagem: `Grupo de área do ENEM congelado em toda oferta (ofertas: ${OFERTA_A}; ${OFERTA_B})`,
            ok: false,
          },
          {
            codigo: 'classificacao_grupo_area_enem_da_oferta_fora_do_quadro',
            dimensao: 'classificacao',
            mensagem: `Grupo de área do ENEM de cada oferta presente no quadro de pesos por área (ofertas: ${OFERTA_A} (grupo SAUDE_E_BIOLOGICAS — Saúde e Biológicas); ${OFERTA_B} (grupo TECNOLOGICA))`,
            ok: false,
          },
        ],
      });
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
      await flushMicrotasks();
      fixture.detectChanges();
    }

    function itemDaMensagem(trecho: string): HTMLElement {
      const itens = Array.from(
        fixture.nativeElement.querySelectorAll('.revisao-item') as NodeListOf<HTMLElement>,
      );
      const item = itens.find((elemento) => elemento.textContent?.includes(trecho));
      if (item === undefined) throw new Error(`item "${trecho}" não renderizado`);
      return item;
    }

    function rotuloDoPassoAtual(): string {
      return PASSOS[store.currentStep()].rotulo;
    }

    it('a pendência da resolução leva ao passo da fórmula e diz que a escolha vai com a classificação', async () => {
      await abrirComPendenciasDoEnem();

      const item = itemDaMensagem('Resolução de Pesos por Área');
      expect(item.querySelector('.revisao-item__onde')?.textContent?.trim()).toBe(
        `Escolha a resolução de Peso por Área. A escolha é gravada quando a classificação é gravada, no passo ${nomeDoPasso('Eliminação')}, ou na publicação do processo, e até lá esta pendência continua aqui.`,
      );

      const botao = item.querySelector<HTMLButtonElement>('.revisao-item__ir');
      expect(botao?.textContent?.trim()).toBe(`Ir para ${nomeDoPasso('Fórmula e precisão')}`);
      botao?.click();
      expect(rotuloDoPassoAtual()).toBe('Fórmula e precisão');
    });

    it('a pendência do grupo fora do quadro lista as ofertas com o grupo e diz as duas metades da correção', async () => {
      await abrirComPendenciasDoEnem();

      const item = itemDaMensagem('presente no quadro de pesos por área');
      expect(item.querySelector('.revisao-item__name')?.textContent).toContain(
        `${OFERTA_A} (grupo SAUDE_E_BIOLOGICAS — Saúde e Biológicas); ${OFERTA_B} (grupo TECNOLOGICA)`,
      );
      const orientacao = item.querySelector('.revisao-item__onde')?.textContent ?? '';
      expect(orientacao).toContain('Corrija o grupo de área do ENEM no cadastro do curso, em Configuração');
      expect(orientacao).toContain(`regrave o passo ${nomeDoPasso('Vagas')}`);

      item.querySelector<HTMLButtonElement>('.revisao-item__ir')?.click();
      expect(rotuloDoPassoAtual()).toBe('Vagas');
    });

    it('a pendência da oferta sem grupo explica o cadastro de cursos e a regravação de Vagas', async () => {
      await abrirComPendenciasDoEnem();

      const item = itemDaMensagem('Grupo de área do ENEM congelado');
      expect(item.querySelector('.revisao-item__name')?.textContent).toContain(`${OFERTA_A}; ${OFERTA_B}`);
      const orientacao = item.querySelector('.revisao-item__onde')?.textContent ?? '';
      expect(orientacao).toContain('cadastro do curso, em Configuração');
      expect(orientacao).toContain(`regrave o passo ${nomeDoPasso('Vagas')}`);

      item.querySelector<HTMLButtonElement>('.revisao-item__ir')?.click();
      expect(rotuloDoPassoAtual()).toBe('Vagas');
    });

    /** Dois itens podem levar ao mesmo passo: o botão é descrito pela pendência que resolve. */
    it('descreve cada botão pela mensagem do item e pela orientação', async () => {
      await abrirComPendenciasDoEnem();

      const descricao = (trecho: string): string => {
        const botao = itemDaMensagem(trecho).querySelector('.revisao-item__ir');
        return (botao?.getAttribute('aria-describedby') ?? '')
          .split(' ')
          .map((id) => fixture.nativeElement.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? '')
          .join(' ');
      };

      const daResolucao = descricao('Resolução de Pesos por Área');
      expect(daResolucao).toContain('Resolução de Pesos por Área com quadro congelado');
      expect(daResolucao).toContain(
        `A escolha é gravada quando a classificação é gravada, no passo ${nomeDoPasso('Eliminação')}`,
      );
      const daOferta = descricao('Grupo de área do ENEM congelado');
      expect(daOferta).toContain('Grupo de área do ENEM congelado em toda oferta');
      expect(daOferta).toContain(`regrave o passo ${nomeDoPasso('Vagas')}`);
      expect(descricao('Distribuição de vagas')).toBe('Distribuição de vagas');
    });
  });

  describe('processo já publicado', () => {
    async function abrirPublicado(): Promise<void> {
      store.remoteSnapshot.set(PROCESSO_DTO_MINIMO as never);
      await criarProcesso();
      await flushPreflightVerde();
    }

    function texto(): string {
      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    }

    it('lê o ato vigente pelo snapshot e o mostra como texto, sem o formulário', async () => {
      await abrirPublicado();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();

      expect(atosLidos).toEqual([SNAPSHOT_DTO.atoId]);
      const lista = (fixture.nativeElement as HTMLElement).querySelector(
        'dl[aria-label="Ato publicado"]',
      );
      expect(lista?.textContent).toContain('001/2026');
      expect(lista?.textContent).toContain('Portaria');
      expect(lista?.textContent).toContain('25/09/2026');
      expect(lista?.textContent).toContain('Reitor da Unifesspa');
      expect((fixture.nativeElement as HTMLElement).querySelector('#rev-numero')).toBeNull();
    });

    it('mostra a falha da leitura com "Tentar novamente", que lê de novo', async () => {
      respostaDoAto = of(errorResult(mockProblemDetails({ status: 503 })));
      await abrirPublicado();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();

      expect(texto()).toContain('Não foi possível ler o ato publicado');

      respostaDoAto = of(apiOk(ATO_PUBLICADO, 200, new HttpHeaders()));
      const botoes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
      const botao = botoes.find((item) => item.textContent?.includes('Tentar novamente'));
      botao?.click();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();

      expect(texto()).toContain('Reitor da Unifesspa');
      expect(atosLidos).toHaveLength(2);
    });

    it('depois de publicar nesta sessão, lê o ato pelo snapshot já relido', async () => {
      prepararCamposLocais();
      await criarProcesso();
      await flushPreflightVerde();

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });
      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await gravacao;
      await flushMicrotasks();
      fixture.detectChanges();
      await flushMicrotasks();

      controller.expectNone(ROTA_SNAPSHOT);
      expect(atosLidos).toEqual([SNAPSHOT_DTO.atoId]);
    });

    // Cancelado e encerrado não dizem se houve publicação: um rascunho cancelado não tem
    // snapshot vigente, e a transcrição que ele guarda precisa continuar na tela.
    it.each([StatusProcesso.rascunho, StatusProcesso.cancelado, StatusProcesso.encerrado])(
      'em %s não lê ato nenhum e mantém o formulário',
      async (status) => {
        store.remoteSnapshot.set({ ...PROCESSO_DTO_MINIMO, status } as never);
        await criarProcesso();
        await flushPreflightVerde();
        fixture.detectChanges();

        controller.expectNone(ROTA_SNAPSHOT);
        expect(atosLidos).toEqual([]);
        expect((fixture.nativeElement as HTMLElement).querySelector('#rev-numero')).not.toBeNull();
      },
    );
  });

  describe('período de inscrição', () => {
    it('nomeia a fase e mostra a janela em data e hora locais', async () => {
      const faseDeInscricao: FaseDoCronograma = {
        faseCanonicaId: 'fase-inscricao-1',
        codigo: 'INSCRICAO',
        ordem: 1,
        inicio: '2026-12-10T03:00:00+00:00',
        fim: '2027-01-11T02:59:00+00:00',
        produtos: [],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: null,
        congelados: null,
      };
      fasePorId.set(
        new Map([
          [
            'fase-inscricao-1',
            {
              id: 'fase-inscricao-1',
              codigo: 'INSCRICAO',
              nome: 'Inscrição',
              coletaInscricao: true,
            } as FaseCanonicaDto,
          ],
        ]),
      );
      store.patchObjectSection('cronograma', { fases: [faseDeInscricao] });
      await criarProcesso();
      await flushPreflightVerde();
      fixture.detectChanges();

      const aviso = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(aviso).toContain('Inscrição');
      expect(aviso).toContain('10/12/2026 às 00:00 até 10/01/2027 às 23:59');
      expect(aviso).not.toContain('INSCRICAO');
      expect(aviso).not.toContain('2026-12-10T');
    });
  });
});
