import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { type Observable, Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiResult, apiFailure, apiOk, apiResultInterceptor } from '@uniplus/shared-core/http';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import {
  type InscricaoDto,
  SELECAO_BASE_PATH,
  SituacaoInscricao,
} from '@uniplus/shared-data/selecao';
import {
  BUSCA_DE_CEP,
  BUSCA_DE_MUNICIPIOS,
  LEITURA_DE_MUNICIPIO_POR_CODIGO,
} from '@uniplus/shared-ui/components';

import { EnvioDeDocumentosDaInscricao } from './envio-de-documentos-da-inscricao';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.mock';
import { InscricaoDoCandidatoPage } from './inscricao-do-candidato.page';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';

/** Fernanda Drumond, persona fictícia do portal de documentação. */
const CPF_DA_CONTA = '69959836371';
const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';

const RASCUNHO: InscricaoDto = {
  id: 'inscricao-1',
  processoSeletivoId: PROCESSO,
  situacao: SituacaoInscricao.rascunho,
  numeroInscricao: null,
  versaoFormularioId: 'versao-1',
  ofertaCursoId: null,
  ofertaCursoSegundaOpcaoId: null,
  numeroDeOpcoesDeCurso: 1,
  ofertas: [],
  respostas: {},
  derivados: {},
  grupos: {},
  aceites: [],
  eTag: '"inscricao-1:1"',
  avaliacao: {
    modalidades: { derivada: false, situacao: null, itens: [], pendencias: [] },
    documentos: { fases: [] },
  },
};

const INDISPONIVEL = apiFailure(
  { type: 'about:blank', title: 'Serviço indisponível', status: 503, code: 'falha', traceId: '' },
  503,
  new HttpHeaders(),
);

