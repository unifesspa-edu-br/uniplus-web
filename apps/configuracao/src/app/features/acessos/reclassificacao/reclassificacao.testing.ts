import {
  ClassificacaoDeProtecaoCodigo,
  EtapaDaVersaoCodigo,
  SituacaoDaVersaoCodigo,
  TipoDeDivergenciaCodigo,
} from '@uniplus/shared-data/autorizacao';
import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { map, of } from 'rxjs';
import { vi } from 'vitest';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  ReclassificacoesApi,
  type ConcessaoSuspensaDto,
  type ReclassificacaoDto,
} from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import type { CodigoComRotulo } from '@uniplus/shared-ui/components';
import { TIPO_DE_ESCOPO, ok } from '../testes';
import { etapaDaVersao, sensibilidade, situacaoDaVersao } from '../versoes/enums-da-api.testing';
import { DocumentoDaVersaoService } from '../versoes/documento-da-versao.service';
import { ReclassificacaoDetalhePage } from './reclassificacao-detalhe.page';

export const GESTAO_DE_ACESSOS = PERMISSAO.autorizacao.perfisAprovarFuncional;
export const PROTECAO_DE_DADOS = PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados;
export const ID = '01960000-0000-7000-0000-0000000000e1';
export const PERFIL = '01960000-0000-7000-0000-0000000000d1';

export const ETAPA = {
  GESTAO_DE_ACESSOS: etapaDaVersao(EtapaDaVersaoCodigo.GESTAO_DE_ACESSOS),
  PROTECAO_DE_DADOS: etapaDaVersao(EtapaDaVersaoCodigo.PROTECAO_DE_DADOS),
};

const divergencia = <C extends TipoDeDivergenciaCodigo>(
  codigo: C,
  rotulo: string,
): CodigoComRotulo<C> => ({ codigo, rotulo });

export const TIPO_DE_DIVERGENCIA = {
  COMPOSICAO_FALTANTE: divergencia(
    TipoDeDivergenciaCodigo.COMPOSICAO_FALTANTE,
    'Composição faltante',
  ),
  CLASSIFICACAO: divergencia(TipoDeDivergenciaCodigo.CLASSIFICACAO, 'Classificação'),
  ESCOPO: divergencia(TipoDeDivergenciaCodigo.ESCOPO, 'Escopo'),
};

export const api = { decidir: vi.fn() };
export const documentos = { abrir: vi.fn() };
export const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
export const leituras = vi.fn();

export function concessao(parcial: Partial<ConcessaoSuspensaDto> = {}): ConcessaoSuspensaDto {
  return {
    concessaoId: 'c1',
    beneficiarioNome: 'Betina Teste',
    escopoTipo: TIPO_DE_ESCOPO.UNIDADE,
    unidadeId: 'unidade-1',
    versao: 1,
    etapasExigidas: [ETAPA.GESTAO_DE_ACESSOS],
    etapasDecididas: [],
    ehDoLeitor: false,
    ...parcial,
  };
}

const RECLASSIFICACAO: ReclassificacaoDto = {
  id: ID,
  perfilId: PERFIL,
  perfilNome: 'Operador de inscrições',
  codigo: 'selecao:processos:aprovar',
  mudanca: {
    classificacaoAnterior: sensibilidade(ClassificacaoDeProtecaoCodigo.INTERNO),
    classificacaoNova: sensibilidade(ClassificacaoDeProtecaoCodigo.PESSOAL),
    deUnidadeAnterior: false,
    deUnidadeNovo: true,
  },
  instante: '2026-11-09T15:00:00Z',
  vigente: true,
  versoes: [
    {
      id: 'v1',
      numero: 1,
      situacao: situacaoDaVersao(SituacaoDaVersaoCodigo.VIGENTE),
      permissoes: [
        {
          codigo: 'selecao:processos:aprovar',
          classificacao: sensibilidade(ClassificacaoDeProtecaoCodigo.INTERNO),
          deUnidade: false,
        },
      ],
      linkDoDocumento: 'https://api.test/documento/v1',
    },
    {
      id: 'v2',
      numero: 2,
      situacao: situacaoDaVersao(SituacaoDaVersaoCodigo.VIGENTE),
      permissoes: [
        {
          codigo: 'selecao:processos:aprovar',
          classificacao: sensibilidade(ClassificacaoDeProtecaoCodigo.PESSOAL),
          deUnidade: true,
        },
      ],
      linkDoDocumento: null,
    },
  ],
  concessoes: [
    concessao(),
    concessao({ concessaoId: 'c2', beneficiarioNome: 'Diogo Teste', ehDoLeitor: true }),
    concessao({
      concessaoId: 'c3',
      beneficiarioNome: 'Paulo Teste',
      unidadeId: null,
      escopoTipo: TIPO_DE_ESCOPO.INSTITUICAO,
    }),
  ],
};

