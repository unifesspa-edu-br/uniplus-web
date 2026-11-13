import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  type CategoriaDocumentoDto,
  type ItemDaProtecaoDoCatalogoDto,
  TipoDocumentoDto,
} from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { EdicaoDosTiposDocumento } from './edicao-dos-tipos-documento';
import { TiposDocumentoPage } from './tipos-documento.page';
import { TiposDocumentoStore } from './tipos-documento.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/tipos-documento`;
export const ESCRITA = `${BASE}/api/configuracao/admin/tipos-documento`;
export const CATEGORIAS_URL = `${BASE}/api/configuracao/categorias-documento`;
export const PROTECAO_URL = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
export const TITULO_DA_LISTA = '#cfg-tipos-documento-list-title';
export const PERMISSAO_DE_MANTER = 'configuracao:tipos-documento:manter';

/** A proteção de dados que o formulário exige, preenchida como Isabella faria. */
export const PROTECAO_PREENCHIDA = {
  classificacaoProtecao: 'PESSOAL',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Conferir o documento do candidato.',
};

/** As dez categorias semeadas pelo cadastro. */
export const CATEGORIAS: readonly CategoriaDocumentoDto[] = [
  ['IDENTIFICACAO', 'Identificação', 1],
  ['ESCOLARIDADE', 'Escolaridade', 2],
  ['TITULACAO_EXPERIENCIA', 'Titulação e experiência', 3],
  ['RENDA', 'Renda', 4],
  ['RESIDENCIA', 'Residência', 5],
  ['RACA_ETNIA', 'Raça/etnia', 6],
  ['SAUDE', 'Saúde', 7],
  ['DOCUMENTO_PROCESSUAL', 'Documento processual', 8],
  ['PRODUCAO_AVALIATIVA', 'Produção avaliativa', 9],
  ['OUTROS', 'Outros', 10],
].map(([codigo, nome, ordem]) => ({
  id: `ca7e0000-0000-7000-8000-${String(ordem).padStart(12, '0')}`,
  codigo: codigo as string,
  nome: nome as string,
  descricao: null,
  ordem: ordem as number,
  criadoEm: '2026-01-01T00:00:00Z',
}));

