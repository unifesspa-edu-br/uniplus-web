import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { idempotencyKey } from '@uniplus/shared-core/idempotency';
import { CONFIGURACAO_BASE_PATH, ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDosModelosFormulario } from './edicao-dos-modelos-formulario';
import { ModelosFormularioPage } from './modelos-formulario.page';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/admin/modelos-formulario`;
const modelo: ModeloFormularioView = {
  id: 'modelo-1',
  codigo: 'INSCRICAO',
  nome: 'Inscrição',
  descricao: null,
  finalidade: 'INSCRICAO',
  tipoProcessoCodigo: null,
  ativo: true,
  conteudo: {
    titulo: 'Inscrição',
    etapas: [],
    itens: [],
    termos: [],
    pressupostos: [],
    grupos: [],
    documentosExigidos: [],
  },
};

const PROBLEMA = { 'content-type': 'application/problem+json' };

function problema(status: number, code: string, title: string, errors?: unknown[]): string {
  return JSON.stringify({ type: 'about:blank', title, status, code, errors });
}

describe('ModelosFormularioPage — escritas pela interface', () => {
  let fixture: ComponentFixture<ModelosFormularioPage>;
  let edicao: EdicaoDosModelosFormulario;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ModelosFormularioPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PermissoesService, useValue: { tem: () => true } },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(ModelosFormularioPage);
    edicao = fixture.debugElement.injector.get(EdicaoDosModelosFormulario);
    controller = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });
  afterEach(() => {
    controller.verify();
    vi.restoreAllMocks();
  });

  /** A primeira leitura da lista e dos tipos de processo; `falha` devolve 500 na lista. */
  async function carregar(falha = false, tipos: readonly object[] = []): Promise<void> {
    const lista = controller.expectOne((r) => r.url === URL);
    if (falha) {
      lista.flush(problema(500, 'uniplus.erro_interno', 'Erro interno'), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: PROBLEMA,
      });
    } else {
      lista.flush([modelo, { ...modelo, id: 'modelo-2', codigo: 'INATIVO', ativo: false }], {
        headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' },
      });
    }
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`).flush(tipos);
    await propagar();
  }

  async function propagar(): Promise<void> {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  }
  function elemento<T extends HTMLElement>(seletor: string): T {
    const el = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(el, seletor).not.toBeNull();
    return el as T;
  }
  async function preencher(): Promise<void> {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    nome.value = 'Inscrição';
    nome.dispatchEvent(new Event('input'));
    const finalidade = elemento<HTMLSelectElement>('select[formcontrolname="finalidade"]');
    finalidade.value = 'INSCRICAO';
    finalidade.dispatchEvent(new Event('change'));
  }
  const salvar = (): HTMLButtonElement => elemento('button[form="cfg-modelo-criacao"]');
  const enviar = (): void => {
    elemento<HTMLFormElement>('#cfg-modelo-criacao').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
  };
  function recusar(): void {
    controller.expectOne(URL).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.modelo_formulario.invalido',
            message: 'Nome recusado.',
          },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
  }

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    await carregar();
    await preencher();
    for (const campo of ['nome', 'codigo', 'finalidade']) {
      expect(
        elemento<HTMLElement>(`[formcontrolname="${campo}"]`).getAttribute('aria-required'),
      ).toBe('true');
    }
  });

  it('mantém os campos somente leitura, o foco e o drawer aberto enquanto cria', async () => {
    await carregar();
    await preencher();
    const botao = salvar();
    botao.focus();
    enviar();
    const post = controller.expectOne(URL);
    await propagar();
    expect(elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(true);
    expect(elemento<HTMLInputElement>('input[formcontrolname="nome"]').matches(':disabled')).toBe(
      true,
    );
    expect(edicao.form.controls.nome.value).toBe('Inscrição');
    expect(edicao.form.controls.nome.enabled).toBe(true);
    expect(edicao.salvando()).toBe(true);
    expect(
      elemento('dialog[aria-label="Novo modelo de formulário"] [role="status"]').textContent,
    ).toContain('Criando o modelo.');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.textContent).toContain('Criando...');
    expect(document.activeElement).toBe(botao);
    expect(elemento<HTMLButtonElement>('.form-drawer__footer button[type="button"]').disabled).toBe(
      true,
    );
    const dialog = elemento<HTMLDialogElement>('dialog[aria-label="Novo modelo de formulário"]');
    expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    edicao.fechar(false);
    await propagar();
    expect(edicao.drawerAberto()).toBe(true);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.drawerAberto()).toBe(false);
  });

  it('recusa clique e submit adicionais enquanto cria', async () => {
    await carregar();
    const criar = vi.spyOn(edicao, 'criar');
    await preencher();
    enviar();
    const post = controller.expectOne(URL);
    await propagar();
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    salvar().dispatchEvent(clique);
    expect(clique.defaultPrevented).toBe(true);
    elemento<HTMLFormElement>('#cfg-modelo-criacao').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(criar).toHaveBeenCalledTimes(1);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
  });

  it('mostra a recusa do servidor e leva o foco ao campo recusado', async () => {
    await carregar();
    await preencher();
    enviar();
    await propagar();
    recusar();
    await propagar();
    await propagar();
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(nome.closest('label')?.querySelector('.field__error')?.textContent?.trim()).toBe(
      'Nome recusado.',
    );
    expect(document.activeElement).toBe(nome);
    expect(elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(false);
    expect(
      elemento('dialog[aria-label="Novo modelo de formulário"] [role="status"]').textContent,
    ).toContain('Revise os campos indicados.');
  });

  it('bloqueia criação e troca de situação concorrentes em ambos os sentidos', async () => {
    await carregar();
    await preencher();
    edicao.criar();
    edicao.criar();
    edicao.desativar(modelo);
    controller.expectNone(`${URL}/${modelo.id}`);
    recusar();
    await propagar();
    edicao.desativar(modelo);
    edicao.ativar(modelo);
    edicao.criar();
    controller.expectNone(URL);
    controller.expectNone(`${URL}/${modelo.id}/ativacao`);
    controller
      .expectOne(`${URL}/${modelo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne((r) => r.url === URL).flush([modelo]);
  });

  it('não abre a criação enquanto uma troca de situação está pendente', async () => {
    await carregar();
    edicao.desativar(modelo);
    const requisicao = controller.expectOne(`${URL}/${modelo.id}`);

    edicao.abrirCriacao();

    expect(edicao.drawerAberto()).toBe(false);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne((r) => r.url === URL).flush([modelo]);
  });

  it.each([true, false])(
    'bloqueia a lista e indica a troca de situação (ativo: %s)',
    async (ativo) => {
      await carregar();
      const codigo = ativo ? 'INSCRICAO' : 'INATIVO';
      const id = ativo ? modelo.id : 'modelo-2';
      elemento<HTMLButtonElement>(
        `[aria-label="${ativo ? 'Desativar' : 'Ativar'} o modelo ${codigo}"]`,
      ).click();
      const requisicao = controller.expectOne(ativo ? `${URL}/${id}` : `${URL}/${id}/ativacao`);
      await propagar();
      expect(elemento('tbody').textContent).toContain(ativo ? 'Desativando...' : 'Ativando...');
      expect(edicao.gravando()).toBe(true);
      expect(edicao.salvando()).toBe(false);
      const editar = elemento<HTMLAnchorElement>(`[aria-label="Editar o modelo ${codigo}"]`);
      expect(editar.getAttribute('aria-disabled')).toBe('true');
      expect(editar.getAttribute('href')).toBeNull();
      expect(
        editar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
      ).toBe(false);
      const novo = elemento<HTMLButtonElement>('.panel-head .btn--primary');
      expect(novo.getAttribute('aria-disabled')).toBe('true');
      novo.click();
      expect(edicao.drawerAberto()).toBe(false);
      expect(elemento<HTMLInputElement>('input[type="search"]').matches(':disabled')).toBe(true);
      expect(elemento<HTMLButtonElement>('.filter-bar__alternar').matches(':disabled')).toBe(true);
      expect(elemento<HTMLSelectElement>('.filter-bar select').matches(':disabled')).toBe(true);
      const proximo = elemento<HTMLButtonElement>('ui-pager [data-pager="next"]');
      expect(proximo.getAttribute('aria-disabled')).toBe('true');
      proximo.click();
      controller.expectNone((r) => r.url === URL);
      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await propagar();
      controller.expectOne((r) => r.url === URL).flush([modelo]);
    },
  );

  it('anuncia o início e o fim da troca de situação em uma região de status', async () => {
    await carregar();
    edicao.desativar(modelo);
    const requisicao = controller.expectOne(`${URL}/${modelo.id}`);
    await propagar();
    const status = elemento<HTMLElement>('[role="status"]');
    expect(status.textContent).toContain('Desativando o modelo INSCRICAO.');
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne((r) => r.url === URL).flush([modelo]);
    await propagar();
    expect(status.textContent).toContain('Modelo desativado: INSCRICAO.');
  });

  it('mantém as ações da lista indisponíveis até a lista recarregada chegar', async () => {
    await carregar();
    const desativar = (): HTMLButtonElement =>
      elemento('[aria-label="Desativar o modelo INSCRICAO"]');
    desativar().click();
    controller
      .expectOne(`${URL}/${modelo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    const recarga = controller.expectOne((r) => r.url === URL);
    await propagar();
    expect(desativar().disabled).toBe(true);
    desativar().click();
    controller.expectNone(`${URL}/${modelo.id}`);
    recarga.flush([{ ...modelo, ativo: false }]);
    await propagar();
  });

  const nomeDoCampo = (): HTMLInputElement => elemento('input[formcontrolname="nome"]');

  async function editarNome(valor: string): Promise<void> {
    nomeDoCampo().value = valor;
    nomeDoCampo().dispatchEvent(new Event('input'));
    await propagar();
  }

  it('Enter num campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async () => {
    await carregar();
    await preencher();
    nomeDoCampo().focus();
    enviar();
    const post = controller.expectOne(URL);
    await propagar();
    expect(document.activeElement).toBe(salvar());

    post.flush(problema(500, 'uniplus.erro_interno', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: PROBLEMA,
    });
    await propagar();
    await propagar();

    expect(elemento('ui-alert[variant="danger"]').textContent).toContain('Erro interno');
    expect(nomeDoCampo().matches(':disabled')).toBe(false);
    expect(document.activeElement).toBe(salvar());
    enviar();
    controller.expectOne(URL);
  });

  it('o envio barrado localmente leva o foco ao primeiro campo inválido, sem requisição', async () => {
    await carregar();
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    salvar().focus();

    enviar();
    await propagar();
    await propagar();

    controller.expectNone(URL);
    expect(nomeDoCampo().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(nomeDoCampo());
  });

  it('só o código de duplicidade marca o campo do código e renova a chave', async () => {
    await carregar();
    await preencher();
    const criar = vi.spyOn(idempotencyKey, 'create');
    enviar();
    await propagar();

    controller
      .expectOne(URL)
      .flush(
        problema(
          409,
          'uniplus.configuracao.modelo_formulario.codigo_ja_existe',
          'Já existe um modelo com este código.',
        ),
        { status: 409, statusText: 'Conflict', headers: PROBLEMA },
      );
    await propagar();
    await propagar();

    const codigo = elemento<HTMLInputElement>('input[formcontrolname="codigo"]');
    expect(codigo.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(codigo);
    expect(codigo.closest('label')?.querySelector('.field__error')?.textContent).toContain(
      'Já existe um modelo com este código.',
    );
    expect(document.querySelector('ui-alert[variant="danger"]')).toBeNull();
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it('o conflito de processamento mantém a chave e mostra a mensagem no alerta, sem marcar campo', async () => {
    await carregar();
    await preencher();
    const criar = vi.spyOn(idempotencyKey, 'create');
    enviar();
    await propagar();

    controller
      .expectOne(URL)
      .flush(
        problema(
          409,
          'uniplus.idempotency.processing_conflict',
          'A operação anterior ainda está em andamento.',
        ),
        { status: 409, statusText: 'Conflict', headers: PROBLEMA },
      );
    await propagar();

    expect(elemento('ui-alert[variant="danger"]').textContent).toContain(
      'A operação anterior ainda está em andamento.',
    );
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
    expect(criar).not.toHaveBeenCalled();
  });

  it('a recusa de campo renova a chave, e a recusa sem campo conhecido vai ao alerta', async () => {
    await carregar();
    await preencher();
    const criar = vi.spyOn(idempotencyKey, 'create');
    enviar();
    await propagar();
    recusar();
    await propagar();
    expect(criar).toHaveBeenCalledTimes(1);

    await editarNome('Inscrição revisada');
    enviar();
    await propagar();
    controller
      .expectOne(URL)
      .flush(
        problema(422, 'uniplus.validacao', 'Dados inválidos', [
          { field: 'Conteudo.Itens[0].Nome', code: 'x', message: 'Item recusado.' },
        ]),
        { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEMA },
      );
    await propagar();

    expect(elemento('ui-alert[variant="danger"]').textContent).toContain('Dados inválidos');
  });

  it('o campo desabilitado por regra de negócio segue assim depois do sucesso e da recusa', async () => {
    await carregar();
    await preencher();
    edicao.form.controls.tipoProcessoCodigo.disable();
    enviar();
    await propagar();
    recusar();
    await propagar();
    const tipo = (): HTMLSelectElement => elemento('select[formcontrolname="tipoProcessoCodigo"]');
    expect(tipo().matches(':disabled')).toBe(true);
    expect(edicao.form.controls.tipoProcessoCodigo.disabled).toBe(true);

    await editarNome('Inscrição revisada');
    enviar();
    await propagar();
    controller.expectOne(URL).flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();

    expect(edicao.form.controls.tipoProcessoCodigo.disabled).toBe(true);
  });

  it('a troca de situação recusada anuncia a falha, libera a linha e devolve o foco ao botão', async () => {
    await carregar();
    const desativar = (): HTMLButtonElement =>
      elemento('[aria-label="Desativar o modelo INSCRICAO"]');
    desativar().focus();
    desativar().click();
    const requisicao = controller.expectOne(`${URL}/${modelo.id}`);
    await propagar();
    expect(desativar().disabled).toBe(true);
    (document.activeElement as HTMLElement).blur();

    requisicao.flush(problema(500, 'uniplus.erro_interno', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: PROBLEMA,
    });
    await propagar();
    await propagar();

    expect(elemento('[role="status"]').textContent).toContain(
      'Não foi possível alterar a situação do modelo INSCRICAO.',
    );
    expect(elemento('tbody').textContent).not.toContain('Desativando...');
    expect(desativar().disabled).toBe(false);
    expect(document.activeElement).toBe(desativar());
  });

  it('a troca concluída devolve o foco ao botão da linha quando a lista recarregada a traz', async () => {
    await carregar();
    elemento<HTMLButtonElement>('[aria-label="Desativar o modelo INSCRICAO"]').click();
    controller
      .expectOne(`${URL}/${modelo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    (document.activeElement as HTMLElement).blur();
    const recarga = controller.expectOne((r) => r.url === URL);
    await propagar();
    expect(document.activeElement).toBe(document.body);

    recarga.flush([{ ...modelo, ativo: false }]);
    await propagar();
    await propagar();

    expect(document.activeElement).toBe(elemento('[aria-label="Ativar o modelo INSCRICAO"]'));
  });

  it('a troca concluída, com a linha ausente da recarga, leva o foco ao título da lista', async () => {
    await carregar();
    elemento<HTMLButtonElement>('[aria-label="Desativar o modelo INSCRICAO"]').click();
    controller
      .expectOne(`${URL}/${modelo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    (document.activeElement as HTMLElement).blur();

    controller.expectOne((r) => r.url === URL).flush([]);
    await propagar();
    await propagar();

    expect(document.activeElement).toBe(elemento('#cfg-modelos-list-title'));
  });

  it('a troca concluída, com falha na recarga, leva o foco ao título da lista', async () => {
    await carregar();
    elemento<HTMLButtonElement>('[aria-label="Ativar o modelo INATIVO"]').click();
    controller
      .expectOne(`${URL}/modelo-2/ativacao`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    (document.activeElement as HTMLElement).blur();

    controller
      .expectOne((r) => r.url === URL)
      .flush(problema(500, 'uniplus.erro_interno', 'Erro interno'), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: PROBLEMA,
      });
    await propagar();
    await propagar();

    expect(document.activeElement).toBe(elemento('#cfg-modelos-list-title'));
  });

  it('não toma o foco de quem o levou a outro lugar durante a recarga', async () => {
    await carregar();
    elemento<HTMLButtonElement>('[aria-label="Desativar o modelo INSCRICAO"]').click();
    controller
      .expectOne(`${URL}/${modelo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    const recarga = controller.expectOne((r) => r.url === URL);
    const outro = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    outro.focus();

    recarga.flush([{ ...modelo, ativo: false }]);
    await propagar();
    await propagar();

    expect(document.activeElement).toBe(outro);
  });

  it('filtrar durante a carga cancela a leitura pendente, mantém o foco no filtro e mostra só a resposta nova', async () => {
    await carregar(false, [{ codigo: 'GRADUACAO', nome: 'Graduação' }]);
    const tipo = elemento<HTMLSelectElement>('.filter-bar select');
    tipo.focus();
    elemento<HTMLButtonElement>('ui-pager [data-pager="next"]').click();
    await propagar();
    const pendente = controller.expectOne((r) => r.url === URL && r.params.has('cursor'));

    tipo.value = 'GRADUACAO';
    tipo.dispatchEvent(new Event('change'));
    await propagar();

    expect(pendente.cancelled).toBe(true);
    const nova = controller.expectOne(
      (r) => r.url === URL && r.params.get('tipoProcesso') === 'GRADUACAO',
    );
    expect(nova.request.params.has('cursor')).toBe(false);
    expect(tipo.matches(':disabled')).toBe(false);
    expect(document.activeElement).toBe(tipo);

    nova.flush([{ ...modelo, id: 'modelo-3', codigo: 'GRADUADO' }]);
    await propagar();

    const tabela = elemento('table').textContent;
    expect(tabela).toContain('GRADUADO');
    expect(tabela).not.toContain('INATIVO');
  });
});

describe('ModelosFormularioPage — "Tentar novamente"', () => {
  async function montarComListaFalhando() {
    TestBed.configureTestingModule({
      imports: [ModelosFormularioPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PermissoesService, useValue: { tem: () => true } },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    const fixture = TestBed.createComponent(ModelosFormularioPage);
    const controller = TestBed.inject(HttpTestingController);
    const appRef = TestBed.inject(ApplicationRef);
    const edicao = fixture.debugElement.injector.get(EdicaoDosModelosFormulario);
    fixture.detectChanges();
    controller
      .expectOne((r) => r.url === URL)
      .flush(problema(500, 'uniplus.erro_interno', 'Erro interno'), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: PROBLEMA,
      });
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`).flush([]);
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
    return { fixture, controller, appRef, edicao };
  }

  const tentarNovamente = (fixture: ComponentFixture<ModelosFormularioPage>): HTMLButtonElement =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'ui-alert .btn--secondary',
    ) as HTMLButtonElement;

  it('devolve o foco ao título da lista quando a nova tentativa dá certo e o alerta sai', async () => {
    const { fixture, controller, appRef } = await montarComListaFalhando();
    const tentar = tentarNovamente(fixture);
    tentar.focus();

    tentar.click();
    await Promise.resolve();
    appRef.tick();
    controller.expectOne((r) => r.url === URL).flush([modelo]);
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
    appRef.tick();

    expect(document.activeElement).toBe(
      (fixture.nativeElement as HTMLElement).querySelector('#cfg-modelos-list-title'),
    );
    controller.verify();
  });

  it('fica indisponível, sem refazer a leitura, enquanto uma troca de situação está pendente', async () => {
    const { fixture, controller, appRef, edicao } = await montarComListaFalhando();
    edicao.desativar(modelo);
    const troca = controller.expectOne(`${URL}/${modelo.id}`);
    appRef.tick();
    fixture.detectChanges();
    const tentar = tentarNovamente(fixture);

    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(tentar.disabled).toBe(false);
    tentar.click();
    controller.expectNone((r) => r.url === URL);

    troca.flush(null, { status: 204, statusText: 'No Content' });
    appRef.tick();
    controller.expectOne((r) => r.url === URL).flush([modelo]);
    controller.verify();
  });
});
