import { EdicaoDosTiposProcesso } from './edicao-dos-tipos-processo';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposProcessoPage } from './tipos-processo.page';
import { TiposProcessoStore } from './tipos-processo.store';

const BASE = 'http://localhost:5000';

const tipoSeed: TipoProcessoDto = {
  id: '01960000-0000-7000-0000-000000000051',
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: 'Sistema de Seleção Unificada.',
  ativo: true,
  criadoEm: '2026-08-11T12:00:00Z',
};

const tipoInativo: TipoProcessoDto = {
  id: '01960000-0000-7000-0000-0000000000f0',
  codigo: 'VESTIBULAR_TRAD',
  nome: 'Vestibular tradicional',
  descricao: null,
  ativo: false,
  criadoEm: '2026-05-01T12:00:00Z',
};

const concedidas = signal<readonly string[]>(['configuracao:tipos-processo:manter']);

const ADMIN_LISTA = `${BASE}/api/configuracao/admin/tipos-processo`;

describe('TiposProcessoPage', () => {
  let fixture: ComponentFixture<TiposProcessoPage>;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    concedidas.set(['configuracao:tipos-processo:manter']);
    TestBed.configureTestingModule({
      imports: [TiposProcessoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: PermissoesService,
          useValue: { tem: (codigo: string) => concedidas().includes(codigo) },
        },
      ],
    });
    fixture = TestBed.createComponent(TiposProcessoPage);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly TipoProcessoDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === ADMIN_LISTA);
    expect(req.request.params.get('limit')).toBe('50');
    // Listagem de manutenção — sem restringir a ativos (default do contrato).
    expect(req.request.params.has('apenasAtivos')).toBe(false);
    req.flush(itens);
    await propagate();
  }

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([tipoSeed]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    // Sem `sr-only` a legenda vira texto visível acima da tabela e quebra o layout.
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Tipos de processo seletivo, com código, descrição e situação de uso',
    );
  });

  it('renderiza a lista de tipos de processo com a situação de cada um', async () => {
    await flushLista([tipoSeed, tipoInativo]);
    expect(fixture.debugElement.injector.get(TiposProcessoStore).tipos()).toHaveLength(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SiSU');
    expect(fixture.nativeElement.textContent).toContain('SISU');
    expect(fixture.nativeElement.textContent).toContain('Ativo');
    expect(fixture.nativeElement.textContent).toContain('Inativo');
  });

  it('filtra por código ou nome apenas na página carregada', async () => {
    await flushLista([tipoSeed, tipoInativo]);
    const store = fixture.debugElement.injector.get(TiposProcessoStore);
    store.termoBusca.set('  tradicional  ');
    expect(store.tiposFiltrados()).toEqual([tipoInativo]);
    store.termoBusca.set('sisu');
    expect(store.tiposFiltrados()).toEqual([tipoSeed]);
    store.limparFiltros();
    expect(store.tiposFiltrados()).toHaveLength(2);
  });

  it('preserva a página e seus cursores quando a navegação falha e permite tentar novamente', async () => {
    const store = fixture.debugElement.injector.get(TiposProcessoStore);
    controller
      .expectOne((r) => r.url === ADMIN_LISTA)
      .flush([tipoSeed], {
        headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' },
      });
    await propagate();
    store.proximaPagina();
    await propagate();
    const requisicao = controller.expectOne((r) => r.url === ADMIN_LISTA);
    expect(requisicao.request.params.get('cursor')).toBe('abc');
    expect(requisicao.request.params.get('direction')).toBe('next');
    expect(requisicao.request.params.has('limit')).toBe(false);
    requisicao.flush({ title: 'Falha', status: 503 }, { status: 503, statusText: 'Indisponível' });
    await propagate();
    expect(store.tipos()).toEqual([tipoSeed]);
    expect(store.proximo()).not.toBeNull();
    store.tentarNovamente();
    await propagate();
    controller
      .expectOne((r) => r.url === ADMIN_LISTA && r.params.get('cursor') === 'abc')
      .flush([tipoInativo]);
    await propagate();
    expect(store.tipos()).toEqual([tipoInativo]);
  });

  it('estado vazio convida a cadastrar só a quem pode manter', async () => {
    await flushLista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cadastre o primeiro tipo de processo');
  });

  it('estado vazio não manda cadastrar quem não pode manter', async () => {
    concedidas.set(['configuracao:tipos-processo:consultar']);
    await flushLista([]);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Nenhum tipo de processo cadastrado');
    expect(texto).not.toContain('Cadastre o primeiro');
  });

  it('sem a permissão de manter, a lista segue visível mas não oferece criar, editar nem inativar', async () => {
    concedidas.set(['configuracao:tipos-processo:consultar']);
    await flushLista([tipoSeed, tipoInativo]);
    fixture.detectChanges();
    await propagate();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('SiSU');
    const botoes = Array.from(host.querySelectorAll('button')).map((b) => b.textContent ?? '');
    expect(botoes.some((texto) => texto.includes('Novo tipo de processo'))).toBe(false);
    expect(host.querySelectorAll('td.table-responsive__actions ui-icon-button')).toHaveLength(0);
  });

  it('banner de código imutável é visível mesmo com lista vazia', async () => {
    await flushLista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Código imutável após criação');
  });

  it('CA-01: cria um tipo de processo com código, nome e descrição', async () => {
    await flushLista([]);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['abrirCadastro']();

    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['form'].setValue({
      codigo: 'ENEM',
      nome: 'ENEM',
      descricao: 'Ingresso via nota do ENEM.',
    });
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-processo`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toMatchObject({
      codigo: 'ENEM',
      nome: 'ENEM',
      descricao: 'Ingresso via nota do ENEM.',
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([tipoSeed]);
    expect(fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['formOpen']()).toBe(false);
  });

  it('CA-02: código é readonly na edição e o payload de atualização não inclui o campo codigo', async () => {
    await flushLista([tipoSeed]);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['abrirEdicao'](tipoSeed);

    expect(
      fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['form'].controls.codigo.value,
    ).toBe('SISU');
    fixture.detectChanges();
    const codigoInput = fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    fixture.debugElement.injector
      .get(EdicaoDosTiposProcesso)
      ['form'].controls.nome.setValue('Sistema de Seleção Unificada');
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['salvar']();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-processo/${tipoSeed.id}`,
    );
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('codigo');
    expect(put.request.body).toMatchObject({
      id: tipoSeed.id,
      nome: 'Sistema de Seleção Unificada',
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([tipoSeed]);
  });

  it('CA-03: código duplicado (409) é rejeitado com erro no campo sem fechar o drawer', async () => {
    await flushLista([]);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['abrirCadastro']();

    fixture.debugElement.injector
      .get(EdicaoDosTiposProcesso)
      ['form'].setValue({ codigo: 'SISU', nome: 'SiSU (dup)', descricao: '' });
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-processo`);
    post.flush(
      {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_processo.codigo_ja_existe',
        title: 'Código do tipo de processo seletivo já está reservado',
        status: 409,
        code: 'uniplus.configuracao.tipo_processo.codigo_ja_existe',
      },
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['formOpen']()).toBe(true);
    expect(fixture.nativeElement.querySelector('#cfg-tproc-codigo-erro')?.textContent).toContain(
      'já está reservado',
    );
    expect(fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['formError']()).toBeNull();
  });

  it('CA-04: inativa um tipo de processo após confirmação e recarrega a lista', async () => {
    await flushLista([tipoSeed]);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['pedirRemocao'](tipoSeed);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['removerConfirmado']();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-processo/${tipoSeed.id}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
    expect(fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['confirmOpen']()).toBe(false);
  });

  it('tipo já desativado (422) mantém o diálogo aberto com a mensagem da API', async () => {
    await flushLista([tipoSeed]);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['pedirRemocao'](tipoSeed);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['removerConfirmado']();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-processo/${tipoSeed.id}`,
    );
    req.flush(
      {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_processo.ja_desativado',
        title: 'Tipo de processo seletivo já está desativado',
        status: 422,
        code: 'uniplus.configuracao.tipo_processo.ja_desativado',
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['confirmOpen']()).toBe(true);
    expect(fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['confirmMessage']()).toContain(
      'já está desativado',
    );
  });

  it('reativa um tipo inativo após confirmação (POST .../ativacao com Idempotency-Key)', async () => {
    await flushLista([tipoInativo]);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['pedirReativacao'](tipoInativo);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['reativarConfirmado']();

    const req = controller.expectOne(`${ADMIN_LISTA}/${tipoInativo.id}/ativacao`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBeTruthy();
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([{ ...tipoInativo, ativo: true }]);
    expect(fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['confirmReativarOpen']()).toBe(
      false,
    );
  });

  it('reativação de tipo já ativo (422) mantém o diálogo com a mensagem da API', async () => {
    await flushLista([tipoInativo]);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['pedirReativacao'](tipoInativo);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['reativarConfirmado']();

    const req = controller.expectOne(`${ADMIN_LISTA}/${tipoInativo.id}/ativacao`);
    req.flush(
      {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_processo.ja_ativo',
        title: 'Tipo de processo seletivo já está ativo',
        status: 422,
        code: 'uniplus.configuracao.tipo_processo.ja_ativo',
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['confirmReativarOpen']()).toBe(
      true,
    );
    expect(
      fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['confirmReativarMessage'](),
    ).toContain('já está ativo');
  });

  it('reativação com falha 5xx mantém a mesma Idempotency-Key (retry seguro do mesmo comando)', async () => {
    await flushLista([tipoInativo]);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['pedirReativacao'](tipoInativo);
    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['reativarConfirmado']();

    const primeiraReq = controller.expectOne(`${ADMIN_LISTA}/${tipoInativo.id}/ativacao`);
    const chaveOriginal = primeiraReq.request.headers.get('Idempotency-Key');
    primeiraReq.flush(
      { title: 'Erro interno', status: 500 },
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    fixture.debugElement.injector.get(EdicaoDosTiposProcesso)['reativarConfirmado']();
    const segundaReq = controller.expectOne(`${ADMIN_LISTA}/${tipoInativo.id}/ativacao`);
    expect(segundaReq.request.headers.get('Idempotency-Key')).toBe(chaveOriginal);
    segundaReq.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([{ ...tipoInativo, ativo: true }]);
  });
  it('bloqueia operações concorrentes durante o envio e até o fim da recarga', async () => {
    await flushLista([tipoSeed]);
    const edicao = fixture.debugElement.injector.get(EdicaoDosTiposProcesso);
    edicao.pedirRemocao(tipoSeed);
    edicao.abrirCadastro();
    edicao.form.setValue({ codigo: 'ENEM', nome: 'ENEM', descricao: '' });
    edicao.salvar();
    const post = controller.expectOne((r) => r.url === ADMIN_LISTA && r.method === 'POST');
    edicao.salvar();
    edicao.removerConfirmado();
    controller.expectNone((r) => r.method === 'DELETE' || r.method === 'POST');
    edicao.alterarAbertura(false);
    expect(edicao.formOpen()).toBe(true);
    post.flush('id', { status: 201, statusText: 'Created' });
    await propagate();
    expect(edicao.gravando()).toBe(true);
    edicao.removerConfirmado();
    controller.expectNone((r) => r.method === 'DELETE');
    await flushLista([tipoSeed]);
    expect(edicao.gravando()).toBe(false);
  });

  it('mantém os campos desabilitados durante o envio e apresenta recusa de campo', async () => {
    await flushLista([]);
    const edicao = fixture.debugElement.injector.get(EdicaoDosTiposProcesso);
    edicao.abrirCadastro();
    edicao.form.setValue({ codigo: 'ENEM', nome: 'ENEM', descricao: '' });
    edicao.salvar();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[formcontrolname="nome"]:disabled')).not.toBeNull();
    expect(host.querySelector('[type="submit"]')?.getAttribute('aria-disabled')).toBe('true');
    const post = controller.expectOne((r) => r.url === ADMIN_LISTA && r.method === 'POST');
    post.flush(
      {
        type: 'https://uniplus.dev/erros/uniplus.validacao',
        title: 'Inválido',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [{ field: 'Nome', code: 'invalido', message: 'Nome recusado.' }],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();
    fixture.detectChanges();
    const nome = host.querySelector('[formcontrolname="nome"]');
    expect(nome?.getAttribute('aria-invalid')).toBe('true');
    expect(nome?.getAttribute('aria-describedby')).toBe('cfg-tproc-nome-erro');
    expect(host.querySelector('#cfg-tproc-nome-erro')?.textContent).toContain('Nome recusado.');
  });
  it('libera a trava se a recarga falha e permite nova tentativa', async () => {
    await flushLista([tipoSeed]);
    const edicao = fixture.debugElement.injector.get(EdicaoDosTiposProcesso);
    const store = fixture.debugElement.injector.get(TiposProcessoStore);
    edicao.pedirRemocao(tipoSeed);
    edicao.removerConfirmado();
    controller
      .expectOne((r) => r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    controller
      .expectOne((r) => r.url === ADMIN_LISTA)
      .flush({ title: 'Falha', status: 503 }, { status: 503, statusText: 'Indisponível' });
    await propagate();
    expect(edicao.gravando()).toBe(false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Tentar novamente');
    store.tentarNovamente();
    await propagate();
    await flushLista([]);
    expect(edicao.gravando()).toBe(false);
  });
});
