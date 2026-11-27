import { LISTA_URL, ESCRITA_URL, campusSeed, PaginaDeCampi } from './campi.testing';
import {
  situacaoDoBotao,
  TEXTO_REPETIDA,
  TEXTO_TENTANDO,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Escritas de campi atravessando os componentes da página: cliques e digitação, como o operador. */
describe('CampiPage — escritas pela interface', () => {
  let pagina: PaginaDeCampi;

  beforeEach(async () => {
    pagina = await PaginaDeCampi.montar();
  });

  afterEach(() => pagina.controller.verify());

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    await pagina.preencherNovoCampus();
    for (const campo of ['sigla', 'nome']) {
      expect(
        pagina.elemento<HTMLElement>(`[formcontrolname="${campo}"]`).getAttribute('aria-required'),
      ).toBe('true');
    }
  });

  it('gravação pendente deixa o formulário somente leitura e impede fechar', async () => {
    await pagina.preencherNovoCampus();
    const salvar = pagina.elemento<HTMLButtonElement>('button[form="cfg-campus-form"]');
    salvar.focus();
    salvar.click();
    const post = pagina.controller.expectOne(ESCRITA_URL);
    await pagina.propagar();

    // Somente leitura: os valores ficam, os campos não aceitam edição e o foco segue no botão.
    expect(
      pagina.elemento<HTMLInputElement>('input[formcontrolname="sigla"]').matches(':disabled'),
    ).toBe(true);
    expect(pagina.elemento<HTMLInputElement>('input[formcontrolname="sigla"]').value).toBe(
      'PARAUAPEBAS',
    );
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    expect(salvar.getAttribute('aria-busy')).toBe('true');
    expect(salvar.textContent).toContain('Salvando...');
    expect(pagina.edicao.removendo()).toBe(false);
    expect(pagina.elemento('.panel-head').textContent).not.toContain('Removendo');
    expect(document.activeElement).toBe(salvar);
    // Cancelar, X e Esc ficam indisponíveis.
    expect(pagina.botao('.form-drawer__footer button', 'Cancelar').disabled).toBe(true);
    expect(
      pagina.drawerDoFormulario().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
        ?.disabled,
    ).toBe(true);
    pagina.drawerDoFormulario().dispatchEvent(new Event('cancel', { cancelable: true }));
    await pagina.propagar();
    expect(pagina.edicao.aberto()).toBe(true);

    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await pagina.propagar();
    expect(pagina.edicao.aberto()).toBe(false);
    pagina.controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
  });

  it('remoção pendente mostra "Removendo", indisponibiliza os acionadores e não vira salvamento', async () => {
    await pagina.pedirRemocao();
    const remocao = pagina.controller.expectOne(`${ESCRITA_URL}/${campusSeed.id}`);
    await pagina.propagar();

    expect(pagina.elemento('.panel-head').textContent).toContain('Removendo');
    expect(pagina.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent?.trim()).toBe(
      'Removendo o campus MARABA.',
    );
    const confirmar = pagina.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');
    expect(confirmar.getAttribute('aria-disabled')).toBe('true');
    expect(confirmar.getAttribute('aria-busy')).toBe('true');
    const dialogo = pagina.elemento<HTMLDialogElement>('cfg-confirmacao-de-remocao dialog');
    expect(dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    await pagina.propagar();
    expect(pagina.edicao.confirmando()).toBe(true);
    expect(
      pagina.elemento<HTMLElement>('cfg-confirmacao-de-remocao dialog').hasAttribute('open'),
    ).toBe(true);
    confirmar.click();
    pagina.controller.expectNone(`${ESCRITA_URL}/${campusSeed.id}`);
    expect(pagina.edicao.salvando()).toBe(false);
    expect(pagina.edicao.removendo()).toBe(true);
    expect(pagina.elemento('.panel-head .btn--primary').matches(':disabled')).toBe(true);
    expect(pagina.elemento('button[aria-label="Editar campus MARABA"]').matches(':disabled')).toBe(
      true,
    );
    expect(pagina.elemento('button[aria-label="Remover campus MARABA"]').matches(':disabled')).toBe(
      true,
    );

    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    pagina.controller.expectOne((r) => r.url === LISTA_URL).flush([]);
    await pagina.propagar();
    expect(pagina.elemento('.panel-head [role="status"]').textContent?.trim()).toBe(
      'Campus MARABA removido.',
    );
    expect(pagina.elemento('.panel-head .btn--primary').matches(':disabled')).toBe(false);
  });

  it('com remoção pendente e a listagem falhando, o "Tentar novamente" da página fica indisponível', async () => {
    await pagina.pedirRemocao();
    const remocao = pagina.controller.expectOne(`${ESCRITA_URL}/${campusSeed.id}`);
    pagina.store.recarregar();
    await pagina.propagar();
    pagina.controller
      .expectOne((r) => r.url === LISTA_URL)
      .flush(
        JSON.stringify({
          type: 'about:blank',
          title: 'Indisponível',
          status: 503,
          code: 'uniplus.internal.unexpected',
          traceId: 'test-trace',
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await pagina.propagar();

    const tentar = pagina.botao('ui-alert button', 'Tentar novamente');
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    tentar.click();
    await pagina.propagar();
    pagina.controller.expectNone((r) => r.url === LISTA_URL);

    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    pagina.controller.expectOne((r) => r.url === LISTA_URL).flush([]);
    await pagina.propagar();
  });

  it('a nova tentativa da listagem mostra o andamento no alerta e, ao falhar de novo, a falha repetida', async () => {
    pagina.store.recarregar();
    await pagina.propagar();
    const falhar = async (): Promise<void> => {
      pagina.controller
        .expectOne((r) => r.url === LISTA_URL)
        .flush(
          JSON.stringify({
            type: 'about:blank',
            title: 'Indisponível',
            status: 503,
            code: 'uniplus.internal.unexpected',
            traceId: 'test-trace',
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'content-type': 'application/problem+json' },
          },
        );
      await pagina.propagar();
    };
    await falhar();
    const tentar = pagina.botao('ui-alert button', 'Tentar novamente');

    tentar.click();
    await pagina.propagar();
    expect(situacaoDoBotao(tentar)).toBe(TEXTO_TENTANDO);
    await falhar();

    expect(situacaoDoBotao(tentar)).toBe(TEXTO_REPETIDA);
  });

  describe('trava da classe de edição contra chamadas concorrentes', () => {
    it('uma segunda submissão não parte enquanto a primeira corre', async () => {
      await pagina.preencherNovoCampus();
      pagina.edicao.salvar();
      pagina.edicao.salvar();

      pagina.controller.expectOne(ESCRITA_URL).flush('id', { status: 201, statusText: 'Created' });
      await pagina.propagar();
      pagina.controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    });

    it('a remoção não parte enquanto uma gravação corre', async () => {
      await pagina.preencherNovoCampus();
      pagina.edicao.salvar();
      pagina.edicao.pedirRemocao(campusSeed);
      pagina.edicao.removerConfirmado();

      pagina.controller.expectNone(`${ESCRITA_URL}/${campusSeed.id}`);
      pagina.controller.expectOne(ESCRITA_URL).flush('id', { status: 201, statusText: 'Created' });
      await pagina.propagar();
      pagina.controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    });

    it('a submissão não parte enquanto uma remoção corre', async () => {
      pagina.edicao.pedirRemocao(campusSeed);
      pagina.edicao.removerConfirmado();
      await pagina.preencherNovoCampus();
      pagina.edicao.salvar();

      pagina.controller.expectNone(ESCRITA_URL);
      pagina.controller
        .expectOne(`${ESCRITA_URL}/${campusSeed.id}`)
        .flush(null, { status: 204, statusText: 'No Content' });
      await pagina.propagar();
      pagina.controller.expectOne((r) => r.url === LISTA_URL).flush([]);
    });
  });

  /** Recusa o envio em curso e devolve a chave de idempotência com que ele partiu. */
  describe('ativação enquanto o envio corre', () => {
    it('clique e envio do formulário não chamam salvar de novo', async () => {
      const salvarDaClasse = vi.spyOn(pagina.edicao, 'salvar');
      await pagina.preencherNovoCampus();
      pagina.enviarFormulario();
      const post = pagina.controller.expectOne(ESCRITA_URL);
      await pagina.propagar();

      pagina.enviarFormulario();
      pagina
        .elemento<HTMLFormElement>('#cfg-campus-form')
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await pagina.propagar();

      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      pagina.elemento<HTMLButtonElement>('button[form="cfg-campus-form"]').dispatchEvent(clique);
      expect(clique.defaultPrevented).toBe(true);

      expect(salvarDaClasse).toHaveBeenCalledTimes(1);
      post.flush('novo-id', { status: 201, statusText: 'Created' });
      await pagina.propagar();
      pagina.controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    });
  });
});
