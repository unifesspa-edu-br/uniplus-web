import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, type Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type AprovacaoDaProtecaoDto,
  type DecisaoDaProtecaoDto,
  type DetalheDaProtecaoDoCatalogoDto,
  type ItemDaProtecaoDoCatalogoDto,
  type ManifestacaoDaProtecaoDto,
} from '@uniplus/shared-data/configuracao';
import { expect } from 'vitest';
import { ProtecaoDoCatalogoPage } from './protecao-do-catalogo.page';

export const BASE = 'http://localhost:5000';
export const URL_DA_FILA = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
export const URL_DAS_DECISOES = `${URL_DA_FILA}/decisoes`;
export const URL_DAS_CATEGORIAS = `${BASE}/api/configuracao/categorias-documento`;
export const SEM_CONTEUDO = { status: 204, statusText: 'No Content' } as const;
export const APROVAR = 'configuracao:protecao-do-catalogo:aprovar';
export const CONSULTAR = 'configuracao:protecao-do-catalogo:consultar';
export const MANIFESTAR = 'configuracao:protecao-do-catalogo:manifestar';

export const CODIGO_PROTECAO_MUDOU = 'uniplus.configuracao.protecao_do_catalogo.protecao_mudou';
export const CODIGO_DE_PROCESSAMENTO = 'uniplus.idempotency.processing_conflict';

/** A aprovação solicitada no ciclo 2, sem manifestação. */
export const SOLICITADA: AprovacaoDaProtecaoDto = {
  situacao: 'SOLICITADA',
  ciclo: 2,
  solicitadaEm: '2026-11-01T12:00:00Z',
  decididaEm: null,
  classificacaoRecomendada: null,
  justificativa: null,
  aceitaEm: null,
  manifestadaEm: null,
  manifestacaoDesfavoravel: false,
};

export const laudo: ItemDaProtecaoDoCatalogoDto = {
  tipo: 'TIPO_DOCUMENTO',
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO_COMPLEMENTAR',
  nome: 'Laudo médico complementar',
  classificacaoProtecao: 'INTERNO',
  finalidadeTratamento: 'Conferir o laudo do candidato com deficiência.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  aprovacao: SOLICITADA,
};

export const rural: ItemDaProtecaoDoCatalogoDto = {
  ...laudo,
  tipo: 'FATO',
  id: '01960000-0000-7000-0000-0000000000d3',
  codigo: 'RESIDE_EM_AREA_RURAL',
  nome: 'Reside em área rural',
  classificacaoProtecao: 'PESSOAL',
};

/** O detalhe do tipo de documento, como a API o devolve; sem manifestação vigente. */
export const detalheDoLaudo: DetalheDaProtecaoDoCatalogoDto = {
  ...laudo,
  descricao: 'Laudo que complementa o pedido de atendimento especializado.',
  fato: null,
  tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf,jpg', tamanhoMaximoMb: 10 },
  atos: [],
  manifestacoesVigentes: [],
};

const FATO_CATEGORICO = {
  dominio: 'CATEGORICO',
  cardinalidade: 'ESCALAR',
  sistema: false,
  componenteExibicao: null,
  valores: [
    {
      codigo: 'SIM_RURAL',
      descricao: 'Mora em área rural',
      orientacao: 'Considere o endereço do comprovante.',
    },
    { codigo: 'NAO_RURAL', descricao: 'Não mora em área rural', orientacao: null },
  ],
};

/** O detalhe do fato categórico, que não admite classificação abaixo de pessoal. */
export function detalheDoFato(
  extra: Partial<DetalheDaProtecaoDoCatalogoDto> = {},
): DetalheDaProtecaoDoCatalogoDto {
  const base = { ...rural, descricao: 'Se o candidato mora em área rural.', tipoDocumento: null };
  return { ...base, atos: [], manifestacoesVigentes: [], fato: FATO_CATEGORICO, ...extra };
}

