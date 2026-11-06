import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  CursoDto,
  LocalOfertaDto,
  OfertaCursoDto,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH, UnidadeDto } from '@uniplus/shared-data/organizacao';
import { expect, vi } from 'vitest';
import { EdicaoDasOfertasCurso } from './edicao-das-ofertas-curso';
import { OfertasCursoPage } from './ofertas-curso.page';
import { OfertasCursoStore } from './ofertas-curso.store';
import { VinculosDaOferta } from './vinculos-da-oferta';

const BASE = 'http://localhost:5000';
/** Teto de página da API: `limit` fora de 1..100 responde 422 e o lookup rejeitado deixa o select vazio. */
export const LIMITE_MAXIMO_API = 100;
export const LISTA = `${BASE}/api/configuracao/ofertas-curso`;
export const ESCRITA = `${BASE}/api/configuracao/admin/ofertas-curso`;
export const CURSOS = `${BASE}/api/configuracao/cursos`;
export const LOCAIS = `${BASE}/api/configuracao/locais-oferta`;
export const UNIDADES = `${BASE}/api/organizacao/unidades`;
export const TITULO_DA_LISTA = '#cfg-ofertas-list-title';

const CODIGO = 'uniplus.configuracao.oferta_curso.';
export const NAO_ENCONTRADA = `${CODIGO}nao_encontrada`;
export const PROCESSANDO = 'uniplus.idempotency.processing_conflict';
export const CORPO_DIVERGENTE = 'uniplus.idempotency.body_mismatch';
export const ERRO_INTERNO = 'uniplus.internal.unexpected';
export const SEM_PERMISSAO = 'uniplus.auth.forbidden';

export const engCiv: CursoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
  criadoEm: '2026-06-10T12:00:00Z',
};

export const engMinas: CursoDto = {
  ...engCiv,
  id: '01960000-0000-7000-0000-0000000000c2',
  codigo: 'ENG-MIN',
  nome: 'Engenharia de Minas',
};

export const maraba: LocalOfertaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  tipo: TipoLocalOferta.campusSede,
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  codigoEmec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const ige = {
  id: '01960000-0000-7000-0000-0000000000f1',
  nome: 'Instituto de Geociências e Engenharias',
  alias: null,
  slug: 'ige',
  sigla: 'IGE',
  codigo: 'IGE',
  unidadeSuperiorId: null,
  tipo: 'Instituto',
  unidadeAcademica: true,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
} as UnidadeDto;