describe('InscricaoDoCandidatoPage: nova tentativa da leitura', () => {
  const iniciar = vi.fn<() => Observable<ApiResult<InscricaoDto>>>();
  const salvar = vi.fn<() => Observable<ApiResult<InscricaoDto>>>();
  let fixture: ComponentFixture<InscricaoDoCandidatoPage>;

  const tela = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const tentar = (): HTMLButtonElement =>
    [...tela().querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Tentar novamente',
    ) as HTMLButtonElement;
  const situacao = (): string =>
    tela().querySelector('ui-situacao-da-nova-tentativa')?.textContent ?? '';
  const macrotarefa = (): Promise<void> => new Promise((resolver) => setTimeout(resolver));
  const atualizar = async (): Promise<void> => {
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  };

  beforeEach(() => {
    iniciar.mockReset();
    salvar.mockReset();
    TestBed.configureTestingModule({
      imports: [InscricaoDoCandidatoPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: 'http://api.teste' },
        { provide: InscricaoDoCandidatoService, useValue: { iniciar, salvar } },
        {
          provide: EnvioDeDocumentosDaInscricao,
          useValue: {
            paraOProcesso: () => ({
              arquivos: signal([]),
              mudancas: signal(0),
              ocupado: signal(false),
              enviar: vi.fn(),
              remover: vi.fn(),
            }),
          },
        },
        { provide: UserContextService, useValue: { user: signal({ cpf: CPF_DA_CONTA }) } },
        { provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) },
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) },
        { provide: LEITURA_DE_MUNICIPIO_POR_CODIGO, useValue: vi.fn() },
        { provide: RELOGIO, useValue: () => new Date('2026-12-11T13:30:00Z') },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function abrirComFalhaAoIniciar(): Promise<void> {
    iniciar.mockReturnValueOnce(of(INDISPONIVEL));
    fixture = TestBed.createComponent(InscricaoDoCandidatoPage);
    fixture.componentRef.setInput('processoId', PROCESSO);
    await atualizar();
  }

  const http = (): HttpTestingController => TestBed.inject(HttpTestingController);
  const formulario = () => http().expectOne((r) => r.url.endsWith('/inscricao/formulario'));
  const recusaDoFormulario = (): void =>
    formulario().flush(
      JSON.stringify({ title: 'Erro', status: 500, code: 'uniplus.infra.erro_interno' }),
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

  async function abrirComSucesso(): Promise<void> {
    iniciar.mockReturnValueOnce(of(apiOk(RASCUNHO, 200, new HttpHeaders())));
    fixture = TestBed.createComponent(InscricaoDoCandidatoPage);
    fixture.componentRef.setInput('processoId', PROCESSO);
    await atualizar();
    formulario().flush(FORMULARIO_DE_INSCRICAO_MOCK);
    await atualizar();
  }

  it('a falha ao iniciar a inscrição oferece "Tentar novamente"', async () => {
    await abrirComFalhaAoIniciar();

    expect(tela().querySelector('.alert__title')?.textContent).toContain(
      'Não foi possível abrir a inscrição',
    );
    expect(tentar()).toBeTruthy();
  });

  it('com a nova tentativa em curso, o botão não usa disabled, mantém o foco e o aviso segue na tela', async () => {
    await abrirComFalhaAoIniciar();
    iniciar.mockReturnValueOnce(new Subject<ApiResult<InscricaoDto>>());
    tentar().focus();

    tentar().click();
    await atualizar();

    expect(iniciar).toHaveBeenCalledTimes(2);
    expect(tentar().disabled).toBe(false);
    expect(tentar().getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(tentar());
    expect(situacao()).toBe('Tentando novamente…');
    expect(tela().querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it('a nova tentativa que falha de novo diz que também falhou, com o aviso e o foco no lugar', async () => {
    await abrirComFalhaAoIniciar();
    iniciar.mockReturnValueOnce(of(INDISPONIVEL));
    tentar().focus();

    tentar().click();
    await atualizar();
    await macrotarefa();
    await atualizar();

    expect(situacao()).toBe('A nova tentativa também falhou.');
    expect(document.activeElement).toBe(tentar());
  });

  it('a nova tentativa que dá certo abre o formulário e leva o foco ao título', async () => {
    await abrirComFalhaAoIniciar();
    iniciar.mockReturnValueOnce(of(apiOk(RASCUNHO, 200, new HttpHeaders())));
    tentar().focus();

    tentar().click();
    await atualizar();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/inscricao/formulario'))
      .flush(FORMULARIO_DE_INSCRICAO_MOCK);
    await atualizar();
    await macrotarefa();
    await atualizar();

    expect(tela().querySelector('.alert__title')).toBeNull();
    expect(tela().querySelector('ui-formulario-do-candidato')).not.toBeNull();
    expect(document.activeElement).toBe(tela().querySelector('h1'));
  });

  it('a falha do GET do formulário vale a mesma nova tentativa, que ao dar certo tira o aviso e leva o foco ao título', async () => {
    iniciar.mockReturnValue(of(apiOk(RASCUNHO, 200, new HttpHeaders())));
    fixture = TestBed.createComponent(InscricaoDoCandidatoPage);
    fixture.componentRef.setInput('processoId', PROCESSO);
    await atualizar();
    recusaDoFormulario();
    await atualizar();
    expect(tela().querySelector('.alert__title')?.textContent).toContain(
      'Não foi possível abrir a inscrição',
    );
    tentar().focus();

    tentar().click();
    await atualizar();
    expect(iniciar).toHaveBeenCalledTimes(2);
    expect(situacao()).toBe('Tentando novamente…');
    formulario().flush(FORMULARIO_DE_INSCRICAO_MOCK);
    await atualizar();
    await macrotarefa();
    await atualizar();

    expect(tela().querySelector('.alert__title')).toBeNull();
    expect(tela().querySelector('ui-formulario-do-candidato')).not.toBeNull();
    expect(document.activeElement).toBe(tela().querySelector('h1'));
  });

  it('o conflito cuja releitura falha mostra o aviso de leitura, sem dizer que a inscrição foi atualizada', async () => {
    await abrirComSucesso();
    salvar.mockReturnValue(
      of(
        apiFailure(
          {
            type: 'about:blank',
            title: 'Conflito',
            status: 412,
            code: 'uniplus.selecao.inscricao.precondicao_falhou',
            traceId: '',
          },
          412,
          new HttpHeaders(),
        ),
      ),
    );
    iniciar.mockReturnValueOnce(of(INDISPONIVEL));

    [...tela().querySelectorAll('button')]
      .find((b) => b.textContent?.trim().startsWith('Salvar rascunho'))
      ?.click();
    await atualizar();

    expect(tela().querySelector('.alert__title')?.textContent).toContain(
      'Não foi possível abrir a inscrição',
    );
    expect(tela().textContent).not.toContain('A inscrição foi atualizada');
    expect(tela().querySelector('ui-formulario-do-candidato')).toBeNull();
  });
});
