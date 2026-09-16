import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { BancaRequeridaDaFase, ProdutoDaFase } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDoCronogramaService } from './catalogos-do-cronograma.service';
import { CronogramaStepComponent } from './cronograma.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_ETAPAS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/etapas`;
const ROTA_FASES = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/cronograma-fases`;
const ROTA_ALGORITMO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/algoritmo-contagem-prazo`;
const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
const ROTA_DOCUMENTOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-exigidos`;
const ID_ETAPA_GRAVADA = '01960000-0000-7000-0000-0000000000ee';

/** O interceptor só lê o corpo como ProblemDetails sob este media type. */
const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

/** A recusa do servidor quando a nova ordem fecha ciclo entre fases existentes. */
const CICLO_DE_ORDEM = {
  type: 'about:blank',
  title: 'A redefinição do cronograma troca a Ordem entre fases já existentes',
  status: 422,
  code: 'uniplus.selecao.fase_cronograma.permutacao_de_ordem_nao_suportada',
  traceId: '00000000000000000000000000000002',
};

const ID_INSCRICAO = '01960000-0000-7000-0000-0000000000c1';
const ID_AVALIACAO = '01960000-0000-7000-0000-0000000000c2';
const ID_RESULTADO = '01960000-0000-7000-0000-0000000000c3';
const TIPO_ETAPA = '01960000-0000-7000-0000-0000000000e1';
/** Fase que o processo congelou e que não está mais no catálogo. */
const FASE_SUMIDA = '01960000-0000-7000-0000-0000000000cf';
const ID_BANCA_HETERO = '01960000-0000-7000-0000-0000000000b1';
const ID_CATEGORIA_RACA = '01960000-0000-7000-0000-0000000000d1';
const ID_CATEGORIA_RENDA = '01960000-0000-7000-0000-0000000000d2';

const FASES_CANONICAS = [
  {
    id: ID_INSCRICAO,
    codigo: 'COLETA_INSCRICAO',
    nome: 'Inscrição',
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
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
    coletaInscricao: false,
    origemData: 'DERIVADA',
  },
];

const TIPO_ETAPA_SO_ELIMINA = '01960000-0000-7000-0000-0000000000e2';

const TIPOS_ETAPA = [
  {
    id: TIPO_ETAPA,
    codigo: 'PROVA_OBJETIVA',
    nome: 'Prova objetiva',
    ativo: true,
    admitePontuacao: true,
    admiteEliminacao: true,
  },
  {
    id: TIPO_ETAPA_SO_ELIMINA,
    codigo: 'ANALISE_DOCUMENTAL',
    nome: 'Análise documental',
    ativo: true,
    admitePontuacao: false,
    admiteEliminacao: true,
  },
];

/** O catálogo não tem `nome` nem `descricao` — só `codigo` e `baseLegal` são legíveis. */
const REGRAS_CONTAGEM = [
  {
    codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    versao: 'v1',
    tipo: 'algoritmo_contagem_prazo',
    esquemaArgs: {},
    // O catálogo publica os invariantes como lista de prosa — é deles que sai a descrição
    // do que a convenção faz, e é o que separa uma convenção da outra.
    invariantes: [
      'o dia da âncora não conta',
      'em horas, a contagem começa no primeiro dia útil seguinte',
    ],
    baseLegal: 'Lei 9.784/1999, art. 66',
    hash: 'xyz',
    modalidadesAdmitidas: null,
  },
  {
    codigo: 'SEM-INVARIANTE',
    versao: 'v1',
    tipo: 'algoritmo_contagem_prazo',
    esquemaArgs: {},
    // O contrato tipa o campo como JSON solto: o que não for lista de texto é descartado.
    invariantes: {},
    baseLegal: 'Lei 9.784/1999, art. 66',
    hash: 'abc',
    modalidadesAdmitidas: null,
  },
];

/**
 * O processo como o servidor o devolve depois de gravar: a etapa que subiu sem
 * `id` volta com o que ele atribuiu.
 */
const PROCESSO_COM_ETAPA_GRAVADA = {
  id: PROCESSO_ID,
  nome: 'Vestibular 2026.1',
  tipoProcesso: {
    origemId: '01960000-0000-7000-0000-0000000000t1',
    codigo: 'VESTIBULAR',
    nome: 'Vestibular',
  },
  status: 'rascunho',
  origemCandidatos: 'inscricaoPropria',
  unidadeAdministradora: {
    origemId: '01960000-0000-7000-0000-0000000000u1',
    sigla: 'IGE',
    slug: 'ige',
    nome: 'Instituto de Geociências e Engenharias',
  },
  localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  etapas: [
    {
      id: ID_ETAPA_GRAVADA,
      nome: 'Prova objetiva',
      carater: 'classificatoria',
      tipoEtapa: { origemId: TIPO_ETAPA, codigo: 'PROVA_OBJETIVA', nome: 'Prova objetiva' },
      peso: 1,
      notaMinima: null,
      ordem: 1,
    },
  ],
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
  configuracaoTaxaInscricao: { cobra: false, valor: null, fundamentos: [] },
};

describe('CronogramaStepComponent', () => {
  let componente: CronogramaStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;
  let nativo: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CronogramaStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        CatalogosDoCronogramaService,
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
    nativo = fixture.nativeElement as HTMLElement;

    detectar();

    for (const requisicao of controller.match(() => true)) {
      const { url } = requisicao.request;
      if (url.includes('fatos-candidato')) requisicao.flush([]);
      else if (url.includes('fases-canonicas')) requisicao.flush(FASES_CANONICAS);
      else if (url.includes('tipos-etapa')) requisicao.flush(TIPOS_ETAPA);
      else if (requisicao.request.params.get('tipo') === 'algoritmo_contagem_prazo') {
        requisicao.flush(REGRAS_CONTAGEM);
      } else requisicao.flush([]);
    }
    detectar();
  });

  afterEach(() => controller.verify());

  /** Deixa a cadeia de `await` do comando avançar antes da próxima expectativa. */
  const proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

  /**
   * A última gravação do passo: relê as fases para traduzir o código canônico que o
   * rascunho guarda no id que a exigência referencia, e substitui a árvore documental.
   */
  const gravouExigencias = async () => {
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
    controller.expectOne(ROTA_DOCUMENTOS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
  };

  /**
   * As etapas e a releitura que recolhe os identificadores que o servidor atribuiu. Vem DEPOIS
   * do cronograma: a etapa declara a fase em que acontece, e o servidor recusa etapa cuja fase
   * ainda não esteja lá.
   */
  const gravouEtapas = async () => {
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
  };

  /** As ordens que o corpo do comando de cronograma declara. */
  const ordensDe = (corpo: unknown): number[] =>
    (corpo as { ordem: number }[]).map((fase) => fase.ordem);

  function comFases(...ids: readonly string[]): void {
    store.patchObjectSection('cronograma', {
      fases: ids.map((faseCanonicaId, indice) => ({
        faseCanonicaId,
        codigo: FASES_CANONICAS.find((f) => f.id === faseCanonicaId)?.codigo ?? '',
        ordem: indice + 1,
        inicio: '2026-03-01T08:00:00-03:00',
        fim: '2026-03-10T18:00:00-03:00',
        produtos: [],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: null,
        congelados: null,
      })),
    });
    detectar();
  }

  /** Uma fase única que declara o que publica, sem que este passo o edite. */
  function comFaseQuePublica(
    produtos: readonly ProdutoDaFase[],
    bancasRequeridas: readonly BancaRequeridaDaFase[] = [],
  ): void {
    store.patchObjectSection('cronograma', {
      fases: [
        {
          faseCanonicaId: ID_RESULTADO,
          codigo: 'RESULTADO_FINAL',
          ordem: 1,
          inicio: '2026-03-01T08:00:00-03:00',
          fim: '2026-03-10T18:00:00-03:00',
          produtos,
          faseConcluinteCodigo: 'RECURSOS',
          emiteParecerIndividual: true,
          bancasRequeridas,
          regraRecurso: null,
          congelados: null,
        },
        // A fase concluinte precisa estar na linha do tempo, publicar a
        // definitiva e vir depois — é o que a conferência do passo confere.
        {
          faseCanonicaId: FASE_SUMIDA,
          codigo: 'RECURSOS',
          ordem: 2,
          inicio: '2026-03-12T08:00:00-03:00',
          fim: '2026-03-20T18:00:00-03:00',
          produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
          faseConcluinteCodigo: null,
          emiteParecerIndividual: false,
          bancasRequeridas: [],
          regraRecurso: null,
          congelados: {
            donoTipico: 'CEPS',
            origemData: 'PROPRIA',
            agrupaEtapas: false,
            coletaInscricao: false,
            permiteComplementacao: false,
            coletaSolicitacaoIsencao: false,
            bancas: [],
          },
        },
      ],
    });
    detectar();
  }

  /** Fases cujo processo congelou atributos diferentes dos do catálogo. */
  function comFasesCongeladas(
    ...declaradas: readonly { id: string; agrupaEtapas: boolean }[]
  ): void {
    store.patchObjectSection('cronograma', {
      fases: declaradas.map((fase, indice) => ({
        faseCanonicaId: fase.id,
        codigo: 'FASE_CONGELADA',
        ordem: indice + 1,
        inicio: '2026-03-01T08:00:00-03:00',
        fim: '2026-03-10T18:00:00-03:00',
        produtos: [],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: null,
        congelados: {
          donoTipico: 'CEPS',
          origemData: 'PROPRIA',
          agrupaEtapas: fase.agrupaEtapas,
          coletaInscricao: false,
          permiteComplementacao: fase.permiteComplementacao,
          coletaSolicitacaoIsencao: false,
          bancas: [],
        },
      })),
    });
    detectar();
  }

  /** Uma etapa por código de fase informado, na ordem em que chegam. */
  function comEtapasEmFases(codigos: readonly string[]): void {
    store.patchObjectSection('cronograma', {
      etapas: codigos.map((faseCodigo, posicao) => ({
        id: null,
        nome: `Etapa ${posicao + 1}`,
        carater: 'classificatoria' as const,
        tipoEtapaOrigemId: TIPO_ETAPA,
        peso: '1',
        notaMinima: '',
        ordem: posicao + 1,
        faseCodigo,
        produtos: [],
        inicio: '',
        fim: '',
        emiteParecerIndividual: false,
        bancas: [],
        recursos: [],
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

  /** Valores das `<option>` do seletor de convenção, na ordem em que aparecem. */
  function opcoesDaConvencao(): string[] {
    return Array.from(
      nativo.querySelectorAll<HTMLOptionElement>('#cr-algoritmo-contagem option'),
    ).map((opcao) => opcao.value);
  }

  /**
   * O rascunho é o que persiste entre passos e o que a hidratação preenche. O
   * formulário precisa refletir o que chega de fora — sem isso, reabrir um
   * processo mostraria a linha do tempo vazia sobre um cronograma que existe.
   */
  it('espelha no formulário o cronograma que chega ao rascunho', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comUmaEtapa();

    expect(componente.fases.length).toBe(2);
    expect(componente.fases.at(0).controls.faseCanonicaId.value).toBe(ID_INSCRICAO);
    expect(componente.fases.at(0).controls.inicio.value).toBe('2026-03-01T08:00');
    expect(componente.etapas.length).toBe(1);
    expect(componente.etapas.at(0).controls.nome.value).toBe('Prova objetiva');
  });

  /**
   * O caminho de volta: o que se digita no controle é o que a gravação envia, e
   * o que os outros passos leem pelo rascunho.
   */
  /**
   * O rascunho é reescrito a cada tecla pelo caminho de volta, e o espelho
   * responde a essa mudança. Se ele reconstruísse os controles quando o
   * conteúdo é o mesmo, o campo em que se digita seria recriado a cada letra —
   * e o foco iria embora junto.
   */
  it('não recria os controles quando o rascunho recebe o que já está na tela', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comUmaEtapa();
    const antes = componente.fases.controls;
    const antesEtapa = componente.etapas.at(0);

    componente.fases.at(0).controls.inicio.setValue('2026-03-02T09:00');
    detectar();

    expect(componente.fases.controls[0]).toBe(antes[0]);
    expect(componente.fases.controls[1]).toBe(antes[1]);
    expect(componente.etapas.at(0)).toBe(antesEtapa);
  });

  it('leva ao rascunho o que foi digitado no controle', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    componente.etapas.at(0).controls.peso.setValue('2,5');

    expect(store.draft().cronograma.etapas[0].peso).toBe('2,5');
  });

  /**
   * Fora de rascunho — e durante uma gravação — o passo não aceita digitação. O
   * formulário acompanha o que o wizard já decide para os outros passos, em vez
   * de deixar campos editáveis cujo valor não teria para onde ir.
   */
  it('desabilita os controles enquanto o passo não aceita edição', () => {
    comFases(ID_INSCRICAO);
    expect(componente.formulario.enabled).toBe(true);

    // `salvando` é o outro motivo pelo qual o passo para de aceitar digitação,
    // e o que este teste alcança sem simular um processo publicado inteiro.
    store.salvando.set(true);
    detectar();

    expect(componente.formulario.disabled).toBe(true);
  });

  /**
   * O que a fase congelou vale sobre o catálogo, não o contrário. Editar a fase
   * canônica depois que um processo a congelou não pode mudar o que aquele
   * processo exige — ligar `agrupaEtapas` faria a conferência cobrar etapas de
   * um edital que nunca as teve.
   */
  it('descreve a fase pelo que ela congelou, mesmo com o catálogo dizendo outra coisa', () => {
    comFasesCongeladas({ id: ID_INSCRICAO, agrupaEtapas: true });

    const item = componente.linhaDoTempo()[0];

    expect(item.exigencias?.agrupaEtapas).toBe(
      true,
      'o catálogo diz que COLETA_INSCRICAO não agrupa; o processo congelou que agrupa',
    );
    expect(item.foraDoCatalogo).toBe(false);
  });

  /**
   * A fase inativada some do catálogo, mas continua no processo. Conferir só
   * pelo catálogo vivo faria as etapas dela parecerem órfãs, e a gravação nunca
   * sairia.
   */
  it('confere pela fase congelada quando a entrada saiu do catálogo', () => {
    comFasesCongeladas({ id: FASE_SUMIDA, agrupaEtapas: true });
    comUmaEtapa();

    expect(componente.linhaDoTempo()[0].foraDoCatalogo).toBe(true);
    expect(componente.problemas()).not.toContainEqual(
      expect.stringContaining('fase de avaliação que as agrupa'),
    );
  });

  it('oferece cada fase canônica uma vez só', () => {
    comFases(ID_INSCRICAO);

    const disponiveis = componente.fasesDisponiveis().map((fase) => fase.id);

    expect(disponiveis).not.toContain(ID_INSCRICAO);
    expect(disponiveis).toContain(ID_AVALIACAO);
  });

  /**
   * A última fase sai como qualquer outra.
   *
   * Travar o botão obrigava a acrescentar a fase certa ANTES de tirar a errada — ordem
   * invertida para quem escolheu a fase errada e só tem aquela. O cronograma vazio continua
   * recusado, mas pela conferência do passo, que é onde as demais faltas também aparecem:
   * a tela deixa editar e diz o que falta antes de gravar, em vez de impedir a edição.
   */
  it('deixa remover a última fase, e a conferência é quem cobra o cronograma vazio', () => {
    comFases(ID_INSCRICAO);

    componente.removerFase(0);

    expect(store.draft().cronograma.fases).toHaveLength(0);
    expect(componente.validate().messages).toContain('O cronograma precisa de ao menos uma fase.');
  });

  /**
   * As etapas vivem no agregado, não na fase. Removê-la sem levá-las deixaria
   * etapas sem a fase que as avalia — e a recusa só apareceria na publicação,
   * apontando para outro lugar.
   */
  // ── Linha do tempo colapsada ──

  /**
   * O passo se chama linha do tempo, e é isso que ele mostra ao abrir: os cabeçalhos das
   * fases. Com tudo aberto, o certame com sete fases tinha trinta e sete telas de rolagem.
   */
  it('abre com todas as fases fechadas', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);

    expect(componente.faseExpandida(0)).toBe(false);
    expect(componente.faseExpandida(1)).toBe(false);
    expect(nativo.querySelectorAll('.fase-bloco--aberta')).toHaveLength(0);
  });

  it('abre e fecha a fase pelo cabeçalho', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);

    componente.alternarFase(1);
    detectar();
    expect(componente.faseExpandida(1)).toBe(true);
    expect(componente.faseExpandida(0)).toBe(false, 'abrir uma não fecha a outra');

    componente.alternarFase(1);
    expect(componente.faseExpandida(1)).toBe(false);
  });

  /** Fechada, a fase diz o que há dentro dela — senão abrir vira tentativa e erro. */
  it('a fase fechada conta as etapas que acontecem nela', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO', 'AVALIACAO', 'COLETA_INSCRICAO']);

    expect(componente.marcasDaFase(1)).toEqual(['2 etapas']);
    expect(componente.marcasDaFase(0)).toEqual(['1 etapa']);
  });

  /**
   * A conferência acusa problemas em qualquer fase, e a mensagem aponta para uma que pode
   * estar fechada. Recusar sem abrir deixaria o operador procurando o erro no escuro.
   */
  it('a recusa da conferência abre todas as fases', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    componente.etapas.at(0).controls.nome.setValue('');
    detectar();

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    expect(componente.faseExpandida(0)).toBe(true);
    controller.expectNone(ROTA_ETAPAS);
  });

  /**
   * O recorte vem do cadastro, não de uma lista de códigos na tela: um tipo que não compõe a
   * nota final não pode oferecer caráter que pontua, e é isso que faz o peso desaparecer.
   */
  it('o caráter oferecido segue o que o tipo de etapa admite', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    const etapa = componente.etapas.at(0);

    expect(componente.caracteresPara(etapa).map((o) => o.valor)).toEqual([
      'classificatoria',
      'eliminatoria',
      'ambas',
    ]);

    componente.escolherTipoEtapa(etapa, TIPO_ETAPA_SO_ELIMINA);
    detectar();

    expect(componente.caracteresPara(etapa).map((o) => o.valor)).toContain('eliminatoria');
    expect(componente.caracteresPara(etapa).map((o) => o.valor)).not.toContain('ambas');
  });

  /**
   * Trocar o tipo não apaga o caráter já declarado: o campo continuaria mostrando um valor que
   * o cadastro recusa, e a recusa da gravação não diria qual. Ele fica na lista, nomeado.
   */
  it('o caráter que o tipo deixou de admitir permanece visível, marcado', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    const etapa = componente.etapas.at(0);

    componente.escolherTipoEtapa(etapa, TIPO_ETAPA_SO_ELIMINA);
    detectar();

    expect(etapa.controls.carater.value).toBe('classificatoria', 'o valor declarado permanece');
    const marcada = componente
      .caracteresPara(etapa)
      .find((opcao) => opcao.valor === 'classificatoria');
    expect(marcada?.rotulo).toContain('não mais admitido');
  });

  /** Sem tipo escolhido o cadastro não tem o que restringir — a etapa ainda não se declarou. */
  it('sem tipo escolhido, oferece os três caracteres', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    const etapa = componente.etapas.at(0);

    componente.escolherTipoEtapa(etapa, '');
    detectar();

    expect(componente.caracteresPara(etapa)).toHaveLength(3);
  });

  it('abre a etapa pelo resumo, e mais de uma ao mesmo tempo', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO', 'AVALIACAO']);
    componente.alternarFase(0);
    detectar();

    expect(componente.etapaAberta(0)).toBe(false, 'a etapa chega fechada');

    componente.alternarEtapa(0);
    componente.alternarEtapa(1);
    detectar();

    expect(componente.etapaAberta(0)).toBe(true);
    expect(componente.etapaAberta(1)).toBe(true);
  });

  /** Fechada, a etapa mostra só o que já está declarado — é assim que a lista distingue. */
  it('a etapa fechada resume o que já declarou', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    componente.alternarFase(0);
    detectar();

    const etapa = componente.etapas.at(0);
    expect(componente.marcasDaEtapa(etapa)).toEqual(['Prova objetiva']);

    componente.acrescentarRecursoNaEtapa(etapa);
    detectar();

    expect(componente.marcasDaEtapa(etapa)).toContain('1 recurso');
  });

  /**
   * Terceiro nível do mesmo padrão: o bloco que cresce com o que se declara nele também
   * chega recolhido, com a contagem no cabeçalho.
   */
  it('os blocos que crescem dentro da etapa chegam recolhidos', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    componente.alternarFase(0);
    componente.alternarEtapa(0);
    detectar();

    expect(componente.blocoAberto(0, 'recursos')).toBe(false);
    expect(componente.blocoAberto(0, 'publica')).toBe(false);
    expect(componente.resumoDosRecursos(componente.etapas.at(0))).toBe('nenhum recurso');
    expect(componente.resumoDasPublicacoes(componente.etapas.at(0))).toBe('não publica nada');
  });

  it('o cabeçalho do bloco conta o que há dentro dele', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const etapa = componente.etapas.at(0);

    componente.acrescentarRecursoNaEtapa(etapa);
    componente.acrescentarRecursoNaEtapa(etapa);
    detectar();

    expect(componente.resumoDosRecursos(etapa)).toBe('2 recursos');
  });

  it('abrir um bloco de uma etapa não abre o da outra', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO', 'AVALIACAO']);
    componente.alternarFase(0);
    detectar();

    componente.alternarBloco(0, 'recursos');

    expect(componente.blocoAberto(0, 'recursos')).toBe(true);
    expect(componente.blocoAberto(1, 'recursos')).toBe(false);
    expect(componente.blocoAberto(0, 'publica')).toBe(false, 'cada bloco tem o seu estado');
  });

  /**
   * Quem decide se peso e nota mínima têm o que fazer é o CARÁTER, não o tipo: o divisor da
   * média soma o peso de quem compõe nota e ignora a eliminatória pura.
   */
  it('peso só aparece na etapa que compõe a nota final', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const etapa = componente.etapas.at(0);

    componente.escolherCarater(etapa, 'classificatoria');
    expect(componente.etapaComponeNota(etapa)).toBe(true);
    expect(componente.etapaElimina(etapa)).toBe(false);

    componente.escolherCarater(etapa, 'eliminatoria');
    expect(componente.etapaComponeNota(etapa)).toBe(false);
    expect(componente.etapaElimina(etapa)).toBe(true);

    componente.escolherCarater(etapa, 'ambas');
    expect(componente.etapaComponeNota(etapa)).toBe(true);
    expect(componente.etapaElimina(etapa)).toBe(true);
  });

  /**
   * Sem isto, quem declara peso e depois muda para eliminatória fica com o valor gravado e
   * invisível — indo ao servidor a cada gravação, sem que nada o use.
   */
  it('trocar o caráter apaga o campo que deixou de valer', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const etapa = componente.etapas.at(0);
    etapa.controls.peso.setValue('3');
    etapa.controls.notaMinima.setValue('5');

    componente.escolherCarater(etapa, 'eliminatoria');

    expect(etapa.controls.peso.value).toBe('', 'a eliminatória não entra no divisor da média');
    expect(etapa.controls.notaMinima.value).toBe('5', 'o corte continua sendo dela');

    componente.escolherCarater(etapa, 'classificatoria');

    expect(etapa.controls.notaMinima.value).toBe('', 'quem não elimina não tem corte');
  });

  it('a etapa sem nome aparece na lista mesmo assim', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    componente.etapas.at(0).controls.nome.setValue('   ');

    expect(componente.nomeDaEtapa(componente.etapas.at(0))).toBe('Etapa sem nome');
  });

  /**
   * A etapa existe por causa da fase em que acontece: some a fase, some ela. O que a
   * gravação recusava antes — etapa apontando para uma fase que não está mais no cronograma
   * — deixa de poder acontecer.
   */
  it('remover a fase leva junto as etapas que declaram acontecer nela', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    componente.removerFase(1);

    expect(store.draft().cronograma.fases).toHaveLength(1);
    expect(store.draft().cronograma.etapas).toEqual([]);
  });

  /**
   * O defeito que existia: remover a fase que o cadastro marca como agrupadora limpava todas
   * as etapas do processo, inclusive as das outras fases.
   */
  it('remover a fase não toca nas etapas das outras', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO', 'INSCRICAO', 'INSCRICAO']);

    componente.removerFase(1);

    expect(store.draft().cronograma.etapas).toHaveLength(2);
    expect(store.draft().cronograma.etapas.map((e) => e.faseCodigo)).toEqual([
      'INSCRICAO',
      'INSCRICAO',
    ]);
  });

  /** Etapa que não declara fase nenhuma não pertence a nenhuma, e não sai com a remoção. */
  it('remover a fase preserva a etapa que não declara fase', () => {
    comFases(ID_AVALIACAO, ID_INSCRICAO);
    comUmaEtapa();

    componente.removerFase(1);

    expect(store.draft().cronograma.etapas).toHaveLength(1);
  });

  it('conta o que a remoção leva junto antes de acontecer', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO', 'AVALIACAO']);

    componente.pedirRemocaoDaFase(1);
    detectar();

    expect(componente.remocaoAConfirmar()).toBe(1);
    expect(componente.resumoDaRemocao(1)).toBe('2 etapas');
    expect(store.draft().cronograma.fases).toHaveLength(2, 'nada sai antes de confirmar');
    expect(nativo.textContent).toContain('apaga também 2 etapas desta fase');
  });

  /** Sem nada pendurado não há o que avisar: perguntar seria cerimônia vazia. */
  it('remove direto a fase que não tem etapa nem documento', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);

    componente.pedirRemocaoDaFase(1);

    expect(componente.remocaoAConfirmar()).toBeNull();
    expect(store.draft().cronograma.fases).toHaveLength(1);
  });

  it('desistir da remoção mantém a fase e o que é dela', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    componente.pedirRemocaoDaFase(1);
    componente.desistirDaRemocao();

    expect(store.draft().cronograma.fases).toHaveLength(2);
    expect(store.draft().cronograma.etapas).toHaveLength(1);
  });

  /**
   * Toda troca entre fases vizinhas forma o ciclo de ordem que o servidor não
   * aplica numa chamada só. Recusar aqui deixaria a linha do tempo impossível
   * de reordenar — o rascunho aceita, e quem arbitra é a gravação.
   */
  it('reordena no rascunho, renumerando a partir de 1', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);

    componente.mover(0, 1);

    const depois = store.draft().cronograma.fases;
    expect(depois.map((fase) => fase.faseCanonicaId)).toEqual([ID_AVALIACAO, ID_INSCRICAO]);
    expect(depois.map((fase) => fase.ordem)).toEqual([1, 2]);
  });

  /**
   * Toda reordenação é uma permutação de 1..N, e toda permutação não-trivial
   * fecha o ciclo que o servidor recusa numa chamada só. Mandar o operador
   * "mover uma para o fim" não resolvia: renumerar devolve 1..N e o ciclo
   * volta. A gravação passa por uma faixa que ninguém ocupa e fecha a ordem
   * pretendida em seguida, sem pedir nada a quem edita.
   */
  it('resolve o ciclo de ordem gravando por uma faixa livre', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO, ID_INSCRICAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    const pretendida = controller.expectOne(ROTA_FASES);
    expect(ordensDe(pretendida.request.body)).toEqual([1, 2]);
    pretendida.flush(CICLO_DE_ORDEM, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    await proximoPasso();

    const intermediaria = controller.expectOne(ROTA_FASES);
    expect(ordensDe(intermediaria.request.body)).toEqual(
      [3, 4],
      'a faixa livre é a que nenhuma fase ocupa hoje',
    );
    intermediaria.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    const final = controller.expectOne(ROTA_FASES);
    expect(ordensDe(final.request.body)).toEqual([1, 2]);
    final.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();

    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  /**
   * Quando nem a gravação em duas etapas resolve, a recusa precisa dizer o que
   * fazer — a mensagem do servidor descreve o ciclo, não o caminho.
   */
  it('orienta a gravar em duas vezes quando o ciclo persiste', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO, ID_INSCRICAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    // Duas tentativas: a ordem pretendida e a faixa livre — as duas recusadas.
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      controller.expectOne(ROTA_FASES).flush(CICLO_DE_ORDEM, {
        status: 422,
        statusText: 'Unprocessable Content',
        headers: PROBLEM_JSON,
      });
      await proximoPasso();
    }
    controller.expectNone(ROTA_ETAPAS);

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('duas gravações');
  });

  it('renumera a partir de 1 ao acrescentar fase', () => {
    comFases(ID_INSCRICAO);
    componente.formulario.controls.faseAAcrescentar.setValue(ID_AVALIACAO);

    componente.acrescentarFase();

    expect(store.draft().cronograma.fases.map((fase) => fase.ordem)).toEqual([1, 2]);
    expect(componente.formulario.controls.faseAAcrescentar.value).toBe('');
  });

  /**
   * A hora digitada vale no fuso do certame. Guardá-la como veio do campo — sem
   * fuso — deixaria o instante à mercê de quem o lê depois.
   */
  it('grava a janela como instante no fuso institucional', () => {
    comFases(ID_INSCRICAO);

    componente.fases.at(0).controls.inicio.setValue('2026-03-05T09:30');

    expect(store.draft().cronograma.fases[0].inicio).toBe('2026-03-05T09:30:00-03:00');
    // O controle guarda a hora de parede; quem carimba o fuso é a saída para o
    // rascunho, e é ela que o campo lê de volta ao reabrir o processo.
    expect(componente.fases.at(0).controls.inicio.value).toBe('2026-03-05T09:30');
  });

  it('campo de janela esvaziado volta a não declarar instante', () => {
    comFases(ID_INSCRICAO);

    componente.fases.at(0).controls.fim.setValue('');

    expect(store.draft().cronograma.fases[0].fim).toBeNull();
  });

  /**
   * A etapa declara a fase em que acontece, e o servidor recusa etapa cuja fase ainda não esteja
   * no cronograma. Quem monta um certame do zero — nenhuma fase gravada — não conseguiria
   * gravar etapa nenhuma na ordem inversa.
   */
  it('grava o cronograma de fases antes das etapas', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    const fases = controller.expectOne(ROTA_FASES);
    expect(fases.request.method).toBe('PUT');
    controller.expectNone(ROTA_ETAPAS);
    fases.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    const etapas = controller.expectOne(ROTA_ETAPAS);
    expect(etapas.request.method).toBe('PUT');
    etapas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    // A gravação de etapas responde 204 sem corpo, e o `id` de uma etapa nova é
    // atribuído pelo servidor: a releitura vem logo em seguida para recolhê-los.
    const releitura = controller.expectOne(ROTA_PROCESSO);
    expect(releitura.request.method).toBe('GET');
    releitura.flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
    await gravouExigencias();

    await expect(gravacao).resolves.toEqual({ valid: true });
    expect(store.draft().cronograma.etapas[0].id).toBe(ID_ETAPA_GRAVADA);
  });

  /**
   * O cronograma vem primeiro: recusado ele, as etapas não chegam a ser enviadas. É o que
   * evita deixar no servidor etapas apontando para uma fase que a recusa impediu de existir —
   * e é por isso que o rascunho segue sem os identificadores que só a gravação atribui.
   */
  it('não envia as etapas quando o cronograma é recusado', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    controller.expectOne(ROTA_FASES).flush(
      {
        type: 'about:blank',
        title: 'Cronograma recusado',
        status: 422,
        code: 'uniplus.selecao.fase_cronograma.invalida',
        traceId: '00000000000000000000000000000004',
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    await proximoPasso();
    controller.expectNone(ROTA_ETAPAS);

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(store.draft().cronograma.etapas[0].id).toBeNull(
      'sem gravação de etapas não há identificador a recolher',
    );
  });

  /**
   * O cenário que corrompe: o `PUT` das etapas passa, a releitura que recolheria
   * os identificadores não vem, e o botão de gravar volta a ficar disponível.
   * Sem o bloqueio, a segunda gravação reenvia etapas que já existem sem o
   * `id`, e o servidor cria outras no lugar — deixando desempate e eliminação
   * apontando para as que deixaram de existir.
   */
  it('recusa nova gravação enquanto as etapas gravadas estão sem identificador', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller
      .expectOne(ROTA_PROCESSO)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await proximoPasso();

    const primeira = await gravacao;
    expect(primeira.valid).toBe(false);
    expect(primeira.messages?.[0]).toContain('identificadores');
    expect(store.draft().cronograma.etapas[0].id).toBeNull();

    const segunda = await componente.persistir();

    expect(segunda.valid).toBe(false);
    // A prova do bug: sem o bloqueio, esta segunda gravação teria enviado as
    // etapas de novo — sem `id`, porque a releitura nunca chegou.
    controller.expectNone(ROTA_ETAPAS);
    controller.expectNone(ROTA_FASES);
  });

  it('suspende a edição enquanto a releitura não reconcilia', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller
      .expectOne(ROTA_PROCESSO)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await proximoPasso();
    await gravacao;
    detectar();

    expect(componente.edicaoLiberada()).toBe(false);
    expect(componente.formulario.disabled).toBe(true);
  });

  /**
   * A saída fica no próprio passo: refeita a releitura, os identificadores
   * chegam ao rascunho e a gravação seguinte os envia — que é o que impede a
   * recriação de acontecer mais tarde.
   */
  it('releitura bem-sucedida destrava a tela e a gravação seguinte leva o identificador', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller
      .expectOne(ROTA_PROCESSO)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await proximoPasso();
    await gravacao;

    const releitura = componente.relerEtapas();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await releitura;
    detectar();

    expect(componente.reconciliacaoPendente()).toBe(false);
    expect(componente.edicaoLiberada()).toBe(true);
    expect(store.draft().cronograma.etapas[0].id).toBe(ID_ETAPA_GRAVADA);

    const segunda = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    const reenvio = controller.expectOne(ROTA_ETAPAS);
    expect((reenvio.request.body as { id: string | null }[])[0].id).toBe(ID_ETAPA_GRAVADA);
    reenvio.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
    await gravouExigencias();
    await segunda;
  });

  /**
   * O bloqueio pertence ao processo que o provocou. Outro cadastro entrando na
   * tela recomeça do que o servidor disser sobre ele.
   */
  it('troca de processo desfaz o bloqueio da releitura', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller
      .expectOne(ROTA_PROCESSO)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await proximoPasso();
    await gravacao;

    store.reset();
    detectar();

    expect(componente.reconciliacaoPendente()).toBe(false);
  });

  /**
   * Sem a fase que as agrupa, as etapas não aparecem em nenhuma fase da linha
   * do tempo — e a conferência manda removê-las. Sem esta lista à parte, a
   * ordem é para remover algo que não está na tela.
   */
  it('mostra e remove as etapas que nenhuma fase agrupa', () => {
    comFases(ID_INSCRICAO);
    comUmaEtapa();
    detectar();

    expect(componente.etapasOrfas().map((orfa) => orfa.rotulo)).toEqual(['Prova objetiva']);
    expect(nativo.textContent ?? '').toContain('Etapas sem a fase que as agrupa');
    expect(componente.problemas().some((p) => p.includes('não dizem a que fase pertencem'))).toBe(true);

    componente.removerTodasAsEtapas();
    detectar();

    expect(componente.etapasOrfas()).toEqual([]);
    expect(store.draft().cronograma.etapas).toEqual([]);
    expect(componente.problemas().some((p) => p.includes('não dizem a que fase pertencem'))).toBe(false);
  });

  /**
   * O que a reformulação do eixo fase→etapa habilita: uma fase que o cadastro NÃO marca
   * como agrupadora passa a poder subdividir-se, porque é a etapa que declara a fase a
   * que pertence. Sem isso, a habilitação com oito etapas — que todas as três planilhas
   * do CEPS descrevem — não tem onde existir.
   */
  it('acrescenta etapa em fase que o cadastro não marca como agrupadora', () => {
    comFases(ID_INSCRICAO);
    detectar();

    componente.acrescentarEtapa('COLETA_INSCRICAO');
    detectar();

    expect(componente.etapasDaFase('COLETA_INSCRICAO', false)).toHaveLength(1);
    expect(componente.etapasOrfas()).toEqual([]);
  });

  it('mantém cada etapa na fase que ela declara', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    detectar();

    componente.acrescentarEtapa('COLETA_INSCRICAO');
    componente.acrescentarEtapa('AVALIACAO');
    detectar();

    expect(componente.etapasDaFase('COLETA_INSCRICAO', false)).toHaveLength(1);
    expect(componente.etapasDaFase('AVALIACAO', true)).toHaveLength(1);
  });

  it('envia ao comando a fase que a etapa declara', () => {
    comFases(ID_INSCRICAO);
    detectar();

    componente.acrescentarEtapa('COLETA_INSCRICAO');
    detectar();

    expect(store.draft().cronograma.etapas[0].faseCodigo).toBe('COLETA_INSCRICAO');
  });

  it('não repete como órfã a etapa que a fase de avaliação já agrupa', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    expect(componente.etapasOrfas()).toEqual([]);
  });

  /**
   * O ato cujo rótulo o catálogo não resolve descreve o cronograma gravado do
   * mesmo jeito. Escondê-lo faria a fase parecer publicar menos do que publica.
   */
  it('mostra pelo código o ato que o catálogo não nomeia', () => {
    comFaseQuePublica([{ atoCodigo: 'EDITAL_ANTIGO', papel: 'PRELIMINAR' }]);

    const mostrados = componente.produtosDaFase(componente.fases.at(0));

    expect(mostrados).toEqual([
      { atoCodigo: 'EDITAL_ANTIGO', nome: 'EDITAL_ANTIGO', papel: 'resultado preliminar' },
    ]);
  });

  /**
   * O papel que esta tela ainda não sabe nomear aparece como veio: inventar
   * rótulo para o desconhecido esconderia do operador que a fase declara algo
   * que a tela não descreve.
   */
  it('mostra o papel desconhecido pelo token que o contrato entregou', () => {
    comFaseQuePublica([{ atoCodigo: 'EDITAL', papel: 'RETIFICACAO' }]);

    expect(componente.produtosDaFase(componente.fases.at(0))[0].papel).toBe('RETIFICACAO');
  });

  /**
   * A prova do apagamento silencioso: produtos, fase concluinte e parecer
   * individual não são editados neste passo, e a gravação substitui o
   * cronograma inteiro. Fora do formulário, uma simples mudança de data os
   * apagaria — junto com o que a fase produz e com a âncora do recurso, que
   * deles derivam.
   */
  it('reenvia na gravação o que a tela não edita, depois de mexer na janela', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFaseQuePublica([
      { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
      { atoCodigo: 'COMUNICADO', papel: null },
    ]);

    componente.fases.at(0).controls.fim.setValue('2026-03-11T18:00');
    detectar();

    const gravacao = componente.persistir();
    const enviadas = controller.expectOne(ROTA_FASES);

    expect(
      (
        enviadas.request.body as {
          produtos: unknown;
          faseConcluinteCodigo: unknown;
          emiteParecerIndividual: unknown;
        }[]
      )[0],
    ).toMatchObject({
      produtos: [
        { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
        { atoCodigo: 'COMUNICADO', papel: null },
      ],
      faseConcluinteCodigo: 'RECURSOS',
      emiteParecerIndividual: true,
    });

    enviadas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    await gravacao;
  });

  /**
   * As bancas requeridas e o recorte que cada uma julga passaram a ser editados
   * na superfície da fase, e este passo apenas os carrega. A gravação substitui
   * a coleção inteira: sem reenviá-los, mudar uma data desfaria a competência
   * declarada de cada banca.
   */
  it('reenvia na gravação as bancas requeridas com o recorte de cada uma', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFaseQuePublica(
      [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
      [
        { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RACA] },
        { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RENDA] },
      ],
    );

    componente.fases.at(0).controls.fim.setValue('2026-03-11T18:00');
    detectar();

    const gravacao = componente.persistir();
    const enviadas = controller.expectOne(ROTA_FASES);

    expect((enviadas.request.body as { bancasRequeridas: unknown }[])[0].bancasRequeridas).toEqual([
      { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RACA] },
      { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RENDA] },
    ]);

    enviadas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    await gravacao;
  });

  /** Etapa recusada interrompe o passo: as exigências documentais dependem dela e não vão. */
  it('não tenta gravar as exigências quando as etapas são recusadas', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    controller.expectOne(ROTA_ETAPAS).flush(
      {
        type: 'about:blank',
        title: 'Etapa recusada',
        status: 422,
        code: 'uniplus.selecao.etapa_processo.invalida',
        traceId: '00000000000000000000000000000001',
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    await proximoPasso();

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_DOCUMENTOS);
  });

  /**
   * As duas gravações passaram, mas sem os ids relidos a próxima omitiria o
   * identificador de etapas que já existem. Reportar sucesso aqui deixaria o
   * operador seguir para o estado que a releitura existe para impedir.
   */
  it('recusa a gravação quando não consegue reler as etapas', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    controller.expectOne(ROTA_PROCESSO).flush(
      {
        type: 'about:blank',
        title: 'Indisponível',
        status: 503,
        code: 'uniplus.selecao.indisponivel',
        traceId: '00000000000000000000000000000003',
      },
      { status: 503, statusText: 'Service Unavailable', headers: PROBLEM_JSON },
    );
    await proximoPasso();

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('Releia as etapas');
    controller.expectNone(ROTA_FASES);
  });

  /**
   * A navegação do wizard é livre: dá para editar outro passo sem gravá-lo e
   * vir gravar o cronograma. Hidratar o processo inteiro aqui apagaria aquele
   * trabalho, por causa de uma gravação que nem era daquele passo.
   */
  it('reconcilia só as etapas, preservando o que outro passo tem sem gravar', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    // `nome` é campo que a hidratação completa sobrescreve com o do servidor —
    // é por ele que se enxerga a diferença entre projetar as etapas e projetar
    // o processo inteiro.
    store.patchObjectSection('identificacao', { nome: 'Nome ainda não gravado' });

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();

    await gravacao;

    expect(store.draft().cronograma.etapas[0].id).toBe(ID_ETAPA_GRAVADA);
    expect(store.draft().identificacao.nome).toBe('Nome ainda não gravado');
  });

  /**
   * Um tipo inativo não volta a ser escolha nova, mas continua descrevendo a
   * etapa que o gravou — sem ele na lista o campo aparece em branco, e o
   * operador grava por cima sem ver o que estava configurado.
   */
  it('mantém no seletor o tipo de etapa inativo que a etapa já referencia', () => {
    const inativo = '01960000-0000-7000-0000-0000000000e9';
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    componente.etapas.at(0).controls.tipoEtapaOrigemId.setValue(inativo);

    const oferecidos = componente
      .tiposEscolhiveisPara(componente.etapas.at(0))
      .map((tipo) => tipo.id);

    expect(oferecidos).toContain(inativo);
    expect(oferecidos).toContain(TIPO_ETAPA);
  });

  /**
   * É o `id` que critério de desempate e regra de eliminação referenciam.
   * Reordenar removendo e recriando daria outro identificador no servidor, e
   * essas regras ficariam apontando para uma etapa que deixou de existir — por
   * isso o grupo é movido, não recriado.
   */
  it('reordena as etapas preservando o identificador de cada uma', () => {
    comFases(ID_AVALIACAO);
    store.patchObjectSection('cronograma', {
      etapas: [
        {
          id: 'etapa-primeira',
          nome: 'Prova',
          carater: 'classificatoria' as const,
          tipoEtapaOrigemId: TIPO_ETAPA,
          peso: '1',
          notaMinima: '',
          ordem: 1,
        },
        {
          id: 'etapa-segunda',
          nome: 'Redação',
          carater: 'classificatoria' as const,
          tipoEtapaOrigemId: TIPO_ETAPA,
          peso: '2',
          notaMinima: '',
          ordem: 2,
        },
      ],
    });
    detectar();

    componente.moverEtapa(0, 1);

    const depois = store.draft().cronograma.etapas;
    expect(depois.map((etapa) => etapa.id)).toEqual(['etapa-segunda', 'etapa-primeira']);
    expect(depois.map((etapa) => etapa.ordem)).toEqual([1, 2]);
    expect(depois.map((etapa) => etapa.nome)).toEqual(['Redação', 'Prova']);
  });

  it('recusa gravar enquanto a conferência aponta problema, sem chamar a API', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_ETAPAS);
    controller.expectNone(ROTA_FASES);
  });

  // ─── Convenção de contagem de prazo (#480) ──────────────────────────────

  /** CA-05: ausência é estado válido enquanto rascunho — nenhum default. */
  it('não pré-seleciona nenhuma convenção de contagem de prazo', () => {
    expect(componente.formulario.controls.algoritmoContagemCodigo.value).toBe('');
    expect(componente.formulario.controls.algoritmoContagemVersao.value).toBe('');
    expect(
      nativo.querySelector<HTMLSelectElement>('#cr-algoritmo-contagem')?.value ?? '',
    ).toBe('');
  });

  /**
   * O endpoint não tem operação de remoção — `DefinirAlgoritmoContagemPrazoRequest`
   * exige `codigo` e `versao`. Enquanto nada foi declarado, a opção continua
   * disponível: é o caminho normal para a primeira escolha.
   */
  it('não esconde a opção de remover enquanto a escolha ainda não foi gravada', () => {
    componente.escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    expect(opcoesDaConvencao()).toContain('');
  });

  /**
   * A prova do bug que esta Story fecha: sem esconder a opção, o operador
   * escolhia "Nenhuma convenção declarada" sobre um processo que já tinha
   * convenção no servidor, `persistir()` pulava a terceira chamada em
   * silêncio e devolvia sucesso — a tela passava a mostrar "nenhuma" enquanto
   * o servidor continuava com a convenção anterior, e a divergência só
   * aparecia ao recarregar o processo.
   */
  it('esconde a opção de remover a convenção depois que ela chega declarada do servidor', () => {
    // `remoteSnapshot`, não `patchObjectSection`: é a última leitura completa
    // do servidor, não uma escrita local — molde de
    // `pagamento.component.spec.ts:511` e `anexo-edital.component.spec.ts:332`.
    store.remoteSnapshot.set({
      algoritmoContagemPrazo: { codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL', versao: 'v1' },
    } as never);
    detectar();

    expect(opcoesDaConvencao()).not.toContain('');
  });

  it('esconde a opção de remover a convenção logo após gravá-la nesta sessão', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_INSCRICAO);
    componente.escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    controller.expectOne(ROTA_ALGORITMO).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravacao;
    detectar();

    expect(opcoesDaConvencao()).not.toContain('');
  });

  /**
   * Falha na terceira chamada não confirma nada no servidor — a opção de
   * "nenhuma" continua disponível para a retentativa, exatamente como antes.
   */
  it('mantém a opção de remover disponível quando a gravação da convenção falha', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_INSCRICAO);
    componente.escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    controller.expectOne(ROTA_ALGORITMO).flush(
      {
        type: 'about:blank',
        title: 'Convenção de contagem recusada',
        status: 422,
        code: 'uniplus.selecao.algoritmo_contagem_prazo.invalido',
        traceId: '00000000000000000000000000000006',
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    await proximoPasso();
    await gravacao;
    detectar();

    expect(opcoesDaConvencao()).toContain('');
  });

  /**
   * O `RegraCatalogoDto` não tem `nome` nem `descricao` — inventar um mapa código→rótulo no
   * frontend é achado bloqueante (#511). A opção mostra o código e a versão, que são o que
   * identifica a convenção; a base legal saiu do rótulo porque as três convenções de
   * contagem do catálogo têm a MESMA, com quatrocentos e sessenta e nove caracteres, e
   * repeti-la em cada linha empurrava o código para fora da largura do campo.
   */
  it('oferece cada convenção do catálogo pelo código e pela versão', () => {
    expect(componente.regrasDeContagem()).toContainEqual({
      codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
      versao: 'v1',
      baseLegal: 'Lei 9.784/1999, art. 66',
    });
    expect(nativo.textContent ?? '').toContain('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL (v1)');
    expect(nativo.textContent ?? '').not.toContain(
      'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL (v1) — Lei 9.784/1999, art. 66',
    );
  });

  /**
   * O que separa uma convenção da outra são os invariantes que o catálogo publica — cada um
   * descreve um caso, com o exemplo do resultado. Aparecem depois da escolha, porque
   * descrevem a convenção escolhida, não as disponíveis.
   */
  it('mostra o que a convenção escolhida faz, na prosa do catálogo', () => {
    expect(componente.invariantesDaContagem()).toEqual([], 'sem escolha, não há o que descrever');

    componente.escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    expect(componente.invariantesDaContagem()).toEqual([
      'o dia da âncora não conta',
      'em horas, a contagem começa no primeiro dia útil seguinte',
    ]);
    expect(componente.baseLegalDaContagem()).toBe('Lei 9.784/1999, art. 66');
    expect(nativo.textContent ?? '').toContain('O que esta convenção faz');
    expect(nativo.textContent ?? '').toContain('o dia da âncora não conta');
  });

  /** Catálogo que não publica invariante nenhum não ganha uma seção vazia. */
  it('esconde a descrição quando o catálogo não publica invariante', () => {
    componente.escolherAlgoritmo('SEM-INVARIANTE');
    detectar();

    expect(componente.invariantesDaContagem()).toEqual([]);
    expect(nativo.textContent ?? '').not.toContain('O que esta convenção faz');
  });

  /**
   * A convenção é identificada por código **e** versão. Escolher pelo código
   * e deduzir a versão do catálogo carregado é o que mantém o par coerente —
   * gravar código novo com versão velha é recusado pelo servidor.
   */
  it('escolher a convenção grava código e versão juntos no rascunho', () => {
    componente.escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    expect(store.draft().cronograma.algoritmoContagemCodigo).toBe(
      'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    );
    expect(store.draft().cronograma.algoritmoContagemVersao).toBe('v1');
  });

  /** Hidratação: o rascunho que chega de fora aparece refletido na tela. */
  it('espelha no formulário a convenção de contagem que chega ao rascunho', () => {
    store.patchObjectSection('cronograma', {
      algoritmoContagemCodigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
      algoritmoContagemVersao: 'v1',
    });
    detectar();

    expect(componente.formulario.controls.algoritmoContagemCodigo.value).toBe(
      'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    );
    expect(componente.formulario.controls.algoritmoContagemVersao.value).toBe('v1');
  });

  /**
   * O algoritmo é a terceira gravação, e só acontece quando há escolha
   * (CA-05). As etapas e o cronograma de fases já foram gravados quando o
   * `PUT` do algoritmo sai.
   */
  it('grava a convenção de contagem depois das etapas e do cronograma de fases', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_INSCRICAO);
    componente.escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    const gravacao = componente.persistir();

    const fases = controller.expectOne(ROTA_FASES);
    controller.expectNone(ROTA_ALGORITMO);
    fases.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    const etapas = controller.expectOne(ROTA_ETAPAS);
    controller.expectNone(ROTA_ALGORITMO);
    etapas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
    await gravouExigencias();

    const algoritmo = controller.expectOne(ROTA_ALGORITMO);
    expect(algoritmo.request.method).toBe('PUT');
    expect(algoritmo.request.body).toEqual({
      codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
      versao: 'v1',
    });
    algoritmo.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  /** CA-05: sem escolha, a terceira chamada simplesmente não acontece. */
  it('não grava convenção de contagem quando nenhuma foi escolhida', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_INSCRICAO);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();

    controller.expectNone(ROTA_ALGORITMO);
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  /**
   * CA-08: se a última chamada falhar, as duas primeiras já gravaram — a
   * mensagem tem de dizer isso, não "não foi possível concluir a operação".
   */
  it('diz que etapas e cronograma já gravaram quando só a convenção falha', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_INSCRICAO);
    componente.escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();

    controller.expectOne(ROTA_ALGORITMO).flush(
      {
        type: 'about:blank',
        title: 'Convenção de contagem recusada',
        status: 422,
        code: 'uniplus.selecao.algoritmo_contagem_prazo.invalido',
        traceId: '00000000000000000000000000000005',
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    await proximoPasso();

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('etapas e o cronograma de fases foram gravados');
    expect(resultado.messages?.[0]).toContain('Convenção de contagem recusada');
  });

  /**
   * O preflight do passo espelha a recusa da publicação sobre a norma da exigência. A
   * conferência em si é função pura e já tinha teste; o que faltava — e por isso a ligação
   * entre o rascunho e ela pôde quebrar em silêncio numa refatoração — era provar que o
   * componente de fato ENXERGA as exigências declaradas.
   */
  describe('conferência da norma das exigências', () => {
    function comExigenciaDeclarada(
      bases: readonly unknown[],
      patch: Record<string, unknown> = {},
    ): void {
      comFases(ID_AVALIACAO);
      store.patchSection('documentos', {
        emTodasAsFases: [],
        raizes: [
          {
            tipo: 'FOLHA',
            quantidadeMinima: null,
            consequencia: null,
            basesLegais: null,
            filhos: null,
            chaveDistincao: null,
            dataReferencia: null,
            ocorrenciasEsperadas: null,
            repetePorEntidade: null,
            documento: {
              tipoDocumentoId: '01960000-0000-7000-0000-0000000000d9',
              faseCodigo: FASES_CANONICAS.find((f) => f.id === ID_AVALIACAO)?.codigo ?? '',
              etapaId: null,
              aplicabilidade: 'GERAL',
              obrigatorio: true,
              consequenciaIndeferimento: '',
              condicoes: [],
              basesLegais: bases,
              idadeMaximaEmissao: null,
              formatosPermitidos: 'QUALQUER',
              tamanhoMaximoBytes: null,
              ...patch,
            },
          },
        ],
      });
      detectar();
    }

    /**
     * O campo que o cronograma acrescenta sozinho precisa ficar registrado como tal. Sem o
     * registro, o passo do formulário não o reconhece como posto por exigência e o preserva
     * mesmo depois de o gatilho que o pediu ser apagado — a inscrição segue coletando dado
     * pessoal que já não tem finalidade declarada.
     */
    it('registra como posto por exigência o campo que acrescenta sozinho', async () => {
      const catalogos = TestBed.inject(CatalogosDoCronogramaService);
      catalogos.fatos.set([
        {
          codigo: 'SEXO',
          nome: 'Sexo',
          dominio: 'CATEGORICO',
          origem: 'DECLARADO',
          cardinalidade: 'UNIVALORADO',
          binding: 'CAMPO_INSCRICAO:SEXO',
          valoresDominio: null,
        } as unknown as FatoCandidatoView,
      ]);

      comExigenciaDeclarada(
        [{ referencia: 'Lei 12.711/2012', abrangencia: 'FEDERAL', status: 'RESOLVIDO', observacao: '' }],
        {
          aplicabilidade: 'CONDICIONAL',
          condicoes: [{ clausula: 0, ordem: 0, fato: 'SEXO', operador: 'IGUAL', valor: '"MASCULINO"' }],
        },
      );

      expect(store.camposPostosPelasExigencias().has('SEXO')).toBe(false);

      const garantir = (
        componente as unknown as {
          garantirCamposQueAsExigenciasPressupoem(
            processoId: string,
            servidor: unknown,
            dependencias: readonly string[],
          ): Promise<unknown>;
        }
      ).garantirCamposQueAsExigenciasPressupoem(PROCESSO_ID, { fatosColetados: [] }, []);

      const gravacao = controller.expectOne((r) => r.url.includes('fatos-coletados'));
      gravacao.flush(null, { status: 204, statusText: 'No Content' });
      await garantir;

      expect(store.draft().formulario.fatos.map((c) => c.fatoCodigo)).toContain('SEXO');
      expect(store.camposPostosPelasExigencias().has('SEXO')).toBe(
        true,
        'o campo entrou sozinho, e é esse registro que autoriza tirá-lo quando o gatilho sair',
      );
    });

    it('acusa a exigência que decide o resultado e está sem norma resolvida', () => {
      comExigenciaDeclarada([
        { referencia: '', abrangencia: 'INTERNA_EDITAL', status: 'RESOLVIDO', observacao: '' },
      ]);

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('norma');
    });

    it('não acusa quando alguma das normas declaradas está resolvida', () => {
      comExigenciaDeclarada([
        { referencia: '', abrangencia: 'INTERNA_EDITAL', status: 'RESOLVIDO', observacao: '' },
        { referencia: 'Lei 12.711/2012', abrangencia: 'FEDERAL', status: 'RESOLVIDO', observacao: '' },
      ]);

      expect(componente.validate().messages?.join(' ') ?? '').not.toContain('norma');
    });

    /**
     * A recusa de complementação é do passo do CRONOGRAMA, não da superfície da fase: aquela
     * é embutida com `faseFixada` e o `validate()` dela nunca é chamado pela página. Escrita
     * lá, a conferência existia e não rodava.
     */
    it('acusa o reenvio declarado em fase que não admite complementação', () => {
      comExigenciaDeclarada(
        [{ referencia: 'Lei 12.711/2012', abrangencia: 'FEDERAL', status: 'RESOLVIDO', observacao: '' }],
        { consequenciaIndeferimento: 'PENDENCIA_REENVIO' },
      );

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('complementação');
    });

    /** Exigência ancorada em fase que saiu do cronograma é nomeada, não descartada em silêncio. */
    it('acusa a exigência cuja fase saiu do cronograma', () => {
      comExigenciaDeclarada(
        [{ referencia: 'Lei 12.711/2012', abrangencia: 'FEDERAL', status: 'RESOLVIDO', observacao: '' }],
      );
      // A fase sai depois de a exigência ter sido declarada nela.
      comFases(ID_INSCRICAO);

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('saiu do cronograma');
    });
  });
});