export const rg: TipoDocumentoDto = {
  id: '01960000-0000-7000-0000-0000000000d1',
  codigo: 'RG',
  nome: 'Registro Geral',
  descricao: 'Documento de identificação civil.',
  categoria: 'IDENTIFICACAO',
  formatosAceitos: 'pdf,jpg',
  tamanhoMaximoMb: 10,
  tipoEquivalente: 'CIN',
  ...PROTECAO_PREENCHIDA,
  protecaoAprovada: true,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const laudo: TipoDocumentoDto = {
  ...rg,
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO',
  nome: 'Laudo médico — PcD',
  descricao: null,
  categoria: 'SAUDE',
  formatosAceitos: null,
  tamanhoMaximoMb: null,
  tipoEquivalente: null,
  criadoEm: '2026-06-11T12:00:00Z',
};

/** Tipo numa das categorias que o roster escrito à mão não conhecia. */
export const diploma: TipoDocumentoDto = {
  ...laudo,
  id: '01960000-0000-7000-0000-0000000000d3',
  codigo: 'DIPLOMA_GRADUACAO',
  nome: 'Diploma de graduação',
  categoria: 'TITULACAO_EXPERIENCIA',
  formatosAceitos: 'pdf',
  criadoEm: '2026-08-30T12:00:00Z',
};

/** Tipo cuja categoria saiu do cadastro depois de já tê-lo classificado. */
export const orfao: TipoDocumentoDto = {
  ...laudo,
  id: '01960000-0000-7000-0000-0000000000d4',
  codigo: 'CERTIDAO_MILITAR',
  nome: 'Certidão militar',
  categoria: 'DOCUMENTO_MILITAR',
  criadoEm: '2026-08-30T13:00:00Z',
};

export const problema = (status: number, corpo: object = {}) => {
  const padrao =
    status >= 500
      ? { code: 'uniplus.internal.unexpected', traceId: `trace-${status}` }
      : status === 403
        ? { code: 'uniplus.auth.forbidden' }
        : {};
  return [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...padrao, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;
};

/** A recusa de campo como o servidor a emite: o código da regra violada e o campo em camelCase. */
export const recusaDeCampo = (
  field: string,
  message: string,
  code = 'uniplus.configuracao.tipo_documento.nome_tamanho',
) => problema(422, { code, errors: [{ field, code, message }] });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

/** Um item do que aguarda a proteção de dados, com a situação dada. */
export const pendencia = (
  tipo: TipoDocumentoDto,
  aprovacao: Partial<ItemDaProtecaoDoCatalogoDto['aprovacao']>,
): ItemDaProtecaoDoCatalogoDto => ({
  tipo: 'TIPO_DOCUMENTO',
  id: tipo.id,
  codigo: tipo.codigo,
  nome: tipo.nome,
  classificacaoProtecao: tipo.classificacaoProtecao,
  finalidadeTratamento: tipo.finalidadeTratamento,
  hipoteseLegal: tipo.hipoteseLegal,
  aprovacao: {
    situacao: 'PENDENTE',
    solicitadaEm: null,
    decididaEm: null,
    classificacaoRecomendada: null,
    justificativa: null,
    aceitaEm: null,
    ciclo: 1,
    manifestadaEm: null,
    manifestacaoDesfavoravel: false,
    ...aprovacao,
  },
});

export interface OpcoesDaPagina {
  readonly concedidas?: readonly string[];
  readonly categorias?: readonly CategoriaDocumentoDto[] | 'falha' | 'pendente';
  readonly pendencias?: readonly ItemDaProtecaoDoCatalogoDto[] | 'falha';
  /** O status com que as leituras de apoio em falha respondem; o padrão é uma falha de servidor. */
  readonly statusDaFalha?: number;
}

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(
  itens: readonly TipoDocumentoDto[] = [rg, laudo],
  opcoes: OpcoesDaPagina = {},
) {
  const concedidas = signal<readonly string[]>(opcoes.concedidas ?? [PERMISSAO_DE_MANTER]);
  const statusDaFalha = opcoes.statusDaFalha ?? 503;
  TestBed.configureTestingModule({
    imports: [TiposDocumentoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      {
        provide: PermissoesService,
        useValue: {
          tem: (c: string) => concedidas().includes(c),
          temAlguma: (...cs: string[]) => cs.some((c) => concedidas().includes(c)),
        },
      },
    ],
  });
  const fixture: ComponentFixture<TiposDocumentoPage> = TestBed.createComponent(TiposDocumentoPage);
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDosTiposDocumento);
  const store = injetor.get(TiposDocumentoStore);
  const notificacoes = TestBed.inject(NotificationService);
  const sucessos = vi.spyOn(notificacoes, 'success');
  const erros = vi.spyOn(notificacoes, 'errorFromProblem');

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const encontrado = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };
  const pelaEtiqueta = (nome: string): HTMLButtonElement =>
    elemento(`button[aria-label="${nome}"]`);
  const atenderProtecao = (itensPendentes: ItemDaProtecaoDoCatalogoDto[] | 'falha' = []): void => {
    for (const req of http.match((r) => r.url === PROTECAO_URL).filter((p) => !p.cancelled)) {
      if (itensPendentes === 'falha') req.flush(...problema(statusDaFalha));
      else req.flush(itensPendentes);
    }
  };
  const atenderCategorias = (resposta: OpcoesDaPagina['categorias'] = CATEGORIAS): void => {
    for (const req of http.match(CATEGORIAS_URL)) {
      if (resposta === 'pendente') continue;
      if (resposta === 'falha') req.flush(...problema(statusDaFalha));
      else req.flush(resposta);
    }
  };
  /** Atende as leituras que acompanham a lista: o catálogo e a situação da proteção. */
  const atenderApoios = (): void => {
    atenderCategorias(opcoes.categorias === 'pendente' ? 'pendente' : opcoes.categorias);
    const pendencias = opcoes.pendencias;
    atenderProtecao(pendencias === 'falha' ? 'falha' : [...(pendencias ?? [])]);
  };
  const recarregarCom = async (lista: readonly TipoDocumentoDto[]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush(lista);
    atenderProtecao();
    await propagar();
  };
  const preencher = (nome: string, valor: string): void => {
    const campo = elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event(campo.tagName === 'SELECT' ? 'change' : 'input'));
  };
  const formulario = (): HTMLFormElement => elemento('#cfg-tipo-documento-form');
  const acionar = async (botao: HTMLButtonElement): Promise<void> => {
    botao.focus();
    botao.click();
    await propagar();
  };

  fixture.detectChanges();
  atenderApoios();
  http.expectOne((r) => r.url === LISTA).flush(itens);
  await propagar();

  return {
    fixture,
    http,
    edicao,
    store,
    sucessos,
    erros,
    propagar,
    elemento,
    recarregarCom,
    preencher,
    atenderProtecao,
    atenderCategorias,
    concedidas,
    formulario,
    novo: (): HTMLButtonElement => elemento('#cfg-tipos-documento-novo'),
    editar: (t: TipoDocumentoDto = rg) => pelaEtiqueta(`Editar tipo de documento ${t.codigo}`),
    remover: (t: TipoDocumentoDto = rg) => pelaEtiqueta(`Remover tipo de documento ${t.codigo}`),
    nomeDaLinha: (t: TipoDocumentoDto = rg) => pelaEtiqueta(`Ver o detalhe de ${t.nome}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-tipo-documento-form"]'),
    confirmar: (dialogo = 'Remover tipo de documento'): HTMLButtonElement =>
      confirmacao(dialogo).querySelector(
        '[data-testid="confirm-dialog-confirm"]',
      ) as HTMLButtonElement,
    cancelarDaConfirmacao: (dialogo = 'Remover tipo de documento'): HTMLButtonElement =>
      confirmacao(dialogo).querySelector(
        '[data-testid="confirm-dialog-cancel"]',
      ) as HTMLButtonElement,
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Novo tipo" e preenche o mínimo para enviar. */
    async abrirCadastro(): Promise<void> {
      await acionar(elemento('#cfg-tipos-documento-novo'));
      preencher('nome', 'Declaração de renda');
      preencher('categoria', 'RENDA');
      preencher('classificacaoProtecao', PROTECAO_PREENCHIDA.classificacaoProtecao);
      await propagar();
      preencher('hipoteseLegal', PROTECAO_PREENCHIDA.hipoteseLegal);
      preencher('finalidadeTratamento', PROTECAO_PREENCHIDA.finalidadeTratamento);
      await propagar();
    },
    /** Abre o formulário em branco, sem preencher nada. */
    async acionarNovo(): Promise<void> {
      await acionar(elemento('#cfg-tipos-documento-novo'));
    },
    /** Envia o formulário aberto sem esperar requisição: a validação local deve barrá-lo. */
    async enviarSemRequisicao(): Promise<void> {
      const botao = elemento<HTMLButtonElement>('button[form="cfg-tipo-documento-form"]');
      botao.focus();
      botao.click();
      formulario().dispatchEvent(new Event('submit', { cancelable: true }));
      await propagar();
      await propagar();
      http.expectNone((r) => r.url.startsWith(ESCRITA));
    },
    async abrirEdicao(tipo: TipoDocumentoDto = rg): Promise<void> {
      await acionar(pelaEtiqueta(`Editar tipo de documento ${tipo.codigo}`));
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA) {
      await acionar(elemento('button[form="cfg-tipo-documento-form"]'));
      return http.expectOne((r) => r.url === url && r.method !== 'GET');
    },
    async confirmarRemocao(tipo: TipoDocumentoDto = rg) {
      await acionar(pelaEtiqueta(`Remover tipo de documento ${tipo.codigo}`));
      confirmacao('Remover tipo de documento')
        .querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]')
        ?.click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${tipo.id}`);
    },
    /** Termina o teste sem requisição esquecida: a situação da proteção é relida a cada escrita. */
    encerrar(): void {
      atenderProtecao();
      for (const req of http.match((r) => r.url.endsWith('/protecao/atos'))) {
        if (!req.cancelled) req.flush([]);
      }
      http.verify();
    },
  };

  function confirmacao(titulo: string): HTMLElement {
    const todas = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        'cfg-confirmacao-de-remocao',
      ),
    ];
    const achada = todas.find((c) => c.textContent?.includes(titulo));
    expect(achada, titulo).toBeTruthy();
    return achada as HTMLElement;
  }
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
