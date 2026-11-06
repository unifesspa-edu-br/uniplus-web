import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PUBLICACOES_BASE_PATH, TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import { expect, vi } from 'vitest';
import { EdicaoDosTiposAto } from './edicao-dos-tipos-ato';
import { TiposAtoPage } from './tipos-ato.page';
import { TiposAtoStore } from './tipos-ato.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/publicacoes/tipos-ato`;
export const ESCRITA = `${BASE}/api/publicacoes/admin/tipos-ato`;
export const TITULO_DA_LISTA = '#cfg-tipos-ato-list-title';

export const preliminar: TipoAtoPublicadoDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'RESULTADO_PRELIMINAR_INSCRICAO',
  nome: 'Resultado preliminar da inscrição',
  congelaConfiguracao: true,
  unicoPorObjeto: false,
  efeitoIrreversivel: false,
  ehResultado: true,
  publicavelComoAvulso: false,
  exigeAtoCorrigido: false,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2026-08-30T12:00:00Z',
};

export const aviso: TipoAtoPublicadoDto = {
  ...preliminar,
  id: '01960000-0000-7000-0000-0000000000a2',
  codigo: 'AVISO',
  nome: 'Aviso',
  congelaConfiguracao: false,
  ehResultado: false,
  publicavelComoAvulso: true,
  vigenciaFim: '2026-06-30',
};

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDeCampo = (
  field: string,
  message: string,
  code = 'uniplus.publicacoes.tipo_ato.nome_tamanho',
) =>
  problema(422, {
    code: 'uniplus.validacao',
    errors: [{ field, code, message }],
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

/** O nome acessível que distingue as vigências de um mesmo código. */
export const identificacaoDe = (ato: TipoAtoPublicadoDto): string => {
  const [ano, mes, dia] = ato.vigenciaInicio.split('-');
  return `${ato.codigo}, vigência iniciada em ${dia}/${mes}/${ano}`;
};

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(itens: readonly TipoAtoPublicadoDto[] = [preliminar, aviso]) {
  TestBed.configureTestingModule({
    imports: [TiposAtoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
    ],
  });
  const fixture: ComponentFixture<TiposAtoPage> = TestBed.createComponent(TiposAtoPage);
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDosTiposAto);
  const store = injetor.get(TiposAtoStore);
  const notificacoes = TestBed.inject(NotificationService);
  const sucessos = vi.spyOn(notificacoes, 'success');
  const erros = vi.spyOn(notificacoes, 'errorFromProblem');
  const informacoes = vi.spyOn(notificacoes, 'info');

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
  const recarregarCom = async (lista: readonly TipoAtoPublicadoDto[]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush(lista);
    await propagar();
  };
  const preencher = (nome: string, valor: string): void => {
    const campo = elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };
  /** Marca "Sim" ou "Não" do atributo, clicando na opção como a pessoa faz. */
  const responder = (nome: string, sim: boolean): void => {
    const opcoes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      `input[type="radio"][name="${nome}"]`,
    );
    opcoes[sim ? 0 : 1].click();
  };
  const acionar = async (botao: HTMLButtonElement): Promise<void> => {
    botao.focus();
    botao.click();
    await propagar();
  };
  const dialogoDaRemocao = (): HTMLElement => elemento('cfg-confirmacao-de-remocao');

  fixture.detectChanges();
  http.expectOne((r) => r.url === LISTA).flush(itens);
  await propagar();

  return {
    fixture,
    http,
    edicao,
    store,
    sucessos,
    erros,
    informacoes,
    propagar,
    elemento,
    recarregarCom,
    preencher,
    responder,
    formulario: (): HTMLFormElement => elemento('#cfg-tipo-ato-form'),
    novo: (): HTMLButtonElement => elemento('#cfg-tipos-ato-novo'),
    editar: (a: TipoAtoPublicadoDto = preliminar) =>
      pelaEtiqueta(`Editar tipo de ato ${identificacaoDe(a)}`),
    remover: (a: TipoAtoPublicadoDto = preliminar) =>
      pelaEtiqueta(`Remover vigência do tipo de ato ${identificacaoDe(a)}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-tipo-ato-form"]'),
    confirmar: (): HTMLButtonElement =>
      dialogoDaRemocao().querySelector(
        '[data-testid="confirm-dialog-confirm"]',
      ) as HTMLButtonElement,
    cancelarDaConfirmacao: (): HTMLButtonElement =>
      dialogoDaRemocao().querySelector(
        '[data-testid="confirm-dialog-cancel"]',
      ) as HTMLButtonElement,
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Novo tipo de ato" e preenche o mínimo para enviar. */
    async abrirCadastro(): Promise<void> {
      await acionar(elemento('#cfg-tipos-ato-novo'));
      preencher('codigo', 'resultado_preliminar_inscricao');
      preencher('nome', 'Resultado preliminar da inscrição');
      preencher('vigenciaInicio', '2026-01-01');
      responder('publicavelComoAvulso', false);
      responder('exigeAtoCorrigido', false);
      await propagar();
    },
    async abrirEdicao(ato: TipoAtoPublicadoDto = preliminar): Promise<void> {
      await acionar(pelaEtiqueta(`Editar tipo de ato ${identificacaoDe(ato)}`));
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA) {
      await acionar(elemento('button[form="cfg-tipo-ato-form"]'));
      return http.expectOne((r) => r.url === url && r.method !== 'GET');
    },
    async confirmarRemocao(ato: TipoAtoPublicadoDto = preliminar) {
      await acionar(pelaEtiqueta(`Remover vigência do tipo de ato ${identificacaoDe(ato)}`));
      elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${ato.id}`);
    },
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