/** Uma manifestação vigente do Encarregado de dados no ciclo 2. */
export function manifestacao(
  parcial: Partial<ManifestacaoDaProtecaoDto> = {},
): ManifestacaoDaProtecaoDto {
  return {
    id: 'manifestacao-1',
    ciclo: 2,
    parecer: 'INADEQUADA',
    texto: 'O laudo revela condição de saúde: a classificação deve ser sensível.',
    autorNome: 'Isabella Figueiredo',
    instante: '2026-11-02T14:00:00Z',
    substituiId: null,
    situacao: 'VIGENTE',
    ...parcial,
  };
}

/** A reprovação do fato da renda; a base das decisões da aba. */
export const decisaoDoFato: DecisaoDaProtecaoDto = {
  cadastro: 'FATO',
  itemId: rural.id,
  itemCodigo: 'RENDA_FAMILIAR_BRUTA',
  itemNome: 'Renda familiar bruta',
  ato: 'REPROVACAO',
  instante: '2026-10-31T13:00:00Z',
  atorNome: 'Betina Albuquerque',
  classificacaoProtecao: 'PESSOAL',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Conferir a renda familiar.',
  classificacaoRecomendada: null,
  justificativa: 'A renda familiar é dado sensível.',
  ciclo: 1,
  dianteDeManifestacaoDesfavoravel: false,
};

/** O ajuste recomendado ao laudo. */
export const decisaoDoTipo: DecisaoDaProtecaoDto = {
  ...decisaoDoFato,
  cadastro: 'TIPO_DOCUMENTO',
  itemId: laudo.id,
  itemCodigo: laudo.codigo,
  itemNome: laudo.nome,
  ato: 'AJUSTE_RECOMENDADO',
  instante: '2026-10-30T15:00:00Z',
  atorNome: 'Caroline Ribeiro',
  classificacaoProtecao: 'INTERNO',
  classificacaoRecomendada: 'PESSOAL',
  justificativa: 'O laudo identifica o candidato.',
};

