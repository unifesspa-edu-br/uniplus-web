import {
  FINALIDADE_INSCRICAO,
  DADO_SIM_OU_NAO,
  ORIGEM_DECLARADA,
  VALOR_UNICO,
} from './vocabulario-do-modelo.testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, type EnvironmentProviders, type Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  BlocoSistemaCodigo,
  CONFIGURACAO_BASE_PATH,
  OperadorCodigo,
  TipoEtapaFormularioCodigo,
  TipoObrigatoriedadeCodigo,
  TipoRenderizacaoCodigo,
  type FatoCandidatoView,
  type FatoDoCatalogoDto,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { REQUISITOS_DO_LAUDO } from './requisitos-do-modelo.testing';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';

export const BASE = 'http://localhost:5000';
export const ID = '01960000-0000-7000-0000-0000000000a1';
export const MODELO = `${BASE}/api/configuracao/admin/modelos-formulario/${ID}`;
export const PROBLEMA = {
  status: 422,
  statusText: 'Recusa',
  headers: { 'content-type': 'application/problem+json' },
};

const FATO_BASE: Omit<FatoCandidatoView, 'id' | 'codigo' | 'nome' | 'binding'> = {
  descricao: 'Dado do candidato.',
  dominio: DADO_SIM_OU_NAO,
  origem: ORIGEM_DECLARADA,
  cardinalidade: VALOR_UNICO,
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  escopo: 'CANDIDATO',
  classificacaoProtecao: 'INTERNO',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Aplicar a regra do certame.',
  protecaoAprovada: true,
};

/** Um fato como a leitura pública do catálogo o devolve: no envelope, com os operadores declarados. */
export const fato = (codigo: string): FatoDoCatalogoDto => ({
  fato: {
    ...FATO_BASE,
    id: codigo,
    codigo,
    nome: codigo,
    binding: `CAMPO_FORMULARIO:${codigo}`,
  },
  operadoresAdmitidos: [
    { codigo: OperadorCodigo.IGUAL, rotulo: 'é' },
    { codigo: OperadorCodigo.DIFERENTE, rotulo: 'não é' },
  ],
});

export const SEMPRE_OBRIGATORIO = { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null };
/** As regras de um campo sem exibição condicionada, restrição nem impedimento. */
export const SEM_REGRAS_DO_CAMPO = {
  exibicao: null,
  obrigatoriedade: SEMPRE_OBRIGATORIO,
  restricoes: [],
  impedimento: null,
};

/**
 * Um modelo de inscrição como a API o devolve: com a seção dos dados básicos, e com o que esta
 * tela ainda não edita — termo, grupo, restrição e impedimento.
 */
