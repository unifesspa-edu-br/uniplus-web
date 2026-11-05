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
import {
  CONFIGURACAO_BASE_PATH,
  ReferenciaReservaDemograficaDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReservaDemograficaListPage } from './reserva-demografica-list.page';
import { ReservaDemograficaStore } from './reserva-demografica.store';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/referencias-reserva-demografica`;
const ADMIN_URL = `${BASE}/api/configuracao/admin/referencias-reserva-demografica`;

const CENSO_JA_EXISTE_CODE = 'uniplus.configuracao.referencia_reserva_demografica.censo_ja_existe';

const FORM_VALIDO = {
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
};

const seed: ReferenciaReservaDemograficaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('ReservaDemograficaListPage', () => {
  let fixture: ComponentFixture<ReservaDemograficaListPage>;
  let component: ReservaDemograficaListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReservaDemograficaListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(ReservaDemograficaListPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly ReferenciaReservaDemograficaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('limit')).toBe('100');
    req.flush(itens);
    await propagate();
  }

  /** Abre o drawer de cadastro, preenche com dados válidos, submete e devolve o POST. */
  function submeterCadastro(overrides: Partial<typeof FORM_VALIDO> = {}): TestRequest {
    component['abrirCadastro']();
    component['form'].setValue({ ...FORM_VALIDO, ...overrides });
    component['salvar']();
    return controller.expectOne(ADMIN_URL);
  }

  function flushProblem(req: TestRequest, code: string, title: string, status: number): void {
    req.flush(
      JSON.stringify({
        type: `https://uniplus.dev/erros/${code}`,
        title,
        status,
        code,
        traceId: 'test-trace',
      }),
      {
        status,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
  }

  function chaveDe(req: TestRequest): string | null {
    return req.request.headers.get('Idempotency-Key');
  }

  it('CA-01: renderiza a lista com Censo e percentuais formatados', async () => {
    await flushLista([seed]);
    expect(component['referenciasFiltradas']()).toHaveLength(1);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('2022');
    expect(texto).toContain('78.50');
  });

  it('CA-01: busca por Censo filtra client-side', async () => {
    await flushLista([seed, { ...seed, id: 'x2', censoReferencia: '2010' }]);
    component['busca'].set('2010');
    expect(component['referenciasFiltradas']().map((r) => r.censoReferencia)).toEqual(['2010']);
  });

  it('navega pelo cursor e recarrega a primeira página após uma alteração', async () => {
    const store = fixture.debugElement.injector.get(ReservaDemograficaStore);
    controller
      .expectOne((r) => r.url === URL)
      .flush([seed], {
        headers: { Link: '</referencias?cursor=abc&direction=next>; rel="next"' },
      });
    await propagate();
    store.proximaPagina();
    await propagate();
    const pagina = controller.expectOne((r) => r.url === URL);
    expect(pagina.request.params.get('cursor')).toBe('abc');
    expect(pagina.request.params.get('direction')).toBe('next');
    pagina.flush([{ ...seed, censoReferencia: '2010' }]);
    await propagate();
    expect(store.referencias()[0].censoReferencia).toBe('2010');
    store.recarregar();
    await propagate();
    await flushLista([seed]);
    expect(store.referencias()).toEqual([seed]);
  });

  it('envia null nos campos de texto preenchidos só com espaços', async () => {
    await flushLista([]);
    // `Validators.required` aceita espaços em branco: sem normalizar, o payload
    // levaria '' e o backend responderia sobre formato, não sobre ausência.
    const post = submeterCadastro({ censoReferencia: '  ', baseLegal: '   ' });
    expect(post.request.body).toMatchObject({ censoReferencia: null, baseLegal: null });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('CA-02: cria referência válida (POST com command)', async () => {
    await flushLista([]);
    const post = submeterCadastro();
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(FORM_VALIDO);
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([seed]);
    expect(component['formOpen']()).toBe(false);
  });

  it('CA-03: Censo duplicado marca erro no blur e bloqueia o submit', async () => {
    await flushLista([seed]);
    component['abrirCadastro']();
    component['form'].patchValue({ censoReferencia: '2022' });
    component['verificarCensoDuplicado']();

    expect(component['form'].controls.censoReferencia.hasError('duplicado')).toBe(true);
    // Mesma qualificação do title da API: o índice único é parcial, e só as ativas
    // colidem — pré-check e recusa do servidor não podem dizer coisas diferentes.
    expect(component['erroDoCampo']('censoReferencia')).toBe(
      'Já existe uma referência ativa para este Censo.',
    );
    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/referencias-reserva-demografica`);
  });

  it('CA-04: percentual fora de [0,100] é inválido; limites são aceitos', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    const ppi = component['form'].controls.ppiPercentual;
    ppi.setValue(-1);
    expect(ppi.invalid).toBe(true);
    ppi.setValue(100);
    expect(ppi.valid).toBe(true);
    ppi.setValue(0);
    expect(ppi.valid).toBe(true);
  });

  it('censo_ja_existe (409) é mapeado ao campo censoReferencia com o title do servidor', async () => {
    await flushLista([]);
    const post = submeterCadastro();
    flushProblem(post, CENSO_JA_EXISTE_CODE, 'Já existe uma referência ativa para este Censo', 409);
    await propagate();

    expect(component['formOpen']()).toBe(true);
    // O title distingue 'ativa' de 'cadastrada': o índice único é parcial, e uma
    // referência removida com o mesmo Censo não conflita — quem lê precisa saber
    // que o caminho é reativar a linha existente, não procurar na lista.
    expect(component['form'].controls.censoReferencia.errors?.['backend']).toMatchObject({
      code: CENSO_JA_EXISTE_CODE,
      message: 'Já existe uma referência ativa para este Censo',
    });
    expect(component['formError']()).toBeNull();
  });

  it('outro 409 (processing_conflict) não hijacka censoReferencia e preserva o title do servidor', async () => {
    await flushLista([]);
    const post = submeterCadastro();
    flushProblem(
      post,
      'uniplus.idempotency.processing_conflict',
      'Requisição original ainda está em processamento',
      409,
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['form'].controls.censoReferencia.errors).toBeNull();
    expect(component['formError']()).toBe('Requisição original ainda está em processamento');
  });

  it('processing_conflict mantém a mesma Idempotency-Key no reenvio', async () => {
    await flushLista([]);
    const post = submeterCadastro();
    const chaveInicial = chaveDe(post);
    flushProblem(
      post,
      'uniplus.idempotency.processing_conflict',
      'Requisição original ainda está em processamento',
      409,
    );
    await propagate();

    // O contrato de processing_conflict pede retry do MESMO comando com a MESMA
    // chave: rotacionar aqui criaria uma segunda reserva para o mesmo envio.
    component['salvar']();
    const retry = controller.expectOne(ADMIN_URL);
    expect(chaveDe(retry)).toBe(chaveInicial);
    retry.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('409 que não é de idempotência rotaciona a Idempotency-Key antes do reenvio', async () => {
    await flushLista([]);
    const post = submeterCadastro();
    const chaveInicial = chaveDe(post);
    flushProblem(post, 'uniplus.concorrencia.conflito', 'Conflito de concorrência', 409);
    await propagate();

    expect(component['formError']()).toBe('Conflito de concorrência');

    // A entrada de idempotência dessa chave ficou em `Processing` até o TTL de 24h:
    // reenviar com ela devolveria processing_conflict indefinidamente.
    component['salvar']();
    const retry = controller.expectOne(ADMIN_URL);
    expect(chaveDe(retry)).not.toBe(chaveInicial);
    retry.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('censo_ja_existe na edição vai para o alerta, não para o campo desabilitado', async () => {
    await flushLista([seed]);
    component['abrirEdicao'](seed);
    component['form'].patchValue({ ppiPercentual: 80 });
    component['salvar']();

    const put = controller.expectOne(`${ADMIN_URL}/${seed.id}`);
    flushProblem(put, CENSO_JA_EXISTE_CODE, 'Já existe uma referência ativa para este Censo', 409);
    await propagate();

    // `censoReferencia` está disabled na edição: um controle DISABLED não fica
    // INVALID, então o erro ancorado nele não bloquearia o submit seguinte nem
    // poderia ser corrigido pelo operador.
    expect(component['form'].controls.censoReferencia.errors).toBeNull();
    expect(component['form'].invalid).toBe(false);
    expect(component['formError']()).toBe('Já existe uma referência ativa para este Censo');
  });

  it('CA-06: na edição, censoReferencia fica disabled', async () => {
    await flushLista([seed]);
    component['abrirEdicao'](seed);
    expect(component['form'].controls.censoReferencia.disabled).toBe(true);
    expect(component['form'].controls.ppiPercentual.disabled).toBe(false);
  });

  it('CA-07: remover faz soft-delete (DELETE) e recarrega', async () => {
    await flushLista([seed]);
    component['pedirRemocao'](seed);
    component['removerConfirmado']();
    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/referencias-reserva-demografica/${seed.id}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([seed]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.trim()).toBe(
      'Reservas demográficas por censo, com percentuais de PPI, quilombola e PcD e respectiva base legal.',
    );
  });

  it('ação de remoção possui ícone, tooltip e nome acessível', async () => {
    await flushLista([seed]);
    fixture.detectChanges();

    const botao = fixture.nativeElement.querySelector(
      'button[aria-label="Remover reserva demográfica do censo 2022"]',
    );

    expect(botao).not.toBeNull();
    expect(botao?.querySelector('i')?.classList.contains('pi-trash')).toBe(true);
    expect(botao?.getAttribute('data-tooltip')).toBe('Remover reserva demográfica');
    expect(botao?.getAttribute('aria-label')).toBe('Remover reserva demográfica do censo 2022');
  });

  it('não exibe ação de Inativar', async () => {
    await flushLista([seed]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;

    expect(texto).not.toContain('Inativar');
    expect(texto).not.toContain('inativar');
  });

  it('CA-13: erro na remoção mantém o registro na tabela', async () => {
    await flushLista([seed]);

    component['pedirRemocao'](seed);
    component['removerConfirmado']();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/referencias-reserva-demografica/${seed.id}`,
    );

    flushProblem(
      req,
      'uniplus.configuracao.referencia_reserva_demografica.remocao_falhou',
      'Não foi possível remover a referência',
      409,
    );

    await propagate();

    expect(component['saving']()).toBe(false);
    expect(component['referencias']()).toEqual([seed]);
  });

  it('mantém a recusa de remoção anunciada dentro do diálogo', async () => {
    await flushLista([seed]);
    component['pedirRemocao'](seed);
    fixture.detectChanges();
    component['removerConfirmado']();
    fixture.detectChanges();
    const dialogo = fixture.nativeElement.querySelector('ui-dialog dialog') as HTMLDialogElement;
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain('Removendo');
    flushProblem(
      controller.expectOne(`${ADMIN_URL}/${seed.id}`),
      'uniplus.configuracao.referencia_reserva_demografica.remocao_falhou',
      'Não foi possível remover a referência',
      409,
    );
    await propagate();
    expect(component['confirmOpen']()).toBe(true);
    expect(dialogo.textContent).toContain('Não foi possível remover a referência');
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain(
      'Não foi possível remover',
    );
  });

  it('não permite duas remoções simultâneas', async () => {
    await flushLista([seed]);

    component['pedirRemocao'](seed);
    component['removerConfirmado']();

    const primeira = controller.expectOne(
      `${BASE}/api/configuracao/admin/referencias-reserva-demografica/${seed.id}`,
    );

    expect(component['saving']()).toBe(true);

    component['removerConfirmado']();

    controller.expectNone(
      `${BASE}/api/configuracao/admin/referencias-reserva-demografica/${seed.id}`,
    );

    primeira.flush(null, { status: 204, statusText: 'No Content' });

    await propagate();
    await flushLista([]);
  });

  it('CA-06/CA-07: diálogo de remoção identifica a Reserva demográfica', async () => {
    await flushLista([seed]);

    component['pedirRemocao'](seed);

    expect(component['confirmOpen']()).toBe(true);
    expect(component['mensagemRemocao']()).toContain(
      'Deseja remover a referência demográfica do Censo 2022?',
    );
    expect(component['mensagemRemocao']()).not.toContain('Inativar');
  });

  it('CA-09/CA-10: remove a coluna Status e preserva as demais colunas', async () => {
    await flushLista([seed]);
    fixture.detectChanges();
    const cabecalhos = Array.from(
      fixture.nativeElement.querySelectorAll('thead th') as NodeListOf<HTMLElement>,
    ).map((th) => th.textContent?.trim());
    expect(cabecalhos).toEqual(['Censo', 'PPI %', 'Quilombola %', 'PcD %', 'Base legal', 'Ações']);
  });
  it('bloqueia o formulário durante o envio e mantém a trava até chegar a recarga', async () => {
    await flushLista([]);
    const post = submeterCadastro();
    fixture.detectChanges();
    const campos = fixture.nativeElement.querySelector(
      '#cfg-reserva-form fieldset',
    ) as HTMLFieldSetElement;
    const salvar = fixture.nativeElement.querySelector(
      'button[form="cfg-reserva-form"]',
    ) as HTMLButtonElement;
    expect(campos.disabled).toBe(true);
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    component['edicao'].fechar();
    component['salvar']();
    expect(component['formOpen']()).toBe(true);
    controller.expectNone(ADMIN_URL);
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    expect(component['edicao'].gravando()).toBe(true);
    component['abrirCadastro']();
    expect(component['formOpen']()).toBe(false);
    await flushLista([seed]);
    expect(component['edicao'].gravando()).toBe(false);
  });

  it('foca o primeiro campo inválido e associa a mensagem ao controle', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();
    component['salvar']();
    await propagate();
    const campo = fixture.nativeElement.querySelector(
      '[formControlName="censoReferencia"]',
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(campo);
    expect(campo.getAttribute('aria-describedby')).toBe('erro-censoReferencia');
    controller.expectNone(ADMIN_URL);
  });

  it('bloqueia novas ações durante a recarga após remover', async () => {
    await flushLista([seed]);
    component['pedirRemocao'](seed);
    component['removerConfirmado']();
    controller
      .expectOne(`${ADMIN_URL}/${seed.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    expect(component['edicao'].gravando()).toBe(true);
    component['abrirEdicao'](seed);
    component['pedirRemocao'](seed);
    component['removerConfirmado']();
    expect(component['formOpen']()).toBe(false);
    controller.expectNone(`${ADMIN_URL}/${seed.id}`);
    await flushLista([]);
    expect(component['edicao'].gravando()).toBe(false);
  });
  it('mostra a recusa por campo e leva o foco ao campo recusado', async () => {
    await flushLista([]);
    const post = submeterCadastro();
    await propagate();
    post.flush(
      JSON.stringify({
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'PpiPercentual',
            code: 'uniplus.percentual.invalido',
            message: 'Percentual recusado.',
          },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    const campo = fixture.nativeElement.querySelector(
      '[formControlName="ppiPercentual"]',
    ) as HTMLInputElement;
    expect(component['erroDoCampo']('ppiPercentual')).toBe('Percentual recusado.');
    expect(document.activeElement).toBe(campo);
    expect(campo.getAttribute('aria-describedby')).toBe('erro-ppiPercentual');
  });
  it('libera as ações após falha de recarga e permite tentar novamente', async () => {
    await flushLista([]);
    const post = submeterCadastro();
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    controller.expectOne((r) => r.url === URL).flush('Falha', { status: 500, statusText: 'Erro' });
    await propagate();
    expect(component['edicao'].gravando()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Tentar novamente');
    component['tentarNovamente']();
    await propagate();
    await flushLista([seed]);
    expect(component['edicao'].gravando()).toBe(false);
  });
});
