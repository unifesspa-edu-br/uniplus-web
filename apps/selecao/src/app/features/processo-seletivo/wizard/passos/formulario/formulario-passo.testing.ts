import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH, type FormularioDto } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach } from 'vitest';

import type { AtributosCongeladosDaFase, FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { CATALOGOS_DO_CRONOGRAMA } from '../cronograma/catalogos/catalogos-do-cronograma';
import { FormularioPassoComponent } from './formulario.component';
import { conteudoDoFormulario } from './formulario-do-processo';
import { AplicacaoDeModelo } from './servicos/aplicacao-de-modelo.service';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
const ROTA_FORMULARIOS = `${BASE}/api/selecao/admin/processos-seletivos/${PROCESSO_ID}/formularios`;
export const ROTA_INSCRICAO = `${ROTA_FORMULARIOS}/INSCRICAO`;
export const ROTA_HABILITACAO = `${ROTA_FORMULARIOS}/HABILITACAO`;
export const ROTA_APLICACAO = `${ROTA_FORMULARIOS}/aplicacoes-de-modelo`;
export const ROTA_MODELOS = `${BASE}/api/configuracao/admin/modelos-formulario`;
export const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

export const CONGELADOS_DA_INSCRICAO: AtributosCongeladosDaFase = {
  origemData: 'NO_EDITAL',
  agrupaEtapas: false,
  coletaInscricao: true,
  permiteComplementacao: false,
  coletaSolicitacaoIsencao: false,
  bancas: [],
};

export const FASE_INSCRICAO: FaseDoCronograma = {
  faseCanonicaId: 'fc-inscricao',
  codigo: 'INSCRICAO',
  ordem: 0,
  inicio: null,
  fim: null,
  unidadeResponsavelId: null,
  produtos: [],
  noMesmoMomentoDaAnterior: false,
  emiteParecerIndividual: false,
  bancasRequeridas: [],
  regraRecurso: null,
  congelados: CONGELADOS_DA_INSCRICAO,
};

export const campo = (fatoCodigo: string, ordem: number, etapaCodigo: string) => ({
  fatoCodigo,
  ordem,
  rotulo: fatoCodigo,
  tipoRenderizacao: 'BOOLEANO',
  obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
  precondicao: null,
  opcoes: null,
  etapaCodigo,
  formato: null,
  ajuda: null,
  pedirConfirmacao: false,
  restricoes: [],
  impedimento: null,
});
export const etapa = (codigo: string, ordem: number, bloco: string | null = null) => ({
  codigo,
  ordem,
  tipo: bloco === null ? 'SECAO' : 'BLOCO',
  bloco,
  titulo: codigo === 'S1' ? 'Condições especiais' : codigo,
  descricao: null,
  aviso: null,
  exibicao: null,
});

/** A inscrição como o servidor a devolve: com a seção dos dados básicos que a API acrescenta. */
export const GRAVADO = {
  finalidade: 'INSCRICAO',
  faseId: 'F-INSCRICAO',
  titulo: 'Inscrição — Medicina 2027',
  modeloOrigemId: null,
  modeloOrigemCodigo: null,
  etapas: [
    etapa('DADOS_BASICOS', 0),
    etapa('S1', 1),
    etapa('REVISAO_E_ACEITE', 2, 'REVISAO_E_ACEITE'),
  ],
  fatosColetados: [
    campo('NOME', 0, 'DADOS_BASICOS'),
    {
      ...campo('PCD', 1, 'S1'),
      obrigatoriedade: {
        tipo: 'QUANDO',
        predicado: [[{ fato: 'NOME', operador: 'IGUAL', valor: 'x' }]],
      },
    },
  ],
  termos: [],
  grupos: [
    {
      codigo: 'FAMILIA',
      ordem: 3,
      rotulo: 'FAMILIA',
      etapaCodigo: 'S1',
      minimo: 0,
      maximo: null,
      exibicao: null,
      obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
      incluiCandidato: false,
      subitens: [],
    },
  ],
} as unknown as FormularioDto;

export const PROCESSO = {
  formularios: [GRAVADO],
  cronogramaFases: [{ id: 'F-INSCRICAO', codigo: 'INSCRICAO', coletaInscricao: true }],
};

export const PCD_NO_CATALOGO = {
  id: 'f-pcd',
  codigo: 'PCD',
  nome: 'Pessoa com deficiência',
  descricao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:PCD',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  escopo: 'CANDIDATO',
};

export const modelo = (id: string, nome: string, finalidade: string) => ({
  id,
  codigo: id.toUpperCase(),
  nome,
  descricao: null,
  finalidade,
  tipoProcessoCodigo: 'MEDICINA',
  ativo: true,
  conteudo: {},
});
export const MODELOS = [
  modelo('insc', 'Inscrição de Medicina', 'INSCRICAO'),
  modelo('hab', 'Habilitação padrão', 'HABILITACAO'),
];
export const relato = (finalidade: string) => ({
  finalidade,
  fatosTrazidosParaAInscricao: [],
  fatosMantidosNaInscricao: [],
  descartados: [],
  derivacoesCopiadas: [],
  derivacoesMantidas: [],
});
/** A inscrição que a cópia deixa no servidor: sem PCD, que o modelo não traz. */
export const INSCRICAO_COPIADA = {
  ...GRAVADO,
  modeloOrigemId: 'insc',
  modeloOrigemCodigo: 'INSC',
  fatosColetados: [campo('NOME', 0, 'DADOS_BASICOS')],
} as unknown as FormularioDto;
export const PROCESSO_COM_DERIVACOES = { ...PROCESSO, regrasDerivacao: [] };

/** Deixa a cadeia de `await` da gravação avançar antes da próxima expectativa. */
export const proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

/** O passo montado e o que os cenários consultam e conduzem nele. */
export class ContextoDoPasso {
  readonly host: HTMLElement;

  constructor(
    readonly fixture: ComponentFixture<FormularioPassoComponent>,
    readonly store: ProcessoSeletivoStore,
    readonly controller: HttpTestingController,
  ) {
    this.host = fixture.nativeElement as HTMLElement;
  }

  readonly servicoDeModelos = (): AplicacaoDeModelo =>
    this.fixture.debugElement.injector.get(AplicacaoDeModelo);

  readonly valor = (rotulo: string): readonly (string | undefined)[] =>
    Array.from(this.host.querySelectorAll('dl'))
      .filter((dl) => dl.querySelector('dt')?.textContent?.trim() === rotulo)
      .map((dl) => dl.querySelector('dd')?.textContent?.trim());

  readonly declararDesempate = (regraCodigo: string): void => {
    this.store.patchSection('desempate', [
      {
        regraCodigo,
        regraVersao: 'v1',
        etapaRef: '',
        idadeMinima: '',
        fato: '',
        operador: '',
        valor: '',
        areas: [],
      },
    ]);
  };

  /** O processo como a hidratação o deixa: o gravado é o que a simulação abre. */
  readonly comProcessoLido = (): void => {
    this.store.remoteSnapshot.set({ ...PROCESSO, id: PROCESSO_ID, status: 'rascunho' } as never);
    this.fixture.detectChanges();
  };

  /** O tipo do processo conhecido e a lista de modelos atendida. */
  readonly comModelosCarregados = (): void => {
    this.store.patchObjectSection('tipoProcesso', { codigo: 'MEDICINA' });
    this.fixture.detectChanges();
    this.controller.expectOne((r) => r.url === ROTA_MODELOS).flush(MODELOS);
    this.fixture.detectChanges();
  };

  readonly escolherEAplicar = (finalidade: string, modeloId: string): Promise<void> => {
    this.servicoDeModelos().escolher(finalidade, modeloId);
    this.servicoDeModelos().pedir(finalidade);
    return this.fixture.componentInstance.confirmarAplicacao();
  };
}

const PROVEDORES_DO_PASSO = [
  provideRouter([]),
  ProcessoSeletivoStore,
  CadastroInicial,
  GravacaoDoProcesso,
  ...CATALOGOS_DO_CRONOGRAMA,
  provideHttpClient(withInterceptors([apiResultInterceptor])),
  provideHttpClientTesting(),
  { provide: SELECAO_BASE_PATH, useValue: BASE },
  { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
  { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
  { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
  { provide: GEO_BASE_PATH, useValue: BASE },
];

async function configurarModulo(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [FormularioPassoComponent],
    providers: PROVEDORES_DO_PASSO,
  }).compileComponents();
}

function prepararProcesso(store: ProcessoSeletivoStore): void {
  store.processoSeletivoId.set(PROCESSO_ID);
  store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE_INSCRICAO] });
  store.patchObjectSection('formulario', {
    conteudo: conteudoDoFormulario(GRAVADO),
    referenciaTemporal: { tipo: 'DATA_ESPECIFICA', data: '2027-01-15', faseCodigo: '' },
  });
}

function atenderCatalogos(controller: HttpTestingController): void {
  for (const requisicao of controller.match(() => true)) {
    requisicao.flush(requisicao.request.url.includes('fatos-candidato') ? [PCD_NO_CATALOGO] : []);
  }
}

async function montarPasso(): Promise<ContextoDoPasso> {
  await configurarModulo();
  const store = TestBed.inject(ProcessoSeletivoStore);
  const controller = TestBed.inject(HttpTestingController);
  prepararProcesso(store);
  const fixture = TestBed.createComponent(FormularioPassoComponent);
  fixture.detectChanges();
  atenderCatalogos(controller);
  fixture.detectChanges();
  return new ContextoDoPasso(fixture, store, controller);
}

/**
 * Registra, no `describe` que a chama, a montagem do passo antes de cada caso e a conferência de
 * que nenhuma requisição ficou sem resposta depois dele. `aoMontar` recebe o passo montado.
 */
export function usarPasso(aoMontar: (contexto: ContextoDoPasso) => void): void {
  let atual: ContextoDoPasso;
  beforeEach(async () => {
    atual = await montarPasso();
    aoMontar(atual);
  });
  afterEach(() => atual.controller.verify());
}