export const modelo: ModeloFormularioView = {
  id: ID,
  codigo: 'INSCRICAO_MEDICINA',
  finalidade: FINALIDADE_INSCRICAO,
  ativo: true,
  descritivo: { nome: 'Inscrição Medicina', descricao: null, tipoProcessoCodigo: null },
  conteudo: {
    titulo: 'Inscrição',
    etapas: [
      {
        codigo: 'DADOS_BASICOS',
        ordem: 0,
        tipo: TipoEtapaFormularioCodigo.SECAO,
        bloco: null,
        apresentacao: { titulo: 'Dados do candidato', descricao: null, aviso: null },
        exibicao: null,
      },
      {
        codigo: 'SECAO_1',
        ordem: 1,
        tipo: TipoEtapaFormularioCodigo.SECAO,
        bloco: null,
        apresentacao: { titulo: 'Escolaridade', descricao: null, aviso: null },
        exibicao: null,
      },
      {
        codigo: 'REVISAO_E_ACEITE',
        ordem: 2,
        tipo: TipoEtapaFormularioCodigo.BLOCO,
        bloco: BlocoSistemaCodigo.REVISAO_E_ACEITE,
        apresentacao: { titulo: 'Revisão e aceite', descricao: null, aviso: null },
        exibicao: null,
      },
    ],
    itens: [
      {
        fatoCodigo: 'NOME',
        ordem: 0,
        apresentacao: {
          rotulo: 'Nome',
          tipoRenderizacao: TipoRenderizacaoCodigo.TEXTO,
          ajuda: null,
          pedirConfirmacao: false,
        },
        regras: SEM_REGRAS_DO_CAMPO,
        etapaCodigo: 'DADOS_BASICOS',
      },
      {
        fatoCodigo: 'ESCOLA_PUBLICA',
        ordem: 1,
        apresentacao: {
          rotulo: 'Estudou em escola pública?',
          tipoRenderizacao: TipoRenderizacaoCodigo.SIM_OU_NAO,
          ajuda: null,
          pedirConfirmacao: false,
        },
        regras: {
          exibicao: null,
          obrigatoriedade: SEMPRE_OBRIGATORIO,
          restricoes: [
            {
              tipo: 'SUBCONJUNTO',
              minimo: null,
              maximo: null,
              entradas: [{ quando: null, valores: ['true'] }],
              fatos: null,
              dataMinima: null,
              dataMaxima: null,
            },
          ],
          impedimento: {
            quando: [[{ fato: 'ESCOLA_PUBLICA', operador: OperadorCodigo.IGUAL, valor: false }]],
            mensagem: 'Só para egressos.',
          },
        },
        etapaCodigo: 'SECAO_1',
      },
    ],
    termos: [
      {
        codigo: 'LGPD',
        ordem: 0,
        termo: { termoId: 'T1', versaoId: 'V1' },
        regras: {
          exibicao: null,
          obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
        },
      },
    ],
    pressupostos: [],
    grupos: [
      {
        codigo: 'FAMILIA',
        ordem: 2,
        rotulo: 'Composição familiar',
        etapaCodigo: 'SECAO_1',
        ocorrencias: { minimo: 1, maximo: null, incluiCandidato: true },
        regras: {
          exibicao: null,
          obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
        },
        subitens: [],
      },
    ],
    conjuntoDeDocumentos: {
      documentosExigidos: [
        {
          faseCodigo: 'INSCRICAO',
          tipoDocumentoCodigo: 'LAUDO_MEDICO',
          quando: [[{ fato: 'ESCOLA_PUBLICA', operador: OperadorCodigo.IGUAL, valor: true }]],
          indeferimento: {
            obrigatorio: true,
            consequencia: 'ELIMINA',
            basesLegais: [
              {
                referencia: 'Lei 13.146/2015',
                abrangencia: 'FEDERAL',
                situacao: 'RESOLVIDO',
                observacao: null,
              },
            ],
          },
          requisitos: REQUISITOS_DO_LAUDO,
          porOpcao: null,
        },
        {
          faseCodigo: 'INSCRICAO',
          tipoDocumentoCodigo: 'CERTIDAO_NASCIMENTO',
          quando: null,
          indeferimento: {
            obrigatorio: false,
            consequencia: 'ABRE_PRAZO_PARA_REENVIO',
            basesLegais: [],
          },
          requisitos: { prazoDeEmissao: null, validade: null },
          porOpcao: null,
        },
      ],
      gruposDeDocumentos: [],
    },
  },
};

export const FASES = [
  { id: '1', codigo: 'INSCRICAO', nome: 'Inscrição', permiteComplementacao: true },
  { id: '2', codigo: 'HOMOLOGACAO', nome: 'Homologação', permiteComplementacao: false },
];

const FATOS_BASICOS = ['NOME', 'ESCOLA_PUBLICA', 'GESTANTE'];
const API = `${BASE}/api/configuracao`;

export const FALHA_500 = JSON.stringify({
  status: 500,
  title: 'Erro interno',
  code: 'uniplus.internal.unexpected',
});

const FALHA_404 = JSON.stringify({
  status: 404,
  title: 'Modelo não encontrado',
  code: 'uniplus.configuracao.modelo_formulario.nao_encontrado',
});

const TIPOS_DE_DOCUMENTO = [
  { id: '1', codigo: 'LAUDO_MEDICO', nome: 'Laudo médico' },
  { id: '2', codigo: 'CERTIDAO_NASCIMENTO', nome: 'Certidão de nascimento' },
  { id: '3', codigo: 'ATESTADO', nome: 'Atestado' },
];

const CONSEQUENCIAS_DO_INDEFERIMENTO = [
  { codigo: 'ELIMINA', rotulo: 'Elimina do processo' },
  { codigo: 'ABRE_PRAZO_PARA_REENVIO', rotulo: 'Abre prazo para reenvio' },
];

const RECURSO_DAS_CONSEQUENCIAS: RecursoDaCarga = {
  recurso: 'consequencias',
  url: `${BASE}/api/selecao/vocabularios/consequencias-indeferimento`,
  dados: CONSEQUENCIAS_DO_INDEFERIMENTO,
};

export interface TelaDeEdicao {
  readonly fixture: ComponentFixture<ModeloFormularioEdicaoPage>;
  readonly controller: HttpTestingController;
}

