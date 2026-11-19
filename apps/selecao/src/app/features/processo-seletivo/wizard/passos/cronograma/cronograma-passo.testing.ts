import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { CaraterEtapa, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach } from 'vitest';

import type {
  BancaRequeridaDaFase,
  EtapaPontuada,
  FaseDoCronograma,
  ProdutoDaFase,
} from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDosCamposPressupostos } from '../../shared/campos-pressupostos.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { CATALOGOS_DO_CRONOGRAMA } from './catalogos/catalogos-do-cronograma';
import { ConvencaoDeContagemComponent } from './convencao-de-contagem.component';
import { CronogramaPassoComponent } from './cronograma.component';
import {
  FASE_SUMIDA,
  FASES_CANONICAS,
  ID_RESULTADO,
  PROCESSO_COM_ETAPA_GRAVADA,
  REGRAS_CONSOLIDACAO,
  REGRAS_CONTAGEM,
  ROTA_DOCUMENTOS,
  ROTA_ETAPAS,
  ROTA_PROCESSO,
  BASE,
  TIPO_ETAPA,
  TIPOS_ETAPA,
} from './cronograma.testing';
import { ConferenciaDoCronograma } from './servicos/conferencia-do-cronograma.service';
import { EdicaoDaEtapa } from './servicos/edicao-da-etapa.service';
import { ExpansaoDoCronograma } from './servicos/expansao-do-cronograma.service';
import { FormularioDoCronograma } from './servicos/formulario-do-cronograma.service';
import { GravacaoDasExigenciasDocumentais } from './servicos/gravacao-das-exigencias-documentais.service';
import { LeituraDaLinhaDoTempo } from './servicos/leitura-da-linha-do-tempo.service';
import { RecusasDoServidorNasEtapas } from './servicos/recusas-do-servidor-nas-etapas.service';
import { ReleituraDasEtapas } from './servicos/releitura-das-etapas.service';
import { UnidadesResponsaveisDasFases } from './servicos/unidades-responsaveis-das-fases.service';

const SEM_CONTEUDO = { status: 204, statusText: 'No Content' };
const INICIO_DA_FASE = '2026-03-01T08:00:00-03:00';
const FIM_DA_FASE = '2026-03-10T18:00:00-03:00';

