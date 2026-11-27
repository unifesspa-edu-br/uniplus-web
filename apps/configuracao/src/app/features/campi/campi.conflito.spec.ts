import { ESCRITA_URL, PaginaDeCampi } from './campi.testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** Escritas de campi atravessando os componentes da página: cliques e digitação, como o operador. */
describe('CampiPage — escritas pela interface', () => {
  let pagina: PaginaDeCampi;

  beforeEach(async () => {
    pagina = await PaginaDeCampi.montar();
  });

  afterEach(() => pagina.controller.verify());

  /** Recusa o envio em curso e devolve a chave de idempotência com que ele partiu. */
  function falhar(status: number, code: string, title: string): string | null {
    const envio = pagina.controller.expectOne(ESCRITA_URL);
    envio.flush(JSON.stringify({ type: 'about:blank', title, status, code }), {
      status,
      statusText: 'Conflict',
      headers: { 'content-type': 'application/problem+json' },
    });
    return envio.request.headers.get('Idempotency-Key');
  }

  const chaveDoEnvio = (): string | null =>
    pagina.controller.expectOne(ESCRITA_URL).request.headers.get('Idempotency-Key');

  describe('conflito (409) no salvamento', () => {
    it('sigla já cadastrada marca o campo da sigla, com aria-invalid', async () => {
      await pagina.preencherNovoCampus();
      pagina.enviarFormulario();
      falhar(
        409,
        'uniplus.configuracao.campus.sigla_ja_existe',
        'Já existe um campus com esta sigla',
      );
      await pagina.propagar();

      const campo = pagina.elemento('input[formcontrolname="sigla"]');
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(campo.closest('label')?.querySelector('.field__error')?.textContent?.trim()).toBe(
        'Já existe um campus com esta sigla',
      );
      expect(pagina.edicao.erro()).toBeNull();
    });

    it('processamento em curso mostra a mensagem em erro e reenvia com a mesma chave', async () => {
      await pagina.preencherNovoCampus();
      pagina.enviarFormulario();
      const primeira = falhar(
        409,
        'uniplus.idempotency.processing_conflict',
        'Requisição em processamento',
      );
      await pagina.propagar();

      expect(pagina.edicao.erro()).toBe('Requisição em processamento');
      expect(
        pagina.elemento('input[formcontrolname="sigla"]').getAttribute('aria-invalid'),
      ).toBeNull();
      pagina.enviarFormulario();
      await pagina.propagar();
      expect(primeira).not.toBeNull();
      expect(chaveDoEnvio()).toBe(primeira);
    });

    it('sigla já cadastrada renova a chave do próximo envio', async () => {
      await pagina.preencherNovoCampus();
      pagina.enviarFormulario();
      const primeira = falhar(409, 'uniplus.configuracao.campus.sigla_ja_existe', 'Já existe');
      await pagina.propagar();

      pagina.digitar('input[formcontrolname="sigla"]', 'OUTRA');
      pagina.enviarFormulario();
      await pagina.propagar();
      expect(chaveDoEnvio()).not.toBe(primeira);
    });
  });
});
