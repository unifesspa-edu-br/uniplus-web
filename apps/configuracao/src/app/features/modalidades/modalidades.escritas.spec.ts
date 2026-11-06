import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOGO } from './catalogo-de-fatos.fixture';
import { EdicaoDaModalidade } from './edicao-da-modalidade';
import { EdicaoDasModalidades } from './edicao-das-modalidades';
import { ModalidadeFormPage } from './modalidade-form.page';
import { ModalidadesListPage } from './modalidades-list.page';
import { ModalidadesStore } from './modalidades.store';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/modalidades`;
const CATALOGO_URL = `${BASE}/api/configuracao/fatos-candidato`;
const ESCRITA = `${BASE}/api/configuracao/admin/modalidades`;
const modalidade: ModalidadeDto = {
  id: 'id-v',
  codigo: 'V',
  legalFixa: false,
  descricao: 'Modalidade V',
  naturezaLegal: 'AMPLA',
  composicaoVagas: 'RESIDUAL_DO_VO',
  composicaoOrigem: null,
  regraRemanejamento: null,
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
  regraDeAplicabilidade: [],
  acaoQuandoIndeferido: null,
  baseLegal: null,
  criadoEm: '2026-07-03T12:00:00Z',
};

function configurar(): void {
  TestBed.configureTestingModule({
    imports: [ModalidadesListPage, ModalidadeFormPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([{ path: 'modalidades', children: [] }]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
    ],
  });
}

describe('Modalidades — remoção pela interface', () => {
  let fixture: ComponentFixture<ModalidadesListPage>;
  let controller: HttpTestingController;
  let edicao: EdicaoDasModalidades;
  let app: ApplicationRef;
  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    configurar();
    fixture = TestBed.createComponent(ModalidadesListPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    edicao = fixture.debugElement.injector.get(EdicaoDasModalidades);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === LISTA).flush([modalidade]);
    controller.match(CATALOGO_URL).forEach((r) => r.flush(CATALOGO));
    await propagar();
  });
  afterEach(() => controller.verify());

  it('impede tentar novamente enquanto uma remoção está pendente', async () => {
    edicao.remover(modalidade);
    const remocao = controller.expectOne(`${ESCRITA}/${modalidade.id}`);
    fixture.debugElement.injector.get(ModalidadesStore).recarregar();
    await propagar();
    controller
      .expectOne((r) => r.url === LISTA)
      .flush(
        { type: 'about:blank', title: 'Indisponível', status: 503, code: 'erro' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await propagar();
    const retry = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ].find((b) => b.textContent?.trim() === 'Tentar novamente');
    expect(retry?.getAttribute('aria-disabled')).toBe('true');
    expect(retry?.disabled).toBe(false);
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
  });

  it('"Tentar novamente" que dá certo leva o foco, que estava no botão, ao título da lista', async () => {
    const raiz = fixture.nativeElement as HTMLElement;
    fixture.debugElement.injector.get(ModalidadesStore).recarregar();
    await propagar();
    controller
      .expectOne((r) => r.url === LISTA)
      .flush(
        { type: 'about:blank', title: 'Indisponível', status: 503, code: 'erro' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await propagar();
    const tentar = [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Tentar novamente',
    ) as HTMLButtonElement;
    tentar.focus();
    tentar.click();
    await propagar();
    expect(tentar.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(tentar);

    controller.expectOne((r) => r.url === LISTA).flush([modalidade]);
    await propagar();
    await propagar();
    expect(document.activeElement).toBe(raiz.querySelector('#cfg-modalidades-title'));
  });

  it('o diálogo de remoção põe os botões direto no rodapé, sem contêiner entre eles', async () => {
    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('button[aria-label="Remover modalidade V"]')?.click();
    await propagar();
    const botoes = [...raiz.querySelectorAll<HTMLButtonElement>('dialog .uni-dialog__footer > button')];
    expect(botoes.map((b) => b.textContent?.trim())).toEqual(['Cancelar', 'Remover']);
  });

  it('anuncia a remoção e mantém a trava até terminar a recarga', async () => {
    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('button[aria-label="Remover modalidade V"]')?.click();
    await propagar();
    const confirmar = [...raiz.querySelectorAll<HTMLButtonElement>('dialog button')].find(
      (b) => b.textContent?.trim() === 'Remover',
    );
    confirmar?.click();
    const requisicao = controller.expectOne(`${ESCRITA}/${modalidade.id}`);
    await propagar();
    expect(edicao.removendo()).toBe(true);
    const dialogo = raiz.querySelector<HTMLDialogElement>('dialog');
    const fechar = dialogo?.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]');
    if (!dialogo || !fechar) throw new Error('Diálogo ou botão de fechar não encontrado.');
    expect(fechar.disabled).toBe(true);
    fechar.click();
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(dialogo.open).toBe(true);
    expect(raiz.querySelector('dialog [role="status"]')?.textContent).toContain(
      'Removendo a modalidade V.',
    );
    expect(raiz.querySelector('[data-scope]')?.hasAttribute('inert')).toBe(true);
    expect(
      raiz.querySelector<HTMLButtonElement>('button[aria-label="Remover modalidade V"]')?.disabled,
    ).toBe(true);
    edicao.remover(modalidade);
    controller.expectNone(`${ESCRITA}/${modalidade.id}`);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(edicao.removendo()).toBe(true);
    edicao.remover(modalidade);
    controller.expectNone(`${ESCRITA}/${modalidade.id}`);
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    expect(edicao.removendo()).toBe(false);
    expect(raiz.querySelector('.sr-only[role="status"]')?.textContent).toContain(
      'Modalidade V removida.',
    );
  });
});

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
    const requisicao = controller.expectOne(ESCRITA);
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
    controller.expectOne(ESCRITA).flush(
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
    controller.expectOne((r) => r.url === LISTA).flush([]);
    controller.match(CATALOGO_URL).forEach((r) => r.flush(CATALOGO));
    await propagar();
    campo().value = 'NOVA';
    campo().dispatchEvent(new Event('input'));
    await propagar();
  });
  afterEach(() => controller.verify());

  it('mantém os valores, o foco e impede novo envio enquanto grava', async () => {
    salvar().focus();
    salvar().click();
    const post = controller.expectOne(ESCRITA);
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
    controller.expectNone(ESCRITA);
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
    controller.expectOne(ESCRITA).flush('novo-id', { status: 201, statusText: 'Created' });
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
    controller.expectNone(ESCRITA);
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(campo());
  });

  it('mantém o foco no botão de salvar quando a falha não é de campo', async () => {
    salvar().focus();
    salvar().click();
    controller
      .expectOne(ESCRITA)
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
    controller.expectOne(ESCRITA).flush(
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
    controller.expectOne(ESCRITA);
    await propagar();
    expect(edicao.salvando()).toBe(true);
  });

  it('com a gravação em curso, Cancelar e Voltar à lista seguem focáveis mas não navegam', async () => {
    const router = TestBed.inject(Router);
    salvar().click();
    const post = controller.expectOne(ESCRITA);
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
    controller.expectOne(ESCRITA);
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