const PROVEDORES = [
  ProcessoSeletivoStore,
  CadastroInicial,
  GravacaoDoProcesso,
  GravacaoDosCamposPressupostos,
  ...CATALOGOS_DO_CRONOGRAMA,
  provideHttpClient(withInterceptors([apiResultInterceptor])),
  provideHttpClientTesting(),
  { provide: SELECAO_BASE_PATH, useValue: BASE },
  { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
  { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
  { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
];

type CamposDaFase = Pick<FaseDoCronograma, 'faseCanonicaId' | 'codigo' | 'ordem'> &
  Partial<FaseDoCronograma>;
type CamposDaEtapa = Pick<EtapaPontuada, 'nome' | 'ordem' | 'faseCodigo'>;

/** Uma fase do rascunho sem nada declarado além da janela e do que o cenário informa. */
function faseDoRascunho(campos: CamposDaFase): FaseDoCronograma {
  return {
    inicio: INICIO_DA_FASE,
    fim: FIM_DA_FASE,
    unidadeResponsavelId: null,
    produtos: [],
    faseConcluinteCodigo: null,
    emiteParecerIndividual: false,
    bancasRequeridas: [],
    regraRecurso: null,
    congelados: null,
    ...campos,
  };
}

/** Os atributos que o processo congelou da fase; só a agregação de etapas varia nos cenários. */
function congeladosDaFase(agrupaEtapas: boolean): FaseDoCronograma['congelados'] {
  return {
    origemData: 'NO_EDITAL',
    agrupaEtapas,
    coletaInscricao: false,
    permiteComplementacao: false,
    coletaSolicitacaoIsencao: false,
    bancas: [],
  };
}

const ETAPA_SEM_DECLARACAO = {
  id: null,
  carater: CaraterEtapa.classificatoria,
  tipoEtapaOrigemId: TIPO_ETAPA,
  peso: '1',
  notaMinima: '',
  inicio: '',
  fim: '',
  emiteParecerIndividual: false,
};

/** Uma etapa classificatória do rascunho, ainda sem identificador, sem produto nem janela. */
function etapaDoRascunho(campos: CamposDaEtapa): EtapaPontuada {
  return { ...ETAPA_SEM_DECLARACAO, produtos: [], bancas: [], recursos: [], ...campos };
}

/** A fase de resultado final que declara o que publica e as bancas que requer. */
function faseQuePublica(
  produtos: readonly ProdutoDaFase[],
  bancasRequeridas: readonly BancaRequeridaDaFase[],
): FaseDoCronograma {
  return faseDoRascunho({
    faseCanonicaId: ID_RESULTADO,
    codigo: 'RESULTADO_FINAL',
    ordem: 1,
    produtos,
    faseConcluinteCodigo: 'RECURSOS',
    emiteParecerIndividual: true,
    bancasRequeridas,
  });
}

function respostaDaLeitura(requisicao: TestRequest): object {
  const { url } = requisicao.request;
  const tipo = requisicao.request.params.get('tipo');
  if (url.includes('fases-canonicas')) return FASES_CANONICAS;
  if (url.includes('tipos-etapa')) return TIPOS_ETAPA;
  if (tipo === 'algoritmo_contagem_prazo') return REGRAS_CONTAGEM;
  if (tipo === 'regra_consolidacao') return REGRAS_CONSOLIDACAO;
  return [];
}

function responderOsCatalogos(controller: HttpTestingController): void {
  for (const requisicao of controller.match(() => true)) {
    requisicao.flush(respostaDaLeitura(requisicao));
  }
}

/**
 * A tela do passo Cronograma montada, e o que os cenários consultam e conduzem nela. Os campos são
 * funções de seta ou valores prontos para serem desestruturados no `beforeEach` do cenário.
 */
export class ContextoDoCronograma {
  readonly controller = TestBed.inject(HttpTestingController);
  readonly store = TestBed.inject(ProcessoSeletivoStore);
  private readonly fixture = TestBed.createComponent(CronogramaPassoComponent);
  private readonly injetor = this.fixture.debugElement.injector;
  readonly componente = this.fixture.componentInstance;
  readonly raiz = this.fixture.debugElement;
  readonly nativo = this.fixture.nativeElement as HTMLElement;
  readonly expansao = this.injetor.get(ExpansaoDoCronograma);
  readonly leitura = this.injetor.get(LeituraDaLinhaDoTempo);
  readonly edicao = this.injetor.get(EdicaoDaEtapa);
  readonly exigencias = this.injetor.get(GravacaoDasExigenciasDocumentais);
  readonly conferencia = this.injetor.get(ConferenciaDoCronograma);
  readonly recusas = this.injetor.get(RecusasDoServidorNasEtapas);
  readonly cronograma = this.injetor.get(FormularioDoCronograma);
  readonly releituraDasEtapas = this.injetor.get(ReleituraDasEtapas);
  readonly unidades = this.injetor.get(UnidadesResponsaveisDasFases);
  readonly detectar = (): void => this.fixture.detectChanges();

  readonly convencao = (): ConvencaoDeContagemComponent =>
    this.raiz.query(By.directive(ConvencaoDeContagemComponent)).componentInstance;

  /** Deixa a cadeia de `await` do comando avançar antes da próxima expectativa. */
  readonly proximoPasso = (): Promise<unknown> => new Promise((resolve) => setTimeout(resolve, 0));

  /**
   * A última gravação do passo: relê as fases para traduzir o código canônico que o
   * rascunho guarda no id que a exigência referencia, e substitui a árvore documental.
   */
  readonly gravouExigencias = async (): Promise<void> => {
    this.controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await this.proximoPasso();
    this.controller.expectOne(ROTA_DOCUMENTOS).flush(null, SEM_CONTEUDO);
    await this.proximoPasso();
  };

  /**
   * As etapas e a releitura que recolhe os identificadores que o servidor atribuiu. Vem DEPOIS
   * do cronograma: a etapa declara a fase em que acontece, e o servidor recusa etapa cuja fase
   * ainda não esteja lá.
   */
  readonly gravouEtapas = async (): Promise<void> => {
    this.controller.expectOne(ROTA_ETAPAS).flush(null, SEM_CONTEUDO);
    await this.proximoPasso();
    this.controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await this.proximoPasso();
  };

  /** As ordens que o corpo do comando de cronograma declara. */
  readonly ordensDe = (corpo: unknown): number[] =>
    (corpo as { ordem: number }[]).map((fase) => fase.ordem);

  readonly comFases = (...ids: readonly string[]): void => {
    const fases = ids.map((faseCanonicaId, indice) =>
      faseDoRascunho({
        faseCanonicaId,
        codigo: FASES_CANONICAS.find((f) => f.id === faseCanonicaId)?.codigo ?? '',
        ordem: indice + 1,
      }),
    );
    this.store.patchObjectSection('cronograma', { fases });
    this.detectar();
  };

  /** Uma fase única que declara o que publica, sem que este passo o edite. */
  readonly comFaseQuePublica = (
    produtos: readonly ProdutoDaFase[],
    bancasRequeridas: readonly BancaRequeridaDaFase[] = [],
  ): void => {
    const resultado = faseQuePublica(produtos, bancasRequeridas);
    this.store.patchObjectSection('cronograma', { fases: [resultado, this.faseConcluinte()] });
    this.detectar();
  };

  /**
   * A fase concluinte precisa estar na linha do tempo, publicar a definitiva e vir depois —
   * é o que a conferência do passo confere.
   */
  private faseConcluinte(): FaseDoCronograma {
    return faseDoRascunho({
      faseCanonicaId: FASE_SUMIDA,
      codigo: 'RECURSOS',
      ordem: 2,
      inicio: '2026-03-12T08:00:00-03:00',
      fim: '2026-03-20T18:00:00-03:00',
      produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
      congelados: congeladosDaFase(false),
    });
  }

  /** Fases cujo processo congelou atributos diferentes dos do catálogo. */
  readonly comFasesCongeladas = (
    ...declaradas: readonly { id: string; agrupaEtapas: boolean }[]
  ): void => {
    const fases = declaradas.map((fase, indice) =>
      faseDoRascunho({
        faseCanonicaId: fase.id,
        codigo: 'FASE_CONGELADA',
        ordem: indice + 1,
        congelados: congeladosDaFase(fase.agrupaEtapas),
      }),
    );
    this.store.patchObjectSection('cronograma', { fases });
    this.detectar();
  };

  /** Uma etapa por código de fase informado, na ordem em que chegam. */
  readonly comEtapasEmFases = (codigos: readonly string[]): void => {
    const etapas = codigos.map((faseCodigo, posicao) =>
      etapaDoRascunho({ nome: `Etapa ${posicao + 1}`, ordem: posicao + 1, faseCodigo }),
    );
    this.store.patchObjectSection('cronograma', { etapas });
    this.detectar();
  };

  readonly comUmaEtapa = (): void => {
    const etapa = etapaDoRascunho({ nome: 'Prova objetiva', ordem: 1, faseCodigo: '' });
    this.store.patchObjectSection('cronograma', { etapas: [etapa] });
    this.detectar();
  };

  /** Valores das `<option>` do seletor de convenção, na ordem em que aparecem. */
  readonly opcoesDaConvencao = (): string[] =>
    Array.from(
      this.nativo.querySelectorAll<HTMLOptionElement>('#cr-algoritmo-contagem option'),
    ).map((opcao) => opcao.value);
}

export async function montarCronograma(): Promise<ContextoDoCronograma> {
  await TestBed.configureTestingModule({
    imports: [CronogramaPassoComponent],
    providers: PROVEDORES,
  }).compileComponents();
  const contexto = new ContextoDoCronograma();
  contexto.detectar();
  responderOsCatalogos(contexto.controller);
  contexto.detectar();
  return contexto;
}

/**
 * Registra, no `describe` que a chama, a montagem da tela antes de cada caso e a conferência de
 * que nenhuma requisição ficou sem resposta depois dele. `aoMontar` recebe a tela montada.
 */
export function usarCronograma(aoMontar: (contexto: ContextoDoCronograma) => void): void {
  let atual: ContextoDoCronograma;
  beforeEach(async () => {
    atual = await montarCronograma();
    aoMontar(atual);
  });
  afterEach(() => atual.controller.verify());
}
