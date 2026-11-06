import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, type FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { EdicaoDoFato } from './edicao-do-fato';
import { EdicaoDosFatos } from './edicao-dos-fatos';
import { FatosCandidatoPage } from './fatos-candidato.page';
import { FatosCandidatoStore } from './fatos-candidato.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/admin/fatos-candidato`;
export const CATALOGO = `${BASE}/api/configuracao/fatos-candidato`;
export const FASES = `${BASE}/api/configuracao/fases-canonicas`;
export const PROTECAO = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
export const TITULO_DA_LISTA = 'cfg-fatos-list-title';
export const PERMISSAO_DE_MANTER = 'configuracao:fatos-candidato:manter';
export const PERMISSAO_DE_CONSULTAR = 'configuracao:fatos-candidato:consultar';

const APROVADA = {
  situacao: 'APROVADA',
  solicitadaEm: null,
  decididaEm: null,
  classificacaoRecomendada: null,
  justificativa: null,
  aceitaEm: null,
};

export const comAprovacao = (
  fato: FatoCandidatoDto,
  situacao: string,
  classificacaoRecomendada: string | null = null,
  justificativa: string | null = null,
): FatoCandidatoDto => ({
  ...fato,
  aprovacao: { ...APROVADA, situacao, classificacaoRecomendada, justificativa },
});

/** Fato declarado de sim ou não: o mais simples de editar. */
export const trabalha: FatoCandidatoDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'TRABALHA',
  nome: 'Trabalha',
  descricao: 'Se o candidato trabalha.',
  componenteExibicao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  fonteValores: null,
  formato: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:TRABALHA',
  escopo: 'CANDIDATO',
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Classificar a reserva de vagas.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  sistema: false,
  ativo: true,
  valores: [],
  regrasPadrao: [],
  aprovacao: APROVADA,
};

/** Fato declarado categórico, com um valor. */
export const corRaca: FatoCandidatoDto = {
  ...trabalha,
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'COR_RACA',
  nome: 'Cor ou raça',
  descricao: 'Cor ou raça autodeclarada.',
  dominio: 'CATEGORICO',
  fonteValores: 'GLOBAL',
  binding: 'CAMPO_INSCRICAO:COR_RACA',
  classificacaoProtecao: 'SENSIVEL',
  finalidadeTratamento: 'Reserva de vagas.',
  hipoteseLegal: 'CUMPRIMENTO_OBRIGACAO_LEGAL',
  valores: [{ codigo: 'PRETA', descricao: 'Preta', ordem: 0, ativo: true, orientacao: null }],
};

export const comValores = (fato: FatoCandidatoDto = corRaca): FatoCandidatoDto => ({
  ...fato,
  valores: [
    { codigo: 'PRETA', descricao: 'Preta', ordem: 0, ativo: true, orientacao: null },
    { codigo: 'PARDA', descricao: 'Parda', ordem: 1, ativo: false, orientacao: null },
    { codigo: 'BRANCA', descricao: 'Branca', ordem: 2, ativo: true, orientacao: null },
  ],
});

export const derivado: FatoCandidatoDto = {
  ...trabalha,
  id: '01960000-0000-7000-0000-0000000000d1',
  codigo: 'PERFIL',
  nome: 'Perfil',
  origem: 'DERIVADO',
  binding: 'REGRA_DERIVACAO:PERFIL',
};

export const agregado: FatoCandidatoDto = {
  ...derivado,
  id: '01960000-0000-7000-0000-0000000000e1',
  codigo: 'PERFIL_FAMILIAR',
  nome: 'Perfil familiar',
  binding: 'AGREGACAO_GRUPO:RENDA',
};

export const quilombola = {
  id: 'q',
  codigo: 'QUILOMBOLA',
  nome: 'Quilombola',
  descricao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:QUILOMBOLA',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  escopo: 'CANDIDATO',
};

export const FASES_DA_API = [
  { id: 'f1', codigo: 'INSCRICAO', nome: 'Inscrição', descricao: null },
  { id: 'f2', codigo: 'HOMOLOGACAO', nome: 'Homologação', descricao: null },
];

