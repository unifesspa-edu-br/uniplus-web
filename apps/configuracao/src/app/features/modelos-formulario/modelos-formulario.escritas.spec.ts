import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
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
    controller.expectOne((r) => r.url === URL).flush([modelo]);
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`).flush([]);
    await propagar();
  });
  afterEach(() => controller.verify());

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

  it('mantém os campos somente leitura, o foco e o drawer aberto enquanto cria', async () => {
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
    const criar = vi.spyOn(edicao, 'criar');
    await preencher();
    enviar();
    const post = controller.expectOne(URL);
    await propagar();
    salvar().click();
    elemento<HTMLFormElement>('#cfg-modelo-criacao').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(criar).toHaveBeenCalledTimes(1);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
  });

  it('mostra a recusa do servidor e leva o foco ao campo recusado', async () => {
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
  });

  it('bloqueia criação e troca de situação concorrentes em ambos os sentidos', async () => {
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

  it('anuncia o início e o fim da troca de situação em uma região de status', async () => {
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
});
