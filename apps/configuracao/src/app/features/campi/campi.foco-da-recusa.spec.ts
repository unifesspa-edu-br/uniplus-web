import {
  LISTA_URL,
  ESCRITA_URL,
  campusSeed,
  enderecoResolvido,
  PaginaDeCampi,
  recusaDeValidacao,
  recusaDaCidadeDoEndereco,
} from './campi.testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** Escritas de campi atravessando os componentes da página: cliques e digitação, como o operador. */
describe('CampiPage — escritas pela interface', () => {
  let pagina: PaginaDeCampi;

  beforeEach(async () => {
    pagina = await PaginaDeCampi.montar();
  });

  afterEach(() => pagina.controller.verify());

  describe('recusa só do endereço', () => {
    async function enviarERecusar(): Promise<void> {
      const salvar = pagina.elemento<HTMLButtonElement>('button[form="cfg-campus-form"]');
      salvar.focus();
      salvar.click();
      await pagina.propagar();
      pagina.recusar(recusaDaCidadeDoEndereco);
      await pagina.propagar();
      await pagina.propagar();
    }

    it('com o endereço resolvido por CEP, o foco vai à mensagem da recusa', async () => {
      await pagina.preencherNovoCampus();
      await enviarERecusar();

      const mensagem = pagina.elemento('ui-endereco-geo .field__error');
      expect(document.activeElement).toBe(mensagem);
      expect(pagina.elemento('ui-endereco-geo fieldset').getAttribute('aria-describedby')).toBe(
        mensagem.id,
      );
    });

    it('um novo envio barrado localmente não mantém a recusa antiga do endereço', async () => {
      await pagina.preencherNovoCampus();
      await enviarERecusar();
      expect(
        pagina.fixture.nativeElement.querySelector('ui-endereco-geo .field__error'),
      ).not.toBeNull();

      pagina.digitar('input[formcontrolname="sigla"]', '');
      pagina.enviarFormulario();
      await pagina.propagar();

      pagina.controller.expectNone(ESCRITA_URL);
      expect(
        pagina.fixture.nativeElement.querySelector('ui-endereco-geo .field__error'),
      ).toBeNull();
      expect(pagina.elemento('input[formcontrolname="sigla"]').getAttribute('aria-invalid')).toBe(
        'true',
      );
    });

    it('uma falha geral depois da recusa do endereço não leva o foco a ela', async () => {
      await pagina.preencherNovoCampus();
      await enviarERecusar();
      expect(pagina.elemento('ui-endereco-geo .field__error')).toBeDefined();

      const salvar = pagina.elemento<HTMLButtonElement>('button[form="cfg-campus-form"]');
      salvar.focus();
      salvar.click();
      await pagina.propagar();
      pagina.controller.expectOne(ESCRITA_URL).flush(
        JSON.stringify({
          type: 'about:blank',
          title: 'Erro interno',
          status: 500,
          code: 'uniplus.internal.unexpected',
          traceId: 'test-trace',
        }),
        {
          status: 500,
          statusText: 'Server Error',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      await pagina.propagar();
      await pagina.propagar();

      expect(
        pagina.fixture.nativeElement.querySelector('ui-endereco-geo .field__error'),
      ).toBeNull();
      expect(document.activeElement).toBe(salvar);
    });

    it('com o endereço manual e a cidade editável, o foco vai ao campo da cidade', async () => {
      await pagina.preencherNovoCampus();
      pagina.edicao.form.controls.endereco.setValue({
        ...enderecoResolvido,
        cep: null,
        logradouro: 'Rua Sem CEP',
        origem: 'manual',
        nivelResolucao: null,
      });
      await pagina.propagar();
      await enviarERecusar();

      expect(document.activeElement?.closest('ui-valor-de-municipio')).not.toBeNull();
    });
  });

  describe('foco', () => {
    it('após a recusa, vai do botão de salvar ao primeiro campo recusado', async () => {
      await pagina.preencherNovoCampus();
      const salvar = pagina.elemento<HTMLButtonElement>('button[form="cfg-campus-form"]');
      salvar.focus();
      salvar.click();
      await pagina.propagar();
      pagina.recusar(
        recusaDeValidacao('Sigla', 'uniplus.configuracao.campus.invalido', 'Sigla já cadastrada.'),
      );
      await pagina.propagar();
      await pagina.propagar();

      expect(document.activeElement).toBe(pagina.elemento('input[formcontrolname="sigla"]'));
    });

    it('após o sucesso, volta ao botão que abriu o drawer', async () => {
      const acionador = pagina.elemento<HTMLButtonElement>('.panel-head .btn--primary');
      acionador.focus();
      await pagina.preencherNovoCampus();
      pagina.elemento<HTMLButtonElement>('button[form="cfg-campus-form"]').focus();
      pagina.enviarFormulario();
      pagina.controller
        .expectOne(ESCRITA_URL)
        .flush('novo-id', { status: 201, statusText: 'Created' });
      await pagina.propagar();
      await pagina.propagar();

      expect(pagina.edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(acionador);
      pagina.controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    });
  });
});
