import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BASE,
  PROBLEMA,
  PaginaDosModelos,
  URL,
  modelo,
  problema,
} from './modelos-formulario.escritas.testing';

describe('ModelosFormularioPage — escritas pela interface', () => {
  const pagina = new PaginaDosModelos();

  beforeEach(() => pagina.montar());
  afterEach(() => pagina.desmontar());

  describe('tipos de processo em falha', () => {
    const URL_DOS_TIPOS = `${BASE}/api/configuracao/tipos-processo`;

    async function carregarComTiposEmFalha(): Promise<void> {
      pagina.controller.expectOne((r) => r.url === URL).flush([modelo]);
      pagina.controller
        .expectOne((r) => r.url === URL_DOS_TIPOS)
        .flush(problema(500, 'uniplus.internal.unexpected', 'Erro interno'), {
          status: 500,
          statusText: 'Internal Server Error',
          headers: PROBLEMA,
        });
      await pagina.propagar();
    }

    it('a lista avisa que o filtro fica sem opções e a nova tentativa lê os tipos de novo', async () => {
      await carregarComTiposEmFalha();
      const texto = (pagina.fixture.nativeElement as HTMLElement).textContent;
      expect(texto).toContain('Tipos de processo não carregados');
      expect(texto).toContain('o filtro por tipo e o campo Tipo de processo não listam as opções');

      pagina.elemento<HTMLButtonElement>('ui-falha-de-leitura button').click();
      await pagina.propagar();
      pagina.controller
        .expectOne((r) => r.url === URL_DOS_TIPOS)
        .flush([{ id: '1', codigo: 'GRADUACAO', nome: 'Graduação' }]);
      await pagina.propagar();
      await pagina.propagar();

      expect((pagina.fixture.nativeElement as HTMLElement).textContent).not.toContain(
        'Tipos de processo não carregados',
      );
    });

    it('o drawer de criação traz a própria nova tentativa e leva o foco ao campo quando dá certo', async () => {
      await carregarComTiposEmFalha();
      pagina.elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
      await pagina.propagar();

      const botao = pagina.elemento<HTMLButtonElement>(
        'ui-drawer ui-falha-de-leitura-do-campo button',
      );
      botao.focus();
      botao.click();
      await pagina.propagar();
      pagina.controller
        .expectOne((r) => r.url === URL_DOS_TIPOS)
        .flush([{ id: '1', codigo: 'GRADUACAO', nome: 'Graduação' }]);
      await pagina.propagar();
      await pagina.propagar();

      expect(
        (pagina.fixture.nativeElement as HTMLElement).querySelector(
          'ui-drawer ui-falha-de-leitura-do-campo [role="alert"]',
        ),
      ).toBeNull();
      expect(document.activeElement).toBe(
        pagina.elemento('#cfg-modelo-criacao select[formcontrolname="tipoProcessoCodigo"]'),
      );
    });
  });

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    await pagina.carregar();
    await pagina.preencher();
    for (const campo of ['nome', 'codigo', 'finalidade']) {
      expect(
        pagina.elemento<HTMLElement>(`[formcontrolname="${campo}"]`).getAttribute('aria-required'),
      ).toBe('true');
    }
  });

  it('mantém os campos somente leitura, o foco e o drawer aberto enquanto cria', async () => {
    await pagina.carregar();
    await pagina.preencher();
    const botao = pagina.salvar();
    botao.focus();
    pagina.enviar();
    const post = pagina.controller.expectOne(URL);
    await pagina.propagar();
    expect(pagina.elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(
      true,
    );
    expect(
      pagina.elemento<HTMLInputElement>('input[formcontrolname="nome"]').matches(':disabled'),
    ).toBe(true);
    expect(pagina.edicao.form.controls.nome.value).toBe('Inscrição');
    expect(pagina.edicao.form.controls.nome.enabled).toBe(true);
    expect(pagina.edicao.salvando()).toBe(true);
    expect(
      pagina.elemento('dialog[aria-label="Novo modelo de formulário"] [role="status"]').textContent,
    ).toContain('Criando o modelo.');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.textContent).toContain('Criando...');
    expect(document.activeElement).toBe(botao);
    expect(
      pagina.elemento<HTMLButtonElement>('.form-drawer__footer button[type="button"]').disabled,
    ).toBe(true);
    const dialog = pagina.elemento<HTMLDialogElement>(
      'dialog[aria-label="Novo modelo de formulário"]',
    );
    expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    pagina.edicao.fechar(false);
    await pagina.propagar();
    expect(pagina.edicao.drawerAberto()).toBe(true);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await pagina.propagar();
    expect(pagina.edicao.drawerAberto()).toBe(false);
  });

  it('recusa clique e submit adicionais enquanto cria', async () => {
    await pagina.carregar();
    const criar = vi.spyOn(pagina.edicao, 'criar');
    await pagina.preencher();
    pagina.enviar();
    const post = pagina.controller.expectOne(URL);
    await pagina.propagar();
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    pagina.salvar().dispatchEvent(clique);
    expect(clique.defaultPrevented).toBe(true);
    pagina
      .elemento<HTMLFormElement>('#cfg-modelo-criacao')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await pagina.propagar();
    expect(criar).toHaveBeenCalledTimes(1);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
  });

  it('mostra a recusa do servidor e leva o foco ao campo recusado', async () => {
    await pagina.carregar();
    await pagina.preencher();
    pagina.enviar();
    await pagina.propagar();
    pagina.recusar();
    await pagina.propagar();
    await pagina.propagar();
    const nome = pagina.elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(nome.closest('label')?.querySelector('.field__error')?.textContent?.trim()).toBe(
      'Nome recusado.',
    );
    expect(document.activeElement).toBe(nome);
    expect(pagina.elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(
      false,
    );
    expect(
      pagina.elemento('dialog[aria-label="Novo modelo de formulário"] [role="status"]').textContent,
    ).toContain('Revise os campos indicados.');
  });

  it('reenviar sem editar o campo recusado volta a enviar o modelo à API', async () => {
    await pagina.carregar();
    await pagina.preencher();
    pagina.enviar();
    await pagina.propagar();
    pagina.recusar();
    await pagina.propagar();

    pagina.enviar();
    await pagina.propagar();

    pagina.recusar();
  });

  it('bloqueia criação e troca de situação concorrentes em ambos os sentidos', async () => {
    await pagina.carregar();
    await pagina.preencher();
    pagina.edicao.criar();
    pagina.edicao.criar();
    pagina.edicao.desativar(modelo);
    pagina.controller.expectNone(`${URL}/${modelo.id}`);
    pagina.recusar();
    await pagina.propagar();
    pagina.edicao.desativar(modelo);
    pagina.edicao.ativar(modelo);
    pagina.edicao.criar();
    pagina.controller.expectNone(URL);
    pagina.controller.expectNone(`${URL}/${modelo.id}/ativacao`);
    pagina.controller
      .expectOne(`${URL}/${modelo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    pagina.controller.expectOne((r) => r.url === URL).flush([modelo]);
  });

  it('não abre a criação enquanto uma troca de situação está pendente', async () => {
    await pagina.carregar();
    pagina.edicao.desativar(modelo);
    const requisicao = pagina.controller.expectOne(`${URL}/${modelo.id}`);

    pagina.edicao.abrirCriacao();

    expect(pagina.edicao.drawerAberto()).toBe(false);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    pagina.controller.expectOne((r) => r.url === URL).flush([modelo]);
  });

  it.each([true, false])(
    'bloqueia a lista e indica a troca de situação (ativo: %s)',
    async (ativo) => {
      await pagina.carregar();
      const codigo = ativo ? 'INSCRICAO' : 'INATIVO';
      const id = ativo ? modelo.id : 'modelo-2';
      pagina
        .elemento<HTMLButtonElement>(
          `[aria-label="${ativo ? 'Desativar' : 'Ativar'} o modelo ${codigo}"]`,
        )
        .click();
      const requisicao = pagina.controller.expectOne(
        ativo ? `${URL}/${id}` : `${URL}/${id}/ativacao`,
      );
      await pagina.propagar();
      expect(pagina.elemento('tbody').textContent).toContain(
        ativo ? 'Desativando...' : 'Ativando...',
      );
      expect(pagina.edicao.gravando()).toBe(true);
      expect(pagina.edicao.salvando()).toBe(false);
      const editar = pagina.elemento<HTMLAnchorElement>(`[aria-label="Editar o modelo ${codigo}"]`);
      expect(editar.getAttribute('aria-disabled')).toBe('true');
      expect(editar.getAttribute('href')).toBeNull();
      expect(
        editar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
      ).toBe(false);
      const novo = pagina.elemento<HTMLButtonElement>('.panel-head .btn--primary');
      expect(novo.getAttribute('aria-disabled')).toBe('true');
      novo.click();
      expect(pagina.edicao.drawerAberto()).toBe(false);
      expect(pagina.elemento<HTMLInputElement>('input[type="search"]').matches(':disabled')).toBe(
        true,
      );
      expect(pagina.elemento<HTMLButtonElement>('.filter-bar__alternar').matches(':disabled')).toBe(
        true,
      );
      expect(pagina.elemento<HTMLSelectElement>('.filter-bar select').matches(':disabled')).toBe(
        true,
      );
      const proximo = pagina.elemento<HTMLButtonElement>('ui-pager [data-pager="next"]');
      expect(proximo.getAttribute('aria-disabled')).toBe('true');
      proximo.click();
      pagina.controller.expectNone((r) => r.url === URL);
      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await pagina.propagar();
      pagina.controller.expectOne((r) => r.url === URL).flush([modelo]);
    },
  );

  it('anuncia o início e o fim da troca de situação em uma região de status', async () => {
    await pagina.carregar();
    pagina.edicao.desativar(modelo);
    const requisicao = pagina.controller.expectOne(`${URL}/${modelo.id}`);
    await pagina.propagar();
    const status = pagina.elemento<HTMLElement>('[role="status"]');
    expect(status.textContent).toContain('Desativando o modelo INSCRICAO.');
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    pagina.controller.expectOne((r) => r.url === URL).flush([modelo]);
    await pagina.propagar();
    expect(status.textContent).toContain('Modelo desativado: INSCRICAO.');
  });

  it('mantém as ações da lista indisponíveis até a lista recarregada chegar', async () => {
    await pagina.carregar();
    const desativar = (): HTMLButtonElement =>
      pagina.elemento('[aria-label="Desativar o modelo INSCRICAO"]');
    desativar().click();
    pagina.controller
      .expectOne(`${URL}/${modelo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    const recarga = pagina.controller.expectOne((r) => r.url === URL);
    await pagina.propagar();
    expect(desativar().disabled).toBe(true);
    desativar().click();
    pagina.controller.expectNone(`${URL}/${modelo.id}`);
    recarga.flush([{ ...modelo, ativo: false }]);
    await pagina.propagar();
  });
});
