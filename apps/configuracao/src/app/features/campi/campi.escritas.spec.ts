import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CampusDto, CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CampiPage } from './campi.page';
import { CampiStore } from './campi.store';
import { EdicaoDosCampi } from './edicao-dos-campi';

const BASE = 'http://localhost:5000';
const LISTA_URL = `${BASE}/api/configuracao/campi`;
const ESCRITA_URL = `${BASE}/api/configuracao/admin/campi`;

const campusSeed: CampusDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const enderecoResolvido: EnderecoEstruturado = {
  cep: '68507590',
  logradouro: 'Folha 31',
  numero: 's/n',
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  latitude: null,
  longitude: null,
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

/** Escritas de campi atravessando os componentes da página: cliques e digitação, como o operador. */
describe('CampiPage — escritas pela interface', () => {
  let fixture: ComponentFixture<CampiPage>;
  let edicao: EdicaoDosCampi;
  let store: CampiStore;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CampiPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CampiPage);
    edicao = fixture.debugElement.injector.get(EdicaoDosCampi);
    store = fixture.debugElement.injector.get(CampiStore);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    await responderLista();
  });

  afterEach(() => controller.verify());

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };

  async function responderLista(): Promise<void> {
    controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    await propagar();
  }

  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const el = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(el, seletor).not.toBeNull();
    return el as T;
  };

  const digitar = (seletor: string, valor: string): void => {
    const input = elemento<HTMLInputElement>(seletor);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };

  async function preencherNovoCampus(): Promise<void> {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    digitar('input[formcontrolname="sigla"]', 'PARAUAPEBAS');
    digitar('input[formcontrolname="nome"]', 'Campus de Parauapebas');
    // O endereço é um controle composto resolvido pelo Geo; os demais campos são digitados.
    edicao.form.controls.endereco.setValue(enderecoResolvido);
  }

  const enviarFormulario = (): void =>
    elemento<HTMLButtonElement>('button[form="cfg-campus-form"]').click();

  async function pedirRemocao(): Promise<void> {
    elemento<HTMLButtonElement>('button[aria-label="Remover campus MARABA"]').click();
    await propagar();
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    await propagar();
  }

  function recusar(corpo: object): void {
    controller.expectOne(ESCRITA_URL).flush(JSON.stringify(corpo), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'content-type': 'application/problem+json' },
    });
  }

  const botao = (seletor: string, texto: string): HTMLButtonElement => {
    const achado = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(seletor),
    ].find((b) => b.textContent?.trim() === texto);
    expect(achado, `${seletor} "${texto}"`).toBeDefined();
    return achado as HTMLButtonElement;
  };

  const drawerDoFormulario = (): HTMLDialogElement =>
    elemento<HTMLDialogElement>('dialog[aria-label="Formulário de campus"]');

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    await preencherNovoCampus();
    for (const campo of ['sigla', 'nome']) {
      expect(elemento<HTMLElement>(`[formcontrolname="${campo}"]`).getAttribute('aria-required')).toBe(
        'true',
      );
    }
  });

  it('gravação pendente deixa o formulário somente leitura e impede fechar', async () => {
    await preencherNovoCampus();
    const salvar = elemento<HTMLButtonElement>('button[form="cfg-campus-form"]');
    salvar.focus();
    salvar.click();
    const post = controller.expectOne(ESCRITA_URL);
    await propagar();

    // Somente leitura: os valores ficam, os campos não aceitam edição e o foco segue no botão.
    expect(elemento<HTMLInputElement>('input[formcontrolname="sigla"]').matches(':disabled')).toBe(
      true,
    );
    expect(elemento<HTMLInputElement>('input[formcontrolname="sigla"]').value).toBe('PARAUAPEBAS');
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    expect(salvar.getAttribute('aria-busy')).toBe('true');
    expect(salvar.textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(salvar);
    // Cancelar, X e Esc ficam indisponíveis.
    expect(botao('.form-drawer__footer button', 'Cancelar').disabled).toBe(true);
    expect(
      drawerDoFormulario().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
        ?.disabled,
    ).toBe(true);
    drawerDoFormulario().dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(edicao.aberto()).toBe(true);

    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.aberto()).toBe(false);
    controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
  });

  it('remoção pendente mostra "Removendo", indisponibiliza os acionadores e não vira salvamento', async () => {
    await pedirRemocao();
    const remocao = controller.expectOne(`${ESCRITA_URL}/${campusSeed.id}`);
    await propagar();

    expect(elemento('.panel-head').textContent).toContain('Removendo');
    expect(elemento('.sr-only[role="status"]').textContent?.trim()).toBe(
      'Removendo o campus MARABA.',
    );
    expect(edicao.salvando()).toBe(false);
    expect(edicao.removendo()).toBe(true);
    expect(elemento<HTMLButtonElement>('.panel-head .btn--primary').disabled).toBe(true);
    expect(elemento<HTMLButtonElement>('button[aria-label="Editar campus MARABA"]').disabled).toBe(
      true,
    );
    expect(elemento<HTMLButtonElement>('button[aria-label="Remover campus MARABA"]').disabled).toBe(
      true,
    );

    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne((r) => r.url === LISTA_URL).flush([]);
    await propagar();
    expect(elemento('.sr-only[role="status"]').textContent?.trim()).toBe('Campus MARABA removido.');
    expect(elemento<HTMLButtonElement>('.panel-head .btn--primary').disabled).toBe(false);
  });

  it('com remoção pendente e a listagem falhando, o "Tentar novamente" da página fica indisponível', async () => {
    await pedirRemocao();
    const remocao = controller.expectOne(`${ESCRITA_URL}/${campusSeed.id}`);
    store.recarregar();
    await propagar();
    controller
      .expectOne((r) => r.url === LISTA_URL)
      .flush(
        JSON.stringify({
          type: 'about:blank',
          title: 'Indisponível',
          status: 503,
          code: 'uniplus.indisponivel',
          traceId: 'test-trace',
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await propagar();

    expect(botao('ui-alert button', 'Tentar novamente').disabled).toBe(true);

    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne((r) => r.url === LISTA_URL).flush([]);
    await propagar();
  });

  describe('trava da classe de edição contra chamadas concorrentes', () => {
    it('uma segunda submissão não parte enquanto a primeira corre', async () => {
      await preencherNovoCampus();
      edicao.salvar();
      edicao.salvar();

      controller.expectOne(ESCRITA_URL).flush('id', { status: 201, statusText: 'Created' });
      await propagar();
      controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    });

    it('a remoção não parte enquanto uma gravação corre', async () => {
      await preencherNovoCampus();
      edicao.salvar();
      edicao.pedirRemocao(campusSeed);
      edicao.removerConfirmado();

      controller.expectNone(`${ESCRITA_URL}/${campusSeed.id}`);
      controller.expectOne(ESCRITA_URL).flush('id', { status: 201, statusText: 'Created' });
      await propagar();
      controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    });

    it('a submissão não parte enquanto uma remoção corre', async () => {
      edicao.pedirRemocao(campusSeed);
      edicao.removerConfirmado();
      await preencherNovoCampus();
      edicao.salvar();

      controller.expectNone(ESCRITA_URL);
      controller
        .expectOne(`${ESCRITA_URL}/${campusSeed.id}`)
        .flush(null, { status: 204, statusText: 'No Content' });
      await propagar();
      controller.expectOne((r) => r.url === LISTA_URL).flush([]);
    });
  });

  it('recusa do servidor é mostrada no campo recusado', async () => {
    await preencherNovoCampus();
    enviarFormulario();
    recusar({
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      code: 'uniplus.validacao',
      traceId: 'test-trace',
      errors: [
        {
          field: 'Sigla',
          code: 'uniplus.configuracao.campus.sigla_ja_existe',
          message: 'Sigla já cadastrada.',
        },
      ],
    });
    await propagar();

    const campo = elemento('input[formcontrolname="sigla"]').closest('label') as HTMLElement;
    expect(campo.querySelector('.field__error')?.textContent?.trim()).toBe('Sigla já cadastrada.');
    expect(elemento('input[formcontrolname="sigla"]').getAttribute('aria-invalid')).toBe('true');
  });

  it('recusa do servidor sobre o endereço é mostrada no bloco do endereço', async () => {
    await preencherNovoCampus();
    enviarFormulario();
    recusar({
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      code: 'uniplus.validacao',
      traceId: 'test-trace',
      errors: [
        {
          field: 'CidadeCodigoIbge',
          code: 'uniplus.configuracao.campus.cidade_divergente',
          message: 'A cidade não corresponde ao CEP informado.',
        },
      ],
    });
    await propagar();

    const erro = elemento('ui-endereco-geo .field__error');
    expect(erro.textContent?.trim()).toBe('A cidade não corresponde ao CEP informado.');
  });

  describe('campo desabilitado por regra de negócio', () => {
    it('continua desabilitado depois do sucesso, e os demais seguem habilitados no modelo', async () => {
      await preencherNovoCampus();
      edicao.form.controls.codigoEmec.disable();
      edicao.salvar();
      expect(edicao.form.controls.codigoEmec.disabled).toBe(true);
      expect(edicao.form.controls.sigla.enabled).toBe(true);

      controller.expectOne(ESCRITA_URL).flush('id', { status: 201, statusText: 'Created' });
      await propagar();

      expect(edicao.form.controls.codigoEmec.disabled).toBe(true);
      expect(edicao.form.controls.sigla.enabled).toBe(true);
      controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    });

    it('continua desabilitado depois da recusa do servidor', async () => {
      await preencherNovoCampus();
      edicao.form.controls.codigoEmec.disable();
      edicao.salvar();

      recusar({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [
          { field: 'Sigla', code: 'uniplus.configuracao.campus.invalido', message: 'Recusado.' },
        ],
      });
      await propagar();

      expect(edicao.form.controls.codigoEmec.disabled).toBe(true);
      expect(edicao.form.controls.sigla.errors?.['backend']).toBeDefined();
    });
  });

  describe('ativação enquanto o envio corre', () => {
    it('clique e envio do formulário não chamam salvar de novo', async () => {
      const salvarDaClasse = vi.spyOn(edicao, 'salvar');
      await preencherNovoCampus();
      enviarFormulario();
      const post = controller.expectOne(ESCRITA_URL);
      await propagar();

      enviarFormulario();
      elemento<HTMLFormElement>('#cfg-campus-form').dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await propagar();

      expect(salvarDaClasse).toHaveBeenCalledTimes(1);
      post.flush('novo-id', { status: 201, statusText: 'Created' });
      await propagar();
      controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    });
  });

  describe('recusa só do endereço', () => {
    const recusaDeEndereco = {
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      code: 'uniplus.validacao',
      traceId: 'test-trace',
      errors: [
        {
          field: 'CidadeCodigoIbge',
          code: 'uniplus.configuracao.campus.cidade_divergente',
          message: 'A cidade não corresponde ao CEP informado.',
        },
      ],
    };

    async function enviarERecusar(): Promise<void> {
      const salvar = elemento<HTMLButtonElement>('button[form="cfg-campus-form"]');
      salvar.focus();
      salvar.click();
      await propagar();
      recusar(recusaDeEndereco);
      await propagar();
      await propagar();
    }

    it('com o endereço resolvido por CEP, o foco vai à mensagem da recusa', async () => {
      await preencherNovoCampus();
      await enviarERecusar();

      const mensagem = elemento('ui-endereco-geo .field__error');
      expect(document.activeElement).toBe(mensagem);
      expect(elemento('ui-endereco-geo fieldset').getAttribute('aria-describedby')).toBe(
        mensagem.id,
      );
    });

    it('um novo envio barrado localmente não mantém a recusa antiga do endereço', async () => {
      await preencherNovoCampus();
      await enviarERecusar();
      expect(fixture.nativeElement.querySelector('ui-endereco-geo .field__error')).not.toBeNull();

      digitar('input[formcontrolname="sigla"]', '');
      enviarFormulario();
      await propagar();

      controller.expectNone(ESCRITA_URL);
      expect(fixture.nativeElement.querySelector('ui-endereco-geo .field__error')).toBeNull();
      expect(elemento('input[formcontrolname="sigla"]').getAttribute('aria-invalid')).toBe('true');
    });

    it('uma falha geral depois da recusa do endereço não leva o foco a ela', async () => {
      await preencherNovoCampus();
      await enviarERecusar();
      expect(elemento('ui-endereco-geo .field__error')).toBeDefined();

      const salvar = elemento<HTMLButtonElement>('button[form="cfg-campus-form"]');
      salvar.focus();
      salvar.click();
      await propagar();
      controller.expectOne(ESCRITA_URL).flush(
        JSON.stringify({
          type: 'about:blank',
          title: 'Erro interno',
          status: 500,
          code: 'uniplus.erro_interno',
          traceId: 'test-trace',
        }),
        {
          status: 500,
          statusText: 'Server Error',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      await propagar();
      await propagar();

      expect(fixture.nativeElement.querySelector('ui-endereco-geo .field__error')).toBeNull();
      expect(document.activeElement).toBe(salvar);
    });

    it('com o endereço manual e a cidade editável, o foco vai ao campo da cidade', async () => {
      await preencherNovoCampus();
      edicao.form.controls.endereco.setValue({
        ...enderecoResolvido,
        cep: null,
        logradouro: 'Rua Sem CEP',
        origem: 'manual',
        nivelResolucao: null,
      });
      await propagar();
      await enviarERecusar();

      expect(document.activeElement?.closest('ui-valor-de-municipio')).not.toBeNull();
    });
  });

  describe('foco', () => {
    it('após a recusa, vai do botão de salvar ao primeiro campo recusado', async () => {
      await preencherNovoCampus();
      const salvar = elemento<HTMLButtonElement>('button[form="cfg-campus-form"]');
      salvar.focus();
      salvar.click();
      await propagar();
      recusar({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [
          {
            field: 'Sigla',
            code: 'uniplus.configuracao.campus.invalido',
            message: 'Sigla já cadastrada.',
          },
        ],
      });
      await propagar();
      await propagar();

      expect(document.activeElement).toBe(elemento('input[formcontrolname="sigla"]'));
    });

    it('após o sucesso, volta ao botão que abriu o drawer', async () => {
      const acionador = elemento<HTMLButtonElement>('.panel-head .btn--primary');
      acionador.focus();
      await preencherNovoCampus();
      elemento<HTMLButtonElement>('button[form="cfg-campus-form"]').focus();
      enviarFormulario();
      controller.expectOne(ESCRITA_URL).flush('novo-id', { status: 201, statusText: 'Created' });
      await propagar();
      await propagar();

      expect(edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(acionador);
      controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    });
  });
});