export const oferta: OfertaCursoDto = {
  id: '01960000-0000-7000-0000-0000000000d1',
  cursoId: engCiv.id,
  localOfertaId: maraba.id,
  unidadeOfertante: {
    origemId: ige.id,
    sigla: 'IGE',
    nome: 'Instituto de Geociências e Engenharias',
    tipo: 'Instituto',
  },
  programaDeOferta: 'REGULAR',
  formatoPedagogico: 'PRESENCIAL',
  regimeDeTurno: 'REGULAR',
  regimeDeFuncionamento: 'EXTENSIVO',
  turnos: ['MATUTINO'],
  eMecCodigo: '123456',
  codigoSga: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

/** O nome acessível das ações da linha de `oferta`. */
export const identificador = 'Engenharia Civil · IGE · Campus sede — Marabá · Regular · Matutino';

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDoDominio = (code: string, title = 'Falha') => problema(422, { code, title });

/** A recusa de validação como o endpoint a emite: `errors[]` com o campo em camelCase; o código do problema é o do primeiro erro. */
export const recusaDeCampos = (
  ...erros: readonly { field: string; code: string; message: string }[]
) =>
  problema(422, {
    code: `${CODIGO}${erros[0].code}`,
    title: erros[0].message,
    errors: erros.map(({ field, code, message }) => ({ field, code: `${CODIGO}${code}`, message })),
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

/** O que cada catálogo responde ao carregar a página; `'falha'` é uma recusa 500. */
export interface CatalogosDaPagina {
  readonly cursos?: readonly CursoDto[] | 'falha';
  readonly locais?: readonly LocalOfertaDto[] | 'falha';
}

function responder(pedido: TestRequest, resposta: readonly unknown[] | 'falha'): void {
  if (resposta === 'falha') {
    pedido.flush(...problema(500, { code: ERRO_INTERNO }));
    return;
  }
  pedido.flush(resposta);
}

/** Os selects de vínculo são gerados em laço: a diretiva não grava o atributo, então são achados pelo id. */
const ID_DOS_VINCULOS: Readonly<Record<string, string>> = {
  cursoId: 'cfg-oferta-curso-id',
  localOfertaId: 'cfg-oferta-local-id',
  unidadeOfertanteOrigemId: 'cfg-oferta-unidade-id',
};

/** A página montada com a lista e os catálogos já carregados, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(
  itens: readonly OfertaCursoDto[] = [oferta],
  catalogos: CatalogosDaPagina = {},
) {
  TestBed.configureTestingModule({
    imports: [OfertasCursoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
    ],
  });
  const fixture: ComponentFixture<OfertasCursoPage> = TestBed.createComponent(OfertasCursoPage);
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDasOfertasCurso);
  const store = injetor.get(OfertasCursoStore);
  const vinculos = injetor.get(VinculosDaOferta);
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
  const doCatalogo = (url: string): TestRequest => {
    const pedido = http.expectOne((r) => r.url === url);
    const limite = Number(pedido.request.params.get('limit'));
    expect(limite).toBeGreaterThanOrEqual(1);
    expect(limite).toBeLessThanOrEqual(LIMITE_MAXIMO_API);
    return pedido;
  };
  const recarregarCom = async (lista: readonly OfertaCursoDto[]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush(lista);
    await propagar();
  };
  const seletorDoCampo = (nome: string): string =>
    nome in ID_DOS_VINCULOS ? `#${ID_DOS_VINCULOS[nome]}` : `[formcontrolname="${nome}"]`;
  const preencher = (nome: string, valor: string): void => {
    const campo = elemento<HTMLInputElement>(seletorDoCampo(nome));
    campo.value = valor;
    campo.dispatchEvent(new Event(campo.tagName === 'SELECT' ? 'change' : 'input'));
  };
  const turno = (rotulo: string): HTMLInputElement => {
    const caixa = [...(fixture.nativeElement as HTMLElement).querySelectorAll('label.checkbox')]
      .find((item) => item.textContent?.trim() === rotulo)
      ?.querySelector('input');
    expect(caixa, rotulo).toBeTruthy();
    return caixa as HTMLInputElement;
  };
  const responderUnidades = async (unidades: readonly UnidadeDto[] = [ige]): Promise<void> => {
    await propagar();
    doCatalogo(UNIDADES).flush(unidades);
    await propagar();
  };

  fixture.detectChanges();
  http.expectOne((r) => r.url === LISTA).flush(itens);
  responder(doCatalogo(CURSOS), catalogos.cursos ?? [engCiv]);
  responder(doCatalogo(LOCAIS), catalogos.locais ?? [maraba]);
  await propagar();

  return {
    fixture,
    http,
    edicao,
    store,
    vinculos,
    sucessos,
    erros,
    propagar,
    elemento,
    doCatalogo,
    recarregarCom,
    preencher,
    turno,
    responderUnidades,
    /** Confere que nada ficou pendente. */
    encerrar(): void {
      http.verify();
    },
    formulario: (): HTMLFormElement => elemento('#cfg-oferta-curso-form'),
    novo: (): HTMLButtonElement => elemento('#cfg-ofertas-novo'),
    editar: (alvo: string = identificador) => pelaEtiqueta(`Editar oferta de curso ${alvo}`),
    remover: (alvo: string = identificador) => pelaEtiqueta(`Remover oferta de curso ${alvo}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-oferta-curso-form"]'),
    confirmar: (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]'),
    cancelarDaConfirmacao: (): HTMLButtonElement =>
      elemento('[data-testid="confirm-dialog-cancel"]'),
    campo: (nome: string): HTMLInputElement => elemento(seletorDoCampo(nome)),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Nova oferta de curso", responde as unidades e escolhe o mínimo para enviar. */
    async abrirCadastro(): Promise<void> {
      const novo = elemento<HTMLButtonElement>('#cfg-ofertas-novo');
      novo.focus();
      novo.click();
      await responderUnidades();
      preencher('cursoId', engCiv.id);
      preencher('localOfertaId', maraba.id);
      preencher('unidadeOfertanteOrigemId', ige.id);
      turno('Matutino').click();
      await propagar();
    },
    async abrirEdicao(alvo: string = identificador): Promise<void> {
      const botao = pelaEtiqueta(`Editar oferta de curso ${alvo}`);
      botao.focus();
      botao.click();
      await propagar();
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA) {
      const botao = elemento<HTMLButtonElement>('button[form="cfg-oferta-curso-form"]');
      botao.focus();
      botao.click();
      await propagar();
      return http.expectOne(url);
    },
    async confirmarRemocao(alvo: string = identificador, id: string = oferta.id) {
      const lixeira = pelaEtiqueta(`Remover oferta de curso ${alvo}`);
      lixeira.focus();
      lixeira.click();
      await propagar();
      elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${id}`);
    },
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
