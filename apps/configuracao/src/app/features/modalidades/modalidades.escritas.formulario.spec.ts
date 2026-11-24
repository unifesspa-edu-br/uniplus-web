import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { responderVocabularios } from './vocabularios-da-modalidade.testing';
import { COMPOSICOES, NATUREZAS } from './modalidades-tabela.testing';
import { CATALOGO } from './catalogo-de-fatos.fixture';
import { EdicaoDaModalidade } from './edicao-da-modalidade';
import { ModalidadeFormPage } from './modalidade-form.page';
import { URL, URL_ADMIN, URL_CATALOGO } from './modalidades-de-teste.testing';
import { configurar } from './modalidades.escritas.testing';

describe('Modalidades — envio do formulário', () => {
  let fixture: ComponentFixture<ModalidadeFormPage>;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const campo = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input[formcontrolname="codigo"]');
  const descricaoNoDom = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input[formcontrolname="descricao"]');
  const salvar = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('button[form="cfg-modalidade-form"]');
  const digitarCodigo = (valor: string): void => {
    campo().value = valor;
    campo().dispatchEvent(new Event('input'));
  };
  const pendentes: TestRequest[] = [];
  const chaveDoEnvio = (): string => {
    const requisicao = controller.expectOne(URL_ADMIN);
    const chave = requisicao.request.headers.get('Idempotency-Key') ?? '';
    pendentes.push(requisicao);
    return chave;
  };
  const recusarComProblema = (problema: Record<string, unknown>): void => {
    const requisicao = pendentes.pop();
    requisicao?.flush(JSON.stringify({ type: 'about:blank', traceId: 't', ...problema }), {
      status: problema['status'] as number,
      statusText: 'Recusa',
      headers: { 'content-type': 'application/problem+json' },
    });
  };
  const recusar = (): void =>
    controller.expectOne(URL_ADMIN).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [{ field: 'Codigo', code: 'invalido', message: 'Código recusado.' }],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

  beforeEach(async () => {
    configurar();
    fixture = TestBed.createComponent(ModalidadeFormPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    responderVocabularios(controller);
    controller.expectOne((r) => r.url === URL).flush([]);
    controller.match(URL_CATALOGO).forEach((r) => r.flush(CATALOGO));
    await propagar();
    const form = fixture.debugElement.injector.get(EdicaoDaModalidade).form;
    form.controls.naturezaLegal.setValue(NATUREZAS.ampla.codigo);
    form.controls.composicaoVagas.setValue(COMPOSICOES.restante.codigo);
    campo().value = 'NOVA';
    campo().dispatchEvent(new Event('input'));
    await propagar();
  });
  afterEach(() => controller.verify());

  it('mantém os valores, o foco e impede novo envio enquanto grava', async () => {
    salvar().focus();
    salvar().click();
    const post = controller.expectOne(URL_ADMIN);
    await propagar();
    expect(campo().matches(':disabled')).toBe(true);
    expect(campo().value).toBe('NOVA');
    expect(salvar().getAttribute('aria-disabled')).toBe('true');
    expect(salvar().getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(salvar());
    salvar().click();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    controller.expectNone(URL_ADMIN);
    post.flush(JSON.stringify({ type: 'about:blank', title: 'Erro', status: 500, code: 'erro' }), {
      status: 500,
      statusText: 'Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    await propagar();
  });

  it('preserva controle desabilitado por regra após recusa', async () => {
    const form = fixture.debugElement.injector.get(EdicaoDaModalidade).form;
    form.controls.descricao.disable();
    salvar().click();
    recusar();
    await propagar();
    expect(descricaoNoDom().matches(':disabled')).toBe(true);
    expect(form.controls.descricao.disabled).toBe(true);
    expect(campo().matches(':disabled')).toBe(false);
  });

  it('preserva controle desabilitado por regra após sucesso', async () => {
    const form = fixture.debugElement.injector.get(EdicaoDaModalidade).form;
    form.controls.descricao.disable();
    salvar().click();
    controller.expectOne(URL_ADMIN).flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(descricaoNoDom().matches(':disabled')).toBe(true);
    expect(form.controls.descricao.disabled).toBe(true);
    expect(campo().matches(':disabled')).toBe(false);
  });

  it('exibe a recusa no campo e leva o foco ao erro', async () => {
    salvar().focus();
    salvar().click();
    recusar();
    await propagar();
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    expect(campo().closest('label')?.textContent).toContain('Código recusado.');
    expect(document.activeElement).toBe(campo());
  });
  it('leva o foco ao primeiro campo inválido quando o envio é barrado localmente', async () => {
    campo().value = '';
    campo().dispatchEvent(new Event('input'));
    salvar().focus();
    salvar().click();
    await propagar();
    controller.expectNone(URL_ADMIN);
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(campo());
  });

  it('mantém o foco no botão de salvar quando a falha não é de campo', async () => {
    salvar().focus();
    salvar().click();
    controller
      .expectOne(URL_ADMIN)
      .flush(JSON.stringify({ type: 'about:blank', title: 'Erro', status: 500, code: 'erro' }), {
        status: 500,
        statusText: 'Server Error',
        headers: { 'content-type': 'application/problem+json' },
      });
    await propagar();
    expect(salvar().getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(salvar());
  });

  describe('chave de idempotência', () => {
    async function enviarRecusado(problema: Record<string, unknown>): Promise<string> {
      salvar().click();
      const chave = chaveDoEnvio();
      recusarComProblema(problema);
      await propagar();
      return chave;
    }

    it('é a mesma ao repetir o envio depois de uma falha do servidor', async () => {
      const primeira = await enviarRecusado({ title: 'Erro', status: 500, code: 'erro' });
      salvar().click();
      expect(chaveDoEnvio()).toBe(primeira);
      recusarComProblema({ title: 'Erro', status: 500, code: 'erro' });
      await propagar();
    });

    it('renova depois de recusa de validação (422)', async () => {
      const primeira = await enviarRecusado({
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [{ field: 'Codigo', code: 'invalido', message: 'Código recusado.' }],
      });
      digitarCodigo('OUTRA');
      await propagar();
      salvar().click();
      expect(chaveDoEnvio()).not.toBe(primeira);
      recusarComProblema({ title: 'Erro', status: 500, code: 'erro' });
      await propagar();
    });

    it('renova depois do conflito de código (409)', async () => {
      const primeira = await enviarRecusado({
        title: 'Conflito',
        status: 409,
        code: 'uniplus.configuracao.modalidade.codigo_ja_existe',
      });
      digitarCodigo('OUTRA');
      await propagar();
      salvar().click();
      expect(chaveDoEnvio()).not.toBe(primeira);
      recusarComProblema({ title: 'Erro', status: 500, code: 'erro' });
      await propagar();
    });

    it('mantém a chave quando a requisição original ainda está em processamento (409)', async () => {
      const primeira = await enviarRecusado({
        title: 'Requisição em processamento',
        status: 409,
        code: 'uniplus.idempotency.processing_conflict',
      });
      salvar().click();
      expect(chaveDoEnvio()).toBe(primeira);
      recusarComProblema({ title: 'Erro', status: 500, code: 'erro' });
      await propagar();
    });

    it('renova quando o corpo diverge da chave já usada', async () => {
      const primeira = await enviarRecusado({
        title: 'Corpo divergente',
        status: 422,
        code: 'uniplus.idempotency.body_mismatch',
      });
      salvar().click();
      expect(chaveDoEnvio()).not.toBe(primeira);
      recusarComProblema({ title: 'Erro', status: 500, code: 'erro' });
      await propagar();
    });
  });

  it('mostra o conflito de código no campo, sem alerta geral, e devolve o foco ao campo', async () => {
    salvar().focus();
    salvar().click();
    controller.expectOne(URL_ADMIN).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Conflito',
        status: 409,
        code: 'uniplus.configuracao.modalidade.codigo_ja_existe',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar();
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    expect(campo().closest('label')?.textContent).toContain(
      'Código já utilizado por outra modalidade viva.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Não foi possível salvar');
    expect(document.activeElement).toBe(campo());
  });

  it('mostra o título de um conflito que não é de código no alerta geral, sem marcar o campo', async () => {
    salvar().click();
    chaveDoEnvio();
    recusarComProblema({
      title: 'Requisição em processamento',
      status: 409,
      code: 'uniplus.idempotency.processing_conflict',
    });
    await propagar();
    expect(fixture.nativeElement.textContent).toContain('Requisição em processamento');
    expect(campo().getAttribute('aria-invalid')).not.toBe('true');
  });

  it('escreve o código sempre em maiúsculas na criação', async () => {
    digitarCodigo('nova_1');
    await propagar();
    expect(campo().value).toBe('NOVA_1');
  });

  it('marca os campos obrigatórios com aria-required', () => {
    expect(campo().getAttribute('aria-required')).toBe('true');
    expect(
      fixture.nativeElement
        .querySelector('input[formcontrolname="descricao"]')
        .hasAttribute('aria-required'),
    ).toBe(false);
  });
  it('não parte segunda gravação enquanto uma corre, nem pela classe de edição', async () => {
    const edicao = fixture.debugElement.injector.get(EdicaoDaModalidade);
    edicao.salvar();
    edicao.salvar();
    controller.expectOne(URL_ADMIN);
    await propagar();
    expect(edicao.salvando()).toBe(true);
  });

  it('com a gravação em curso, Cancelar e Voltar à lista seguem focáveis mas não navegam', async () => {
    const router = TestBed.inject(Router);
    salvar().click();
    const post = controller.expectOne(URL_ADMIN);
    await propagar();
    const links = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.btn'),
    ].filter((a) => ['Cancelar', 'Voltar à lista'].includes(a.textContent?.trim() ?? ''));
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.getAttribute('aria-disabled')).toBe('true');
      expect(link.hasAttribute('href')).toBe(false);
      link.focus();
      expect(document.activeElement).toBe(link);
      link.click();
    }
    await propagar();
    expect(router.url).toBe('/');
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
  });

  it('fora da gravação, Cancelar e Voltar à lista levam à lista', async () => {
    const links = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.btn'),
    ].filter((a) => ['Cancelar', 'Voltar à lista'].includes(a.textContent?.trim() ?? ''));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/modalidades', '/modalidades']);
    expect(links.some((a) => a.hasAttribute('aria-disabled'))).toBe(false);
    for (const link of links) {
      await TestBed.inject(Router).navigateByUrl('/');
      link.click();
      await propagar();
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/modalidades');
    }
  });

  it('com a gravação em curso, o clique é cancelado e a submissão não pede salvar', async () => {
    const edicao = fixture.debugElement.injector.get(EdicaoDaModalidade);
    salvar().click();
    controller.expectOne(URL_ADMIN);
    await propagar();
    const pedido = vi.spyOn(edicao, 'salvar');
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    salvar().dispatchEvent(clique);
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    expect(clique.defaultPrevented).toBe(true);
    expect(pedido).not.toHaveBeenCalled();
  });
});
