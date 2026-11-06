import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  LocalOfertaDto,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDosLocaisOferta } from './edicao-dos-locais-oferta';
import { LocaisOfertaPage } from './locais-oferta.page';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/locais-oferta`;
const ESCRITA = `${BASE}/api/configuracao/admin/locais-oferta`;
const local: LocalOfertaDto = {
  id: 'local-1',
  tipo: TipoLocalOferta.poloEad,
  codigoEmec: '999',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('Escritas de locais de oferta', () => {
  let fixture: ComponentFixture<LocaisOfertaPage>;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  let edicao: EdicaoDosLocaisOferta;
  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
  };
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const achado = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(achado, seletor).not.toBeNull();
    return achado as T;
  };
  const indisponivel = (seletor: string): boolean => elemento(seletor).matches(':disabled');
  const mensagemDoEndereco = (): HTMLElement =>
    elemento('ui-endereco-geo .field__error[role="alert"]');
  const lista = (): void => controller.expectOne((r) => r.url === LISTA).flush([local]);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [LocaisOfertaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(LocaisOfertaPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    edicao = fixture.debugElement.injector.get(EdicaoDosLocaisOferta);
    fixture.detectChanges();
    lista();
    await propagar();
  });
  afterEach(() => controller.verify());

  async function abrir(): Promise<void> {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/campi`).flush([]);
    edicao.form.setValue({
      tipo: TipoLocalOferta.poloEad,
      codigoEmec: '999',
      campusResponsavelId: '',
      endereco: {
        cep: '68507590',
        logradouro: 'Folha 31',
        numero: null,
        complemento: null,
        bairro: 'Nova Marabá',
        distrito: null,
        cidade: local.cidade,
        latitude: null,
        longitude: null,
        nivelResolucao: 'logradouro',
        origem: 'geo-api',
      },
    });
    await propagar();
  }
  async function concluir(): Promise<void> {
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    lista();
    await propagar();
  }

  it('durante envio mantém foco, desabilita campos e bloqueia fechamento e novas ativações', async () => {
    await abrir();
    const salvar = elemento<HTMLButtonElement>('button[form="cfg-local-form"]');
    const chamada = vi.spyOn(edicao, 'salvar');
    salvar.focus();
    elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(indisponivel('input[formcontrolname="codigoEmec"]')).toBe(true);
    expect(indisponivel('select[formcontrolname="tipo"]')).toBe(true);
    expect(indisponivel('select[formcontrolname="campusResponsavelId"]')).toBe(true);
    expect(elemento<HTMLInputElement>('input[formcontrolname="codigoEmec"]').value).toBe('999');
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    expect(salvar.getAttribute('aria-busy')).toBe('true');
    expect(salvar.textContent).toContain('Salvando');
    expect(document.activeElement).toBe(salvar);
    expect(elemento<HTMLButtonElement>('.form-drawer__footer button').disabled).toBe(true);
    const dialog = elemento<HTMLDialogElement>(
      'dialog[aria-label="Formulário de local de oferta"]',
    );
    expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    salvar.click();
    elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(edicao.formOpen()).toBe(true);
    expect(chamada).toHaveBeenCalledTimes(1);
    expect(elemento('dialog p[role="status"]').textContent).toContain('Salvando');
    await concluir();
  });

  it('mantém controle desabilitado por regra após recusa e foca o campo recusado', async () => {
    await abrir();
    edicao.form.controls.campusResponsavelId.disable();
    elemento<HTMLButtonElement>('button[form="cfg-local-form"]').focus();
    elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    controller.expectOne(ESCRITA).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'CodigoEmec',
            code: 'uniplus.configuracao.local.codigo_invalido',
            message: 'Código inválido.',
          },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar();
    await propagar();
    const campo = elemento<HTMLInputElement>('input[formcontrolname="codigoEmec"]');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.closest('label')?.textContent).toContain('Código inválido.');
    expect(document.activeElement).toBe(campo);
    expect(indisponivel('select[formcontrolname="campusResponsavelId"]')).toBe(true);
    expect(indisponivel('input[formcontrolname="codigoEmec"]')).toBe(false);
    expect(indisponivel('select[formcontrolname="tipo"]')).toBe(false);
  });

  it('apresenta a recusa do campus associado ao select e move o foco', async () => {
    await abrir();
    elemento<HTMLButtonElement>('button[form="cfg-local-form"]').focus();
    elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    controller.expectOne(ESCRITA).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'CampusResponsavelId',
            code: 'uniplus.configuracao.local.campus_invalido',
            message: 'Campus inválido.',
          },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar();
    await propagar();
    const campo = elemento<HTMLSelectElement>('select[formcontrolname="campusResponsavelId"]');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    const mensagem = elemento<HTMLElement>('#' + campo.getAttribute('aria-describedby'));
    expect(mensagem.textContent).toContain('Campus inválido.');
    expect(document.activeElement).toBe(campo);
  });

  it('com Enter num campo, leva o foco ao botão de salvar', async () => {
    await abrir();
    const campo = elemento<HTMLInputElement>('input[formcontrolname="codigoEmec"]');
    campo.focus();
    elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(campo.matches(':disabled')).toBe(true);
    expect(document.activeElement).toBe(elemento('button[form="cfg-local-form"]'));
    await concluir();
  });

  describe('envio barrado por CEP pendente', () => {
    const campoCep = (): HTMLInputElement =>
      elemento<HTMLInputElement>('ui-endereco-geo input[id$="-cep"]');
    async function trocarCepEEnviar(cep: string): Promise<void> {
      await abrir();
      const trocar = [...raiz().querySelectorAll<HTMLButtonElement>('ui-endereco-geo button')].find(
        (b) => b.textContent?.includes('Trocar CEP'),
      );
      trocar?.click();
      await propagar();
      campoCep().value = cep;
      campoCep().dispatchEvent(new Event('input'));
      await propagar();
    }
    function enviar(): void {
      elemento<HTMLButtonElement>('button[form="cfg-local-form"]').focus();
      elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
    }

    it('com o CEP incompleto, leva o foco ao campo do CEP', async () => {
      await trocarCepEEnviar('12345');
      enviar();
      await propagar();
      await propagar();
      controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campoCep());
    });

    const recusarBuscasDeCep = (): void =>
      controller
        .match((r) => r.url.includes('12345678'))
        .forEach((r) =>
          r.flush(
            { type: 'about:blank', title: 'Não encontrado', status: 404, traceId: 't' },
            {
              status: 404,
              statusText: 'Not Found',
              headers: { 'content-type': 'application/problem+json' },
            },
          ),
        );

    it('com o CEP de 8 dígitos não encontrado, leva o foco ao campo do CEP', async () => {
      await trocarCepEEnviar('12345678');
      enviar();
      await propagar();
      recusarBuscasDeCep();
      await propagar();
      enviar();
      await propagar();
      await propagar();
      recusarBuscasDeCep();
      controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campoCep());
    });
  });

  describe('envio barrado localmente com o endereço em branco', () => {
    const campoCep = (): HTMLInputElement =>
      elemento<HTMLInputElement>('ui-endereco-geo input[id$="-cep"]');
    const pendenciaDaCidade = (): boolean =>
      raiz().textContent?.includes('Selecione a cidade') ?? false;

    async function abrirEmBranco(tipo: string): Promise<void> {
      elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
      await propagar();
      controller.expectOne((r) => r.url === `${BASE}/api/configuracao/campi`).flush([]);
      edicao.form.controls.tipo.setValue(tipo);
      await propagar();
    }
    async function enviarBarrado(): Promise<void> {
      elemento<HTMLButtonElement>('button[form="cfg-local-form"]').focus();
      elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await propagar();
      await propagar();
      controller.expectNone(ESCRITA);
    }

    it('leva o foco ao primeiro campo inválido', async () => {
      await abrirEmBranco('');
      await enviarBarrado();
      expect(document.activeElement).toBe(elemento('select[formcontrolname="tipo"]'));
    });

    it('com o CEP pendente num cadastro novo, leva o foco ao CEP e não diz que falta a cidade', async () => {
      await abrirEmBranco(TipoLocalOferta.poloEad);
      campoCep().value = '12345';
      campoCep().dispatchEvent(new Event('input'));
      await propagar();
      await enviarBarrado();
      expect(document.activeElement).toBe(campoCep());
      expect(pendenciaDaCidade()).toBe(false);
    });

    it('sem CEP, diz que falta a cidade e a mensagem sai da tela quando a cidade é preenchida', async () => {
      await abrirEmBranco(TipoLocalOferta.poloEad);
      await enviarBarrado();
      expect(pendenciaDaCidade()).toBe(true);

      edicao.form.controls.endereco.setValue({
        cep: '68507590',
        logradouro: 'Folha 31',
        numero: null,
        complemento: null,
        bairro: 'Nova Marabá',
        distrito: null,
        cidade: local.cidade,
        latitude: null,
        longitude: null,
        nivelResolucao: 'logradouro',
        origem: 'geo-api',
      });
      await propagar();

      expect(pendenciaDaCidade()).toBe(false);
    });
  });

  it('no endereço manual sem UF, leva o foco à mensagem da recusa do endereço', async () => {
    await abrir();
    const atual = edicao.form.controls.endereco.getRawValue();
    if (atual === null) {
      throw new Error('o local em edição deveria ter endereço');
    }
    edicao.form.controls.endereco.setValue({
      ...atual,
      cidade: null,
      origem: 'manual',
      nivelResolucao: null,
    });
    await propagar();
    elemento<HTMLButtonElement>('button[form="cfg-local-form"]').focus();
    elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    await propagar();
    controller.expectNone(ESCRITA);
    expect(document.activeElement).toBe(mensagemDoEndereco());
  });

  it('comunica que a cidade é obrigatória no preenchimento manual', async () => {
    await abrir();
    const link = elemento<HTMLButtonElement>('ui-endereco-geo .endereco-geo__link');
    link.click();
    await propagar();
    const cidade = elemento<HTMLInputElement>('ui-valor-de-municipio input');
    expect(cidade.getAttribute('aria-required')).toBe('true');
  });

  it('recusa escritas concorrentes e mantém a trava até terminar a recarga', async () => {
    await abrir();
    edicao.salvar();
    edicao.salvar();
    edicao.pedirRemocao(local);
    edicao.removerConfirmado();
    controller.expectNone(`${ESCRITA}/${local.id}`);
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.gravando()).toBe(true);
    edicao.abrirCadastro();
    edicao.pedirRemocao(local);
    expect(edicao.formOpen()).toBe(false);
    expect(edicao.confirmOpen()).toBe(false);
    lista();
    await propagar();
    expect(edicao.gravando()).toBe(false);
  });

  it('após sucesso preserva controle desabilitado e devolve foco ao acionador', async () => {
    const acionador = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    acionador.focus();
    await abrir();
    edicao.form.controls.campusResponsavelId.disable();
    elemento<HTMLButtonElement>('button[form="cfg-local-form"]').focus();
    edicao.salvar();
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    (document.activeElement as HTMLElement).blur();
    lista();
    await propagar();
    await propagar();
    expect(indisponivel('select[formcontrolname="campusResponsavelId"]')).toBe(true);
    expect(indisponivel('input[formcontrolname="codigoEmec"]')).toBe(false);
    expect(document.activeElement).toBe(acionador);
  });

  async function pedirRemocao(): Promise<void> {
    elemento<HTMLButtonElement>('button[aria-label^="Remover local de oferta"]').click();
    await propagar();
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    await propagar();
  }
  const dialogoDaRemocao = (): HTMLDialogElement =>
    elemento<HTMLDialogElement>('cfg-confirmacao-de-remocao dialog');
  const confirmarRemocao = (): HTMLButtonElement =>
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');

  it('remoção pendente mantém o diálogo aberto, anuncia o andamento e recusa novo envio e o fechamento', async () => {
    elemento<HTMLButtonElement>('button[aria-label^="Remover local de oferta"]').click();
    await propagar();
    confirmarRemocao().focus();
    confirmarRemocao().click();
    await propagar();
    expect(edicao.saving()).toBe(false);
    expect(elemento('cfg-confirmacao-de-remocao [role="status"]').textContent?.trim()).toBe(
      'Removendo o local de oferta.',
    );
    expect(confirmarRemocao().getAttribute('aria-disabled')).toBe('true');
    expect(confirmarRemocao().getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(confirmarRemocao());
    expect(
      dialogoDaRemocao().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
    ).toBe(true);
    expect(indisponivel('[data-testid="confirm-dialog-cancel"]')).toBe(true);
    dialogoDaRemocao().dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(dialogoDaRemocao().hasAttribute('open')).toBe(true);
    expect(edicao.confirmOpen()).toBe(true);
    confirmarRemocao().click();
    edicao.salvar();
    expect(indisponivel('.panel-head .btn--primary')).toBe(true);
    expect(indisponivel('button[aria-label^="Editar local de oferta"]')).toBe(true);
    expect(indisponivel('button[aria-label^="Remover local de oferta"]')).toBe(true);
    controller.expectNone(ESCRITA);
    controller
      .expectOne(`${ESCRITA}/${local.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(elemento(':scope > [role="status"]').textContent?.trim()).toBe(
      'Local de oferta removido.',
    );
    expect(edicao.gravando()).toBe(true);
    lista();
    await propagar();
    expect(edicao.gravando()).toBe(false);
  });

  it('a confirmação repetida durante a remoção não envia uma segunda exclusão', async () => {
    edicao.pedirRemocao(local);
    edicao.removerConfirmado();
    edicao.removerConfirmado();
    controller
      .expectOne(`${ESCRITA}/${local.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    lista();
    await propagar();
  });

  describe('remoção recusada', () => {
    async function recusarRemocao(status: number, code: string, title: string): Promise<void> {
      await pedirRemocao();
      controller
        .expectOne(`${ESCRITA}/${local.id}`)
        .flush(JSON.stringify({ type: 'about:blank', title, status, code }), {
          status,
          statusText: 'Erro',
          headers: { 'content-type': 'application/problem+json' },
        });
      await propagar();
    }

    async function conferirDialogoComARecusa(titulo: string): Promise<void> {
      expect(dialogoDaRemocao().hasAttribute('open')).toBe(true);
      expect(elemento('cfg-confirmacao-de-remocao .field__error').textContent?.trim()).toBe(titulo);
      expect(elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        `Não foi possível remover o local de oferta. ${titulo}`,
      );
      expect(confirmarRemocao().getAttribute('aria-disabled')).toBeNull();
      expect(edicao.gravando()).toBe(false);
      confirmarRemocao().click();
      controller
        .expectOne(`${ESCRITA}/${local.id}`)
        .flush(null, { status: 204, statusText: 'No Content' });
      await propagar();
      lista();
      await propagar();
    }

    it('com 409, mantém o diálogo aberto com o motivo e o botão pronto para nova tentativa', async () => {
      const titulo = 'Local referenciado por oferta de curso ativa';
      await recusarRemocao(
        409,
        'uniplus.configuracao.local_oferta.remocao_bloqueada_por_oferta_curso',
        titulo,
      );
      await conferirDialogoComARecusa(titulo);
    });

    it('com 500, mantém o diálogo aberto com o motivo, notifica o servidor e permite nova tentativa', async () => {
      const notificar = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
      await recusarRemocao(500, 'uniplus.erro_interno', 'Erro interno');
      expect(notificar).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500, code: 'uniplus.erro_interno' }),
        expect.objectContaining({ title: 'Erro interno' }),
      );
      await conferirDialogoComARecusa('Erro interno');
    });

    it('a recusa não aparece ao abrir a confirmação de novo', async () => {
      await recusarRemocao(409, 'uniplus.configuracao.conflito', 'Em uso');
      edicao.confirmOpen.set(false);
      edicao.pedirRemocao(local);
      await propagar();
      expect(raiz().querySelector('cfg-confirmacao-de-remocao .field__error')).toBeNull();
    });
  });

  function recusar(status: number, corpo: Record<string, unknown>): void {
    controller
      .expectOne(ESCRITA)
      .flush(JSON.stringify({ type: 'about:blank', title: 'Recusado', status, ...corpo }), {
        status,
        statusText: 'Erro',
        headers: { 'content-type': 'application/problem+json' },
      });
  }

  async function enviarRecusado(status: number, corpo: Record<string, unknown>): Promise<string> {
    await abrir();
    const chave = edicao.idempotencyKeyAtual();
    edicao.salvar();
    await propagar();
    recusar(status, corpo);
    await propagar();
    return chave;
  }

  it('mantém a chave de idempotência e mostra a mensagem quando a execução anterior ainda corre', async () => {
    const chave = await enviarRecusado(409, {
      title: 'Requisição ainda em processamento',
      code: 'uniplus.idempotency.processing_conflict',
    });
    expect(edicao.idempotencyKeyAtual()).toBe(chave);
    expect(edicao.formError()).toBeTruthy();
    expect(elemento('dialog ui-alert').textContent).toContain(edicao.formError() as string);
  });

  it('renova a chave após recusa definitiva do servidor, mesmo com 409', async () => {
    const chave = await enviarRecusado(409, { code: 'uniplus.configuracao.conflito' });
    expect(edicao.idempotencyKeyAtual()).not.toBe(chave);
    expect(edicao.formError()).toBeTruthy();
  });

  it('mantém a chave e notifica quando o servidor falha (5xx)', async () => {
    const notificar = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    const chave = await enviarRecusado(500, { code: 'uniplus.erro_interno' });
    expect(notificar).toHaveBeenCalledTimes(1);
    expect(notificar).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500, code: 'uniplus.erro_interno' }),
    );
    expect(edicao.idempotencyKeyAtual()).toBe(chave);
    expect(edicao.formError()).toBeTruthy();
    expect(edicao.gravando()).toBe(false);
  });

  it('avisa quando a recusa 422 não aponta nenhum campo conhecido', async () => {
    await enviarRecusado(422, {
      code: 'uniplus.validacao',
      errors: [{ field: 'Desconhecido', code: 'x', message: 'Sem destino.' }],
    });
    expect(edicao.formError()).toBe(
      'Não foi possível mapear os erros de validação. Revise os campos.',
    );
  });

  it('apresenta a recusa de endereço no bloco do endereço e leva o foco a ela', async () => {
    const chave = await enviarRecusado(422, {
      code: 'uniplus.validacao',
      errors: [{ field: 'Endereco.Cep', code: 'cep', message: 'CEP inválido.' }],
    });
    await propagar();
    expect(mensagemDoEndereco().textContent?.trim()).toBe('CEP inválido.');
    expect(document.activeElement).toBe(mensagemDoEndereco());
    expect(raiz().querySelector('dialog ui-alert')).toBeNull();
    expect(edicao.idempotencyKeyAtual()).not.toBe(chave);
  });

  it('apresenta a falha de endereço informada só pelo código do problema e leva o foco a ela', async () => {
    await enviarRecusado(400, { code: 'EnderecoReferencia.CepFormatoInvalido' });
    await propagar();
    expect(mensagemDoEndereco().textContent?.trim()).toBeTruthy();
    expect(document.activeElement).toBe(mensagemDoEndereco());
    expect(raiz().querySelector('dialog ui-alert')).toBeNull();
  });

  it('"Tentar novamente" fica indisponível com a remoção pendente e a listagem falha', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LocaisOfertaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(LocaisOfertaPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    edicao = fixture.debugElement.injector.get(EdicaoDosLocaisOferta);
    fixture.detectChanges();
    controller
      .expectOne((r) => r.url === LISTA)
      .flush(JSON.stringify({ type: 'about:blank', title: 'Falha', status: 400, code: 'x' }), {
        status: 400,
        statusText: 'Bad',
        headers: { 'content-type': 'application/problem+json' },
      });
    await propagar();
    const tentar = elemento<HTMLButtonElement>('.cfg-locais__retry button');
    expect(tentar.getAttribute('aria-disabled')).toBeNull();
    edicao.pedirRemocao(local);
    edicao.removerConfirmado();
    await propagar();
    expect(edicao.removendo()).toBe(true);
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    tentar.click();
    controller.expectNone((r) => r.url === LISTA);
    controller.expectOne(`${ESCRITA}/${local.id}`).flush(null, { status: 204, statusText: 'No' });
    await propagar();
    lista();
    await propagar();
  });
});