export function reclassificacao(parcial: Partial<ReclassificacaoDto> = {}): ReclassificacaoDto {
  return { ...structuredClone(RECLASSIFICACAO), ...parcial };
}

export interface PaginaDaReclassificacao {
  readonly fixture: ComponentFixture<ReclassificacaoDetalhePage>;
  readonly host: HTMLElement;
  readonly assentar: () => Promise<void>;
}

const cliente = provideHttpClient(
  withInterceptors([
    (req) => leituras(req.url).pipe(map((body: unknown) => new HttpResponse({ body }))),
  ]),
);

const unidades = {
  provide: UnidadesApi,
  useValue: {
    listar: () => of(ok([{ id: 'unidade-1', nome: 'Centro de Seleção', sigla: 'CEPS' }])),
  },
};

function provedoresReclassificacao(concedidas: readonly string[]) {
  return [
    provideRouter([]),
    provideMensagensDeAcesso(),
    { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
    cliente,
    { provide: ReclassificacoesApi, useValue: api },
    { provide: DocumentoDaVersaoService, useValue: documentos },
    { provide: NotificationService, useValue: notificacoes },
    ...provedoresDeConsulta(concedidas),
  ];
}

function provedoresDeConsulta(concedidas: readonly string[]) {
  return [
    {
      provide: PermissoesService,
      useValue: {
        tem: (c: string) => concedidas.includes(c),
        temAlguma: (...c: string[]) => c.some((x) => concedidas.includes(x)),
      },
    },
    unidades,
  ];
}

function configurarReclassificacao(concedidas: readonly string[]): void {
  TestBed.configureTestingModule({ providers: provedoresReclassificacao(concedidas) });
}

async function assentar(): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver));
  TestBed.inject(ApplicationRef).tick();
  await new Promise((resolver) => setTimeout(resolver));
  TestBed.inject(ApplicationRef).tick();
}

/** Abre a reclassificação com a leitura respondida e as permissões informadas. */
export async function abrirReclassificacao(
  leitura: unknown = ok(reclassificacao()),
  concedidas: readonly string[] = [GESTAO_DE_ACESSOS],
): Promise<PaginaDaReclassificacao> {
  leituras.mockReturnValue(of(leitura));
  configurarReclassificacao(concedidas);
  const fixture = TestBed.createComponent(ReclassificacaoDetalhePage);
  fixture.componentRef.setInput('id', ID);
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  fixture.detectChanges();
  await assentar();
  return { fixture, host, assentar };
}

export const botao = (raiz: ParentNode, texto: string): HTMLButtonElement | undefined =>
  [...raiz.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(texto));

export function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

/** A caixa de marcar da concessão da pessoa, ou nada quando ela não pode ser marcada. */
export function caixaDe(host: HTMLElement, pessoa: string): HTMLInputElement | null {
  const rotulo = [...host.querySelectorAll<HTMLLabelElement>('label.checkbox')].find((l) =>
    l.textContent?.includes(pessoa),
  );
  return rotulo?.querySelector('input') ?? null;
}
