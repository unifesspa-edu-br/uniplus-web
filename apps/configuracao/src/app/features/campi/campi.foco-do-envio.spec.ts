import { ESCRITA_URL, enderecoResolvido, PaginaDeCampi } from './campi.testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** Escritas de campi atravessando os componentes da página: cliques e digitação, como o operador. */
describe('CampiPage — escritas pela interface', () => {
  let pagina: PaginaDeCampi;

  beforeEach(async () => {
    pagina = await PaginaDeCampi.montar();
  });

  afterEach(() => pagina.controller.verify());

  describe('foco ao enviar com Enter', () => {
    const campoNome = (): HTMLInputElement => pagina.elemento('input[formcontrolname="nome"]');
    const enviarComEnter = async (): Promise<void> => {
      campoNome().focus();
      pagina
        .elemento<HTMLFormElement>('#cfg-campus-form')
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await pagina.propagar();
    };

    it('com o envio em curso, leva o foco do campo ao botão de salvar', async () => {
      await pagina.preencherNovoCampus();
      await enviarComEnter();
      pagina.controller.expectOne(ESCRITA_URL);
      expect(campoNome().matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(pagina.elemento('button[form="cfg-campus-form"]'));
    });

    it('com o envio barrado pela validação, mantém o foco no campo', async () => {
      await pagina.preencherNovoCampus();
      pagina.edicao.form.controls.nome.setValue('');
      await enviarComEnter();
      pagina.controller.expectNone(ESCRITA_URL);
      expect(document.activeElement).toBe(campoNome());
    });
  });

  describe('envio barrado localmente', () => {
    const campoCep = (): HTMLInputElement =>
      pagina.elemento<HTMLInputElement>('ui-endereco-geo input[id$="-cep"]');
    const pendenciaDaCidade = (): boolean =>
      (pagina.fixture.nativeElement as HTMLElement).textContent?.includes('Selecione a cidade') ??
      false;

    async function enviarBarrado(): Promise<void> {
      pagina.elemento<HTMLButtonElement>('button[form="cfg-campus-form"]').focus();
      pagina.enviarFormulario();
      await pagina.propagar();
      await pagina.propagar();
      pagina.controller.expectNone(ESCRITA_URL);
    }

    it('leva o foco ao primeiro campo inválido', async () => {
      pagina.elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
      await pagina.propagar();
      pagina.digitar('input[formcontrolname="nome"]', 'Campus de Parauapebas');
      await enviarBarrado();
      expect(document.activeElement).toBe(pagina.elemento('input[formcontrolname="sigla"]'));
    });

    it('com o CEP pendente num cadastro novo, leva o foco ao CEP e não diz que falta a cidade', async () => {
      await pagina.abrirNovoCampus();
      pagina.digitar('ui-endereco-geo input[id$="-cep"]', '12345');
      await pagina.propagar();
      await enviarBarrado();
      expect(document.activeElement).toBe(campoCep());
      expect(pendenciaDaCidade()).toBe(false);
    });

    it('sem CEP, diz que falta a cidade e a mensagem sai da tela quando a cidade é preenchida', async () => {
      await pagina.abrirNovoCampus();
      await enviarBarrado();
      expect(pendenciaDaCidade()).toBe(true);

      pagina.edicao.form.controls.endereco.setValue(enderecoResolvido);
      await pagina.propagar();

      expect(pendenciaDaCidade()).toBe(false);
    });
  });
});