export const pendencia = (fato: FatoCandidatoDto) => ({
  tipo: 'FATO',
  id: fato.id,
  codigo: fato.codigo,
  nome: fato.nome,
  classificacaoProtecao: fato.classificacaoProtecao,
  finalidadeTratamento: fato.finalidadeTratamento,
  hipoteseLegal: fato.hipoteseLegal,
  aprovacao: { ...APROVADA, situacao: 'PENDENTE' },
});

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDeCampo = (field: string, message: string, code = 'x') =>
  problema(422, {
    code: 'uniplus.validation_failed',
    title: 'Requisição inválida',
    errors: [{ field, code, message }],
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = (id = 'novo-id') => [id, { status: 201, statusText: 'Created' }] as const;

export const urlDoFato = (fato: FatoCandidatoDto): string => `${LISTA}/${fato.id}`;

export interface OpcoesDaPagina {
  readonly concedidas?: readonly string[];
  readonly pendencias?: readonly unknown[];
}

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(
  itens: readonly FatoCandidatoDto[] = [trabalha, corRaca],
  opcoes: OpcoesDaPagina = {},
) {
  const concedidas = signal<readonly string[]>(opcoes.concedidas ?? [PERMISSAO_DE_MANTER]);
  TestBed.configureTestingModule({
    imports: [FatosCandidatoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: PermissoesService, useValue: { tem: (c: string) => concedidas().includes(c) } },
    ],
  });
  const fixture: ComponentFixture<FatosCandidatoPage> = TestBed.createComponent(FatosCandidatoPage);
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDosFatos);
  const editor = injetor.get(EdicaoDoFato);
  const store = injetor.get(FatosCandidatoStore);
  const notificacoes = TestBed.inject(NotificationService);
  const sucessos = vi.spyOn(notificacoes, 'success');
  const erros = vi.spyOn(notificacoes, 'errorFromProblem');
  const informacoes = vi.spyOn(notificacoes, 'info');

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const encontrado = raiz().querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };
  const existe = (seletor: string): boolean => raiz().querySelector(seletor) !== null;
  const texto = (seletor?: string): string =>
    ((seletor ? elemento(seletor) : raiz()).textContent ?? '').replace(/\s+/gu, ' ');
  const pelaEtiqueta = (nome: string): HTMLButtonElement =>
    elemento(`button[aria-label="${nome}"]`);
  const botaoPeloTexto = (
    rotulo: string,
    dentro: ParentNode = raiz(),
  ): HTMLButtonElement | undefined =>
    [...dentro.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.replace(/\s+/gu, ' ').trim() === rotulo,
    );
  const acionar = async (botao: HTMLElement): Promise<void> => {
    botao.focus();
    botao.click();
    await propagar();
  };
  /** A releitura da lista que a escrita pede; a ausência dela é falha do teste, não indiferença. */
  const pedidoDaLista = (): TestRequest =>
    http.expectOne((r) => r.url === LISTA && r.method === 'GET');
  const atenderPendencias = (itensPendentes: readonly unknown[] = []): void => {
    for (const req of http.match((r) => r.url === PROTECAO)) {
      if (!req.cancelled) req.flush(itensPendentes);
    }
  };
  const recarregarCom = async (
    lista: readonly FatoCandidatoDto[],
    pendentes: readonly unknown[] = [],
  ): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(lista);
    atenderPendencias(pendentes);
    await propagar();
  };
  const digitar = (seletor: string, valor: string): void => {
    const campo = elemento<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(seletor);
    campo.value = valor;
    campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input'));
  };
  const submeter = (seletor: string): void => {
    elemento<HTMLFormElement>(seletor).dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const atenderApoios = (catalogo: readonly unknown[] = []): void => {
    for (const req of http.match((r) => r.url === CATALOGO && r.method === 'GET')) {
      if (!req.cancelled) req.flush(catalogo);
    }
    for (const req of http.match((r) => r.url === FASES && r.method === 'GET')) {
      if (!req.cancelled) req.flush(FASES_DA_API);
    }
  };

  fixture.detectChanges();
  http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(itens);
  atenderPendencias(opcoes.pendencias ?? []);
  await propagar();

  return {
    fixture,
    http,
    edicao,
    editor,
    store,
    sucessos,
    erros,
    informacoes,
    permissoes: concedidas,
    propagar,
    raiz,
    elemento,
    existe,
    texto,
    pelaEtiqueta,
    botaoPeloTexto,
    acionar,
    pedidoDaLista,
    atenderPendencias,
    atenderApoios,
    recarregarCom,
    digitar,
    submeter,
    titulo: (): HTMLElement => elemento(`#${TITULO_DA_LISTA}`),
    novo: (): HTMLButtonElement => elemento('#cfg-fatos-novo'),
    editar: (f: FatoCandidatoDto = trabalha) => pelaEtiqueta(`Editar o fato ${f.codigo}`),
    desativar: (f: FatoCandidatoDto = trabalha) => pelaEtiqueta(`Desativar o fato ${f.codigo}`),
    reativar: (f: FatoCandidatoDto = trabalha) => pelaEtiqueta(`Reativar o fato ${f.codigo}`),
    nomeDaLinha: (f: FatoCandidatoDto = trabalha) => pelaEtiqueta(`Ver o detalhe de ${f.nome}`),
    drawerDoFato: (): HTMLDialogElement => elemento('dialog[aria-label="Fato do candidato"]'),
    detalhe: (): HTMLDialogElement => elemento('dialog[aria-label="Detalhe do fato do candidato"]'),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Editar" da linha e entrega o fato, o catálogo e as fases que a edição lê. */
    async abrirEdicao(
      fato: FatoCandidatoDto = trabalha,
      carregado: FatoCandidatoDto = fato,
      catalogo: readonly unknown[] = [],
    ): Promise<void> {
      await acionar(pelaEtiqueta(`Editar o fato ${fato.codigo}`));
      http.expectOne(urlDoFato(fato)).flush(carregado);
      await propagar();
      atenderApoios(catalogo);
      await propagar();
    },
    /** Clica de verdade em "Novo fato"; as fases chegam logo em seguida. */
    async abrirCriacao(): Promise<void> {
      await acionar(elemento('#cfg-fatos-novo'));
      atenderApoios();
      await propagar();
    },
    /** Entrega a recarga do fato aberto, que segue a toda escrita da edição; a cópia faz o sinal mudar, como o JSON novo da API. */
    async recarregarOFato(fato: FatoCandidatoDto, comLista = true): Promise<void> {
      await propagar();
      http.expectOne(urlDoFato(fato)).flush(structuredClone(fato));
      atenderPendencias();
      if (comLista) pedidoDaLista().flush([fato]);
      else http.expectNone((r) => r.url === LISTA && r.method === 'GET');
      await propagar();
      atenderPendencias();
      await propagar();
    },
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
