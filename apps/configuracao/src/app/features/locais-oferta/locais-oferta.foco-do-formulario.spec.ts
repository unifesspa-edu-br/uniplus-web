import { TipoLocalOfertaCodigo } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CAMPI,
  ENDERECO_RESOLVIDO,
  ESCRITA,
  PaginaDeLocais,
  abrirCadastroComCampi,
  abrirCadastroPreenchido,
  clicarEmNovoLocal,
  enviarComFocoNoSalvar,
  indisponivel,
  mensagemDoEndereco,
  montarPaginaComListaCarregada,
  raizDa,
  recusarCampoDoFormulario,
} from './locais-oferta.pagina.testing';

describe('Foco e mensagens do formulário de locais de oferta', () => {
  let pagina: PaginaDeLocais;

  beforeEach(async () => {
    pagina = await montarPaginaComListaCarregada();
  });
  afterEach(() => pagina.controller.verify());

  const campoCep = (): HTMLInputElement =>
    pagina.elemento<HTMLInputElement>('ui-endereco-geo input[id$="-cep"]');

  it('mantém controle desabilitado por regra após recusa e foca o campo recusado', async () => {
    const { edicao, elemento, propagar } = pagina;
    await abrirCadastroPreenchido(pagina);
    edicao.form.controls.campusResponsavelId.disable();
    enviarComFocoNoSalvar(pagina);
    await propagar();
    recusarCampoDoFormulario(
      pagina,
      'CodigoEmec',
      'uniplus.configuracao.local.codigo_invalido',
      'Código inválido.',
    );
    await propagar();
    await propagar();
    const campo = elemento<HTMLInputElement>('input[formcontrolname="codigoEmec"]');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.closest('label')?.textContent).toContain('Código inválido.');
    expect(document.activeElement).toBe(campo);
    expect(indisponivel(pagina, 'select[formcontrolname="campusResponsavelId"]')).toBe(true);
    expect(indisponivel(pagina, 'input[formcontrolname="codigoEmec"]')).toBe(false);
    expect(indisponivel(pagina, 'select[formcontrolname="tipo"]')).toBe(false);
  });

  it('apresenta a recusa do campus associado ao select e move o foco', async () => {
    const { elemento, propagar } = pagina;
    await abrirCadastroPreenchido(pagina);
    enviarComFocoNoSalvar(pagina);
    await propagar();
    recusarCampoDoFormulario(
      pagina,
      'CampusResponsavelId',
      'uniplus.configuracao.local.campus_invalido',
      'Campus inválido.',
    );
    await propagar();
    await propagar();
    const campo = elemento<HTMLSelectElement>('select[formcontrolname="campusResponsavelId"]');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    const mensagem = elemento<HTMLElement>('#' + campo.getAttribute('aria-describedby'));
    expect(mensagem.textContent).toContain('Campus inválido.');
    expect(document.activeElement).toBe(campo);
  });

  describe('envio barrado por CEP pendente', () => {
    async function trocarCepEEnviar(cep: string): Promise<void> {
      await abrirCadastroPreenchido(pagina);
      const trocar = [
        ...raizDa(pagina).querySelectorAll<HTMLButtonElement>('ui-endereco-geo button'),
      ].find((b) => b.textContent?.includes('Trocar CEP'));
      trocar?.click();
      await pagina.propagar();
      campoCep().value = cep;
      campoCep().dispatchEvent(new Event('input'));
      await pagina.propagar();
    }

    it('com o CEP incompleto, leva o foco ao campo do CEP', async () => {
      await trocarCepEEnviar('12345');
      enviarComFocoNoSalvar(pagina);
      await pagina.propagar();
      await pagina.propagar();
      pagina.controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campoCep());
    });

    const recusarBuscasDeCep = (): void =>
      pagina.controller
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
      enviarComFocoNoSalvar(pagina);
      await pagina.propagar();
      recusarBuscasDeCep();
      await pagina.propagar();
      enviarComFocoNoSalvar(pagina);
      await pagina.propagar();
      await pagina.propagar();
      recusarBuscasDeCep();
      pagina.controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campoCep());
    });
  });

  describe('falha ao carregar os campi do formulário', () => {
    const CAMPI_DO_FORMULARIO = (r: { url: string }): boolean => r.url === CAMPI;
    const tentar = (): HTMLButtonElement | null =>
      raizDa(pagina).querySelector<HTMLButtonElement>('button.link-button');

    it('a nova tentativa dos campi que dá certo leva o foco ao campo Campus responsável', async () => {
      clicarEmNovoLocal(pagina);
      await pagina.propagar();
      pagina.controller
        .expectOne(CAMPI_DO_FORMULARIO)
        .flush(null, { status: 500, statusText: 'Server Error' });
      await pagina.propagar();

      tentar()?.focus();
      tentar()?.click();
      await pagina.propagar();

      pagina.controller.expectOne(CAMPI_DO_FORMULARIO).flush([]);
      await pagina.propagar();
      await pagina.propagar();

      expect(tentar()).toBeNull();
      expect(document.activeElement).toBe(
        pagina.elemento('select[formcontrolname="campusResponsavelId"]'),
      );
    });
  });

  describe('envio barrado localmente com o endereço em branco', () => {
    const pendenciaDaCidade = (): boolean =>
      raizDa(pagina).textContent?.includes('Selecione a cidade') ?? false;

    async function abrirEmBranco(tipo: TipoLocalOfertaCodigo | null): Promise<void> {
      await abrirCadastroComCampi(pagina);
      pagina.edicao.form.controls.tipo.setValue(tipo);
      await pagina.propagar();
    }
    async function enviarBarrado(): Promise<void> {
      enviarComFocoNoSalvar(pagina);
      await pagina.propagar();
      await pagina.propagar();
      pagina.controller.expectNone(ESCRITA);
    }

    it('leva o foco ao primeiro campo inválido', async () => {
      await abrirEmBranco(null);
      await enviarBarrado();
      expect(document.activeElement).toBe(pagina.elemento('select[formcontrolname="tipo"]'));
    });

    it('com o CEP pendente num cadastro novo, leva o foco ao CEP e não diz que falta a cidade', async () => {
      await abrirEmBranco(TipoLocalOfertaCodigo.POLO_DE_EDUCACAO_A_DISTANCIA);
      campoCep().value = '12345';
      campoCep().dispatchEvent(new Event('input'));
      await pagina.propagar();
      await enviarBarrado();
      expect(document.activeElement).toBe(campoCep());
      expect(pendenciaDaCidade()).toBe(false);
    });

    it('sem CEP, diz que falta a cidade e a mensagem sai da tela quando a cidade é preenchida', async () => {
      await abrirEmBranco(TipoLocalOfertaCodigo.POLO_DE_EDUCACAO_A_DISTANCIA);
      await enviarBarrado();
      expect(pendenciaDaCidade()).toBe(true);

      pagina.edicao.form.controls.endereco.setValue(ENDERECO_RESOLVIDO);
      await pagina.propagar();

      expect(pendenciaDaCidade()).toBe(false);
    });
  });

  it('no endereço manual sem UF, leva o foco à mensagem da recusa do endereço', async () => {
    const { edicao, controller, propagar } = pagina;
    await abrirCadastroPreenchido(pagina);
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
    enviarComFocoNoSalvar(pagina);
    await propagar();
    await propagar();
    controller.expectNone(ESCRITA);
    expect(document.activeElement).toBe(mensagemDoEndereco(pagina));
  });

  it('comunica que a cidade é obrigatória no preenchimento manual', async () => {
    await abrirCadastroPreenchido(pagina);
    pagina.elemento<HTMLButtonElement>('ui-endereco-geo .endereco-geo__link').click();
    await pagina.propagar();
    const cidade = pagina.elemento<HTMLInputElement>('ui-valor-de-municipio input');
    expect(cidade.getAttribute('aria-required')).toBe('true');
  });
});