/** Uma resposta de erro da API no formato que o cliente interpreta. */
export const problema = (status: number, code: string, title: string) =>
  [
    JSON.stringify({ status, code, title }),
    { status, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export interface PaginaMontada {
  readonly fixture: ComponentFixture<ProtecaoDoCatalogoPage>;
  readonly controller: HttpTestingController;
  readonly tela: HTMLElement;
  assentar(): Promise<void>;
  carregarFila(itens: readonly ItemDaProtecaoDoCatalogoDto[]): Promise<void>;
  abrirDetalhe(): Promise<void>;
  encerrar(): void;
}

export function clicar(alvo: Element | null | undefined, descricao = 'o alvo do clique'): void {
  expect(alvo, `${descricao} existe`).toBeTruthy();
  (alvo as HTMLElement).click();
}

/** Procura o botão pelo texto exato dentro de `raiz`; falha se não existe. */
export function botaoPorTexto(raiz: ParentNode, texto: string): HTMLButtonElement {
  const botao = [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === texto,
  );
  expect(botao, `botão "${texto}"`).toBeDefined();
  return botao as HTMLButtonElement;
}

/** O drawer do item que aguarda a decisão. */
export const drawerDoItem = (tela: HTMLElement) =>
  tela.querySelector('dialog[aria-label^="Detalhe do item"]');

/** O botão do rodapé do drawer pelo texto, ou `undefined` quando a tela não o oferece. */
export const botaoDoRodape = (tela: HTMLElement, nome: string): HTMLButtonElement | undefined =>
  Array.from(
    drawerDoItem(tela)?.querySelectorAll<HTMLButtonElement>('.form-drawer__footer button') ?? [],
  ).find((b) => b.textContent?.trim() === nome);

export const dialogoDaDecisao = (tela: HTMLElement) =>
  tela.querySelector('cfg-decisao-da-protecao-dialogo dialog');

/** O botão do rodapé do diálogo da decisão pelo texto. */
export const confirmarNoDialogo = (
  tela: HTMLElement,
  rotulo: string,
): HTMLButtonElement | undefined =>
  Array.from(
    dialogoDaDecisao(tela)?.querySelectorAll<HTMLButtonElement>('.uni-dialog__footer button') ?? [],
  ).find((b) => b.textContent?.trim() === rotulo);

export const campoDaJustificativa = (tela: HTMLElement): HTMLTextAreaElement =>
  tela.querySelector('cfg-decisao-da-protecao-dialogo textarea') as HTMLTextAreaElement;

/** Escreve no campo e avisa o formulário, como a pessoa faria. */
export function digitar(campo: HTMLTextAreaElement | HTMLInputElement, texto: string): void {
  campo.value = texto;
  campo.dispatchEvent(new Event('input'));
}

type Permissoes = readonly string[] | Signal<readonly string[]>;

function provedores(permissoes: Permissoes) {
  const lista = typeof permissoes === 'function' ? permissoes : () => permissoes;
  return [
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
    provideRouter([]),
    { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    { provide: PermissoesService, useValue: { tem: (codigo: string) => lista().includes(codigo) } },
  ];
}

function assentarCom(fixture: ComponentFixture<ProtecaoDoCatalogoPage>): () => Promise<void> {
  const appRef = TestBed.inject(ApplicationRef);
  return async () => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };
}

/** Abre o detalhe do item pela linha e o atende com a resposta da API. */
export async function abrirItem(
  pagina: Pick<PaginaMontada, 'tela' | 'controller' | 'assentar'>,
  item: ItemDaProtecaoDoCatalogoDto,
  detalhe: DetalheDaProtecaoDoCatalogoDto,
): Promise<void> {
  clicar(
    pagina.tela.querySelector(`td button[aria-label="Ver o detalhe de ${item.nome}"]`),
    'a linha',
  );
  await pagina.assentar();
  const segmento = item.tipo === 'FATO' ? 'fatos' : 'tipos-documento';
  pagina.controller.expectOne(`${URL_DA_FILA}/${segmento}/${item.id}`).flush(detalhe);
  await pagina.assentar();
}

type PaginaCriada = Pick<PaginaMontada, 'fixture' | 'controller' | 'tela' | 'assentar'>;

function criarPagina(permissoes: Permissoes): PaginaCriada {
  TestBed.configureTestingModule({
    imports: [ProtecaoDoCatalogoPage],
    providers: provedores(permissoes),
  });
  const fixture = TestBed.createComponent(ProtecaoDoCatalogoPage);
  fixture.detectChanges();
  const tela = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    tela,
    controller: TestBed.inject(HttpTestingController),
    assentar: assentarCom(fixture),
  };
}

/** Monta a página com as permissões dadas (lista fixa ou sinal) e devolve o que os cenários usam. */
export function montarPagina(permissoes: Permissoes): PaginaMontada {
  const pagina = criarPagina(permissoes);
  return {
    ...pagina,
    carregarFila: async (itens) => {
      pagina.controller.expectOne((r) => r.url === URL_DA_FILA).flush(itens);
      await pagina.assentar();
    },
    abrirDetalhe: () => abrirItem(pagina, laudo, detalheDoLaudo),
    encerrar: () => encerrar(pagina.controller),
  };
}

function encerrar(controller: HttpTestingController): void {
  controller.match((r) => r.url === URL_DAS_CATEGORIAS).forEach((req) => req.flush([]));
  controller.verify();
}

/** A navegação do roteador termina em outra tarefa: espera por ela antes de olhar a tela. */
export async function navegarNaPagina(pagina: Pick<PaginaMontada, 'assentar'>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await pagina.assentar();
  await pagina.assentar();
}

/** Abre a aba das decisões pelo endereço, como o link a traz, e atende a primeira página. */
export async function abrirAbaDeDecisoes(
  pagina: PaginaMontada,
  consulta: string,
  itens: readonly DecisaoDaProtecaoDto[],
  cabecalhos: Record<string, string>,
): Promise<HTMLElement> {
  pagina.controller.expectOne((r) => r.url === URL_DA_FILA).flush([]);
  await TestBed.inject(Router).navigateByUrl(`/${consulta}`);
  await navegarNaPagina(pagina);
  pagina.controller
    .expectOne((r) => r.url === URL_DAS_DECISOES)
    .flush(itens, { headers: cabecalhos });
  await pagina.assentar();
  return pagina.tela;
}