/** O que a carga da tela traz: o modelo, os fatos além dos básicos, as fases e quais leituras falham. */
export interface CenarioDaCarga {
  readonly modelo?: ModeloFormularioView;
  readonly fatosExtras?: readonly FatoDoCatalogoDto[];
  readonly fases?: readonly object[];
  readonly falhando?: readonly string[];
}

/** Um erro de campo como a API o devolve na recusa 422 do conteúdo. */
export interface ErroDeCampo {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

interface RecursoDaCarga {
  readonly recurso: string;
  readonly url: string;
  readonly dados: object;
}

function provedoresDaTela(): (EnvironmentProviders | Provider)[] {
  return [
    provideRouter([]),
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
    { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    { provide: GEO_BASE_PATH, useValue: BASE },
    { provide: SELECAO_BASE_PATH, useValue: BASE },
    {
      provide: ActivatedRoute,
      useValue: { snapshot: { paramMap: convertToParamMap({ id: ID }) } },
    },
  ];
}

export function montarTelaDeEdicao(): TelaDeEdicao {
  TestBed.configureTestingModule({
    imports: [ModeloFormularioEdicaoPage],
    providers: provedoresDaTela(),
  });
  const fixture = TestBed.createComponent(ModeloFormularioEdicaoPage);
  const controller = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, controller };
}

export async function propagarAlteracoes(
  fixture: ComponentFixture<ModeloFormularioEdicaoPage>,
): Promise<HTMLElement> {
  await Promise.resolve();
  TestBed.inject(ApplicationRef).tick();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function recursosDaCarga(cenario: CenarioDaCarga): readonly RecursoDaCarga[] {
  const fatos = [...FATOS_BASICOS.map(fato), ...(cenario.fatosExtras ?? [])];
  return [
    { recurso: 'modelo', url: MODELO, dados: cenario.modelo ?? modelo },
    { recurso: 'fatos', url: `${API}/fatos-candidato`, dados: fatos },
    { recurso: 'tipos-processo', url: `${API}/tipos-processo`, dados: [] },
    { recurso: 'termos', url: `${API}/termos-consentimento`, dados: [] },
    { recurso: 'fases', url: `${API}/fases-canonicas`, dados: cenario.fases ?? FASES },
    { recurso: 'tipos-documento', url: `${API}/tipos-documento`, dados: TIPOS_DE_DOCUMENTO },
    RECURSO_DAS_CONSEQUENCIAS,
  ];
}

interface FalhaDaLeitura {
  readonly corpo: string;
  readonly resposta: { status: number; statusText: string; headers: Record<string, string> };
}

function falhaDoRecurso(recurso: string, falhando: readonly string[]): FalhaDaLeitura | null {
  if (recurso === 'modelo' && falhando.includes('modelo-inexistente')) {
    return {
      corpo: FALHA_404,
      resposta: { ...PROBLEMA, status: 404, statusText: 'Não encontrado' },
    };
  }
  if (!falhando.includes(recurso)) return null;
  return { corpo: FALHA_500, resposta: { ...PROBLEMA, status: 500, statusText: 'Erro' } };
}

function responderRecurso(
  controller: HttpTestingController,
  recurso: RecursoDaCarga,
  falhando: readonly string[],
): void {
  const pedido = controller.expectOne((req) => req.url === recurso.url);
  const falha = falhaDoRecurso(recurso.recurso, falhando);
  if (falha === null) pedido.flush(recurso.dados);
  else pedido.flush(falha.corpo, falha.resposta);
}

/** Responde as seis leituras que a tela faz ao abrir. */
export function responderCarga(
  controller: HttpTestingController,
  cenario: CenarioDaCarga = {},
): void {
  const falhando = cenario.falhando ?? [];
  for (const recurso of recursosDaCarga(cenario)) responderRecurso(controller, recurso, falhando);
}

export function salvar(tela: HTMLElement): void {
  const botao = Array.from(
    tela.querySelectorAll('button[type="submit"]') as NodeListOf<HTMLButtonElement>,
  ).find((b) => b.textContent?.includes('Salvar modelo'));
  (botao as HTMLButtonElement).click();
}

/** A API recusa a gravação do conteúdo com os erros de campo dados. */
export function recusarGravacao(
  controller: HttpTestingController,
  erros: readonly ErroDeCampo[],
): void {
  const corpo = JSON.stringify({
    status: 422,
    title: 'Requisição inválida',
    code: 'uniplus.configuracao.modelo_formulario.conteudo_invalido',
    errors: erros,
  });
  controller.expectOne((req) => req.method === 'PUT').flush(corpo, PROBLEMA);
}

export const tituloDaTela = (): HTMLElement | null => document.getElementById('cfg-modelo-titulo');
