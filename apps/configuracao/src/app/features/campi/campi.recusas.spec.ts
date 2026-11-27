import {
  LISTA_URL,
  ESCRITA_URL,
  campusSeed,
  PaginaDeCampi,
  recusaDeValidacao,
  recusaDaSigla,
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

  it('recusa do servidor é mostrada no campo recusado', async () => {
    await pagina.preencherNovoCampus();
    pagina.enviarFormulario();
    pagina.recusar(recusaDaSigla);
    await pagina.propagar();

    const campo = pagina.elemento('input[formcontrolname="sigla"]').closest('label') as HTMLElement;
    expect(campo.querySelector('.field__error')?.textContent?.trim()).toBe('Sigla já cadastrada.');
    expect(pagina.elemento('input[formcontrolname="sigla"]').getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('reenviar sem editar o campo recusado volta a enviar o formulário à API', async () => {
    await pagina.preencherNovoCampus();
    pagina.enviarFormulario();
    pagina.recusar(recusaDaSigla);
    await pagina.propagar();

    pagina.enviarFormulario();
    await pagina.propagar();

    pagina.recusar(recusaDaSigla);
  });

  it('recusa do servidor sobre o endereço é mostrada no bloco do endereço', async () => {
    await pagina.preencherNovoCampus();
    pagina.enviarFormulario();
    pagina.recusar(recusaDaCidadeDoEndereco);
    await pagina.propagar();

    const erro = pagina.elemento('ui-endereco-geo .field__error');
    expect(erro.textContent?.trim()).toBe('A cidade não corresponde ao CEP informado.');
  });

  describe('campo desabilitado por regra de negócio', () => {
    it('continua desabilitado depois do sucesso, e os demais seguem habilitados no modelo', async () => {
      await pagina.preencherNovoCampus();
      pagina.edicao.form.controls.codigoEmec.disable();
      pagina.edicao.salvar();
      expect(pagina.edicao.form.controls.codigoEmec.disabled).toBe(true);
      expect(pagina.edicao.form.controls.sigla.enabled).toBe(true);

      pagina.controller.expectOne(ESCRITA_URL).flush('id', { status: 201, statusText: 'Created' });
      await pagina.propagar();

      expect(pagina.edicao.form.controls.codigoEmec.disabled).toBe(true);
      expect(pagina.edicao.form.controls.sigla.enabled).toBe(true);
      pagina.controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    });

    it('continua desabilitado depois da recusa do servidor', async () => {
      await pagina.preencherNovoCampus();
      pagina.edicao.form.controls.codigoEmec.disable();
      pagina.edicao.salvar();

      pagina.recusar(
        recusaDeValidacao('Sigla', 'uniplus.configuracao.campus.invalido', 'Recusado.'),
      );
      await pagina.propagar();

      expect(pagina.edicao.form.controls.codigoEmec.disabled).toBe(true);
      expect(pagina.edicao.form.controls.sigla.errors?.['backend']).toBeDefined();
    });
  });
});
