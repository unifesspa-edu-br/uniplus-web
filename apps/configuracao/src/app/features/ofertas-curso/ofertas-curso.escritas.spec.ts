import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OfertaCursoFormularioComponent } from './oferta-curso-formulario.component';
import {
  ESCRITA,
  LISTA,
  Pagina,
  criado,
  identificador,
  montarPagina,
  oferta,
  problema,
  recusaDeCampos,
  sucesso,
} from './ofertas-curso.testing';

describe('OfertasCursoPage — escritas pela interface', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.encerrar());

  const drawer = (): HTMLDialogElement =>
    p.elemento('dialog[aria-label="Formulário de oferta de curso"]');
  const submeter = (): void => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const cancelarDoFormulario = (): HTMLButtonElement =>
    [...p.fixture.nativeElement.querySelectorAll('.form-drawer__footer button')].find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement;

  describe('gravação pendente', () => {
    it('deixa o formulário somente leitura, com foco no botão, sem fechar por Cancelar, X nem Esc', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      const botao = p.salvar();

      expect(p.campo('eMecCodigo').matches(':disabled')).toBe(true);
      expect(p.campo('cursoId').matches(':disabled')).toBe(true);
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(botao.textContent).toContain('Salvando...');
      expect(document.activeElement).toBe(botao);
      expect(drawer().querySelector('[role="status"]')?.textContent).toContain('Salvando');
      expect(
        drawer().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      expect(cancelarDoFormulario().matches(':disabled')).toBe(true);
      expect(
        p.fixture.nativeElement
          .querySelector('fieldset.cfg-oferta-turnos input')
          ?.matches(':disabled'),
      ).toBe(true);
      drawer().dispatchEvent(new Event('cancel', { cancelable: true }));
      await p.propagar();
      expect(p.edicao.aberto()).toBe(true);

      post.flush(...criado());
      await p.recarregarCom([oferta]);
      expect(p.edicao.aberto()).toBe(false);
    });

    it('clique e submissão repetidos não geram segundo envio', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      p.salvar().dispatchEvent(clique);
      submeter();
      await p.propagar();

      expect(clique.defaultPrevented).toBe(true);
      p.http.expectNone(ESCRITA);
      post.flush(...criado());
      await p.recarregarCom([oferta]);
    });

    it('a submissão repetida nem chega a pedir o salvamento ao formulário', async () => {
      await p.abrirCadastro();
      const pedidos: string[] = [];
      p.fixture.debugElement
        .query(By.directive(OfertaCursoFormularioComponent))
        .componentInstance.salvar.subscribe(() => pedidos.push('salvar'));
      const post = await p.enviar();
      expect(pedidos).toEqual(['salvar']);

      submeter();
      await p.propagar();

      expect(pedidos).toEqual(['salvar']);
      post.flush(...criado());
      await p.recarregarCom([oferta]);
    });

    it('o salvamento não se apresenta como remoção, nem durante a espera pela recarga', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      expect(p.edicao.salvando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-ofertas-curso-lista').textContent).not.toContain('Removendo');

      post.flush(...criado());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-ofertas-curso-lista').textContent).not.toContain('Removendo');
      await p.recarregarCom([oferta]);
    });

    it('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível', async () => {
      await p.abrirCadastro();
      p.campo('eMecCodigo').focus();
      submeter();
      await p.propagar();
      const post = p.http.expectOne(ESCRITA);

      expect(p.campo('eMecCodigo').matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(p.salvar());
      post.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      await p.propagar();

      expect(p.campo('eMecCodigo').matches(':disabled')).toBe(false);
      expect(p.elemento('ui-drawer ui-alert').textContent).toContain('Falha');
      expect(document.activeElement).toBe(p.salvar());
      expect(p.salvar().getAttribute('aria-disabled')).toBeNull();
      submeter();
      p.http.expectOne(ESCRITA).flush(...criado());
      await p.recarregarCom([oferta]);
    });

    it('outra edição não abre enquanto o envio corre', async () => {
      await p.abrirEdicao();
      p.preencher('eMecCodigo', '999999');
      const put = await p.enviar(`${ESCRITA}/${oferta.id}`);

      p.edicao.abrirCadastro();
      expect(p.edicao.modo()).toBe('editar');
      expect(p.campo('eMecCodigo').value).toBe('999999');

      put.flush(...sucesso());
      await p.recarregarCom([oferta]);
    });
  });

  describe('remoção pendente', () => {
    it('anuncia o andamento e deixa os acionadores indisponíveis, sem virar salvamento', async () => {
      const del = await p.confirmarRemocao();

      expect(p.edicao.removendo()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.elemento('.panel-head').textContent).toContain('Removendo');
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Removendo a oferta de curso ENG-CIV — Engenharia Civil.',
      );
      for (const botao of [p.novo(), p.editar(), p.remover()]) {
        expect(botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true').toBe(
          true,
        );
        botao.click();
      }
      await p.propagar();
      expect(p.edicao.aberto()).toBe(false);
      expect(p.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(p.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(p.confirmar());

      del.flush(...sucesso());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      await p.recarregarCom([]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.statusDaPagina()).toBe('Oferta de curso ENG-CIV — Engenharia Civil removida.');
      expect(p.novo().getAttribute('aria-disabled')).toBeNull();
    });

    it('não fecha por Cancelar, X nem Esc, e o segundo clique não envia', async () => {
      const del = await p.confirmarRemocao();
      const dialogo = p.elemento<HTMLDialogElement>('cfg-confirmacao-de-remocao dialog');

      expect(p.cancelarDaConfirmacao().matches(':disabled')).toBe(true);
      expect(
        dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar().click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(true);
      p.http.expectNone(`${ESCRITA}/${oferta.id}`);

      del.flush(...sucesso());
      await p.recarregarCom([]);
    });

    it('"Tentar novamente" fica indisponível com a leitura falha enquanto remove', async () => {
      const del = await p.confirmarRemocao();
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();

      const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      tentar.click();
      await p.propagar();
      p.http.expectNone((r) => r.url === LISTA);

      del.flush(...sucesso());
      await p.recarregarCom([]);
    });
  });

  describe('chamadas concorrentes', () => {
    it('salvar durante a gravação, remover durante o salvamento e salvar durante a remoção não geram requisição', async () => {
      await p.abrirCadastro();
      p.edicao.salvar();
      p.edicao.salvar();
      p.edicao.pedirRemocao(oferta);
      p.edicao.removerConfirmado();
      p.http.expectNone(`${ESCRITA}/${oferta.id}`);
      p.http.expectOne(ESCRITA).flush(...criado());
      await p.propagar();

      p.edicao.abrirCadastro();
      p.edicao.salvar();
      p.http.expectNone(ESCRITA);
      await p.recarregarCom([oferta]);

      p.edicao.pedirRemocao(oferta);
      p.edicao.removerConfirmado();
      p.edicao.salvar();
      p.http.expectNone(ESCRITA);
      p.http.expectOne(`${ESCRITA}/${oferta.id}`).flush(...sucesso());
      await p.recarregarCom([]);
    });

    it('durante o salvamento, fechar, abrir outra edição e pedir remoção não surtem efeito', async () => {
      await p.abrirEdicao();
      const put = await p.enviar(`${ESCRITA}/${oferta.id}`);

      p.edicao.fechar();
      p.edicao.abrirEdicao({ ...oferta, id: 'outra', eMecCodigo: '777' });
      p.edicao.pedirRemocao(oferta);

      expect(p.edicao.aberto()).toBe(true);
      expect(p.edicao.confirmando()).toBe(false);
      expect(p.edicao.form.controls.eMecCodigo.value).toBe(oferta.eMecCodigo);
      put.flush(...sucesso());
      await p.recarregarCom([oferta]);
    });

    it('confirmar sem ter pedido a remoção não envia nada', () => {
      p.edicao.removerConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE');
    });
  });

  describe('recarga depois da escrita', () => {
    it('mantém as ações indisponíveis até a lista refletir o que foi gravado', async () => {
      await p.abrirEdicao();
      (await p.enviar(`${ESCRITA}/${oferta.id}`)).flush(...sucesso());
      await p.propagar();

      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(p.editar().matches(':disabled')).toBe(true);
      await p.recarregarCom([oferta]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.editar().matches(':disabled')).toBe(false);
    });

    it.each(['salvar', 'remover'] as const)(
      'libera as ações e permite nova leitura se a recarga após %s falhar',
      async (operacao) => {
        if (operacao === 'salvar') {
          await p.abrirCadastro();
          (await p.enviar()).flush(...criado());
        } else {
          (await p.confirmarRemocao()).flush(...sucesso());
        }
        await p.propagar();
        p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
        await p.propagar();

        expect(p.edicao.gravando()).toBe(false);
        const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
        expect(tentar.getAttribute('aria-disabled')).toBeNull();
        tentar.click();
        await p.propagar();
        await p.recarregarCom([oferta]);
        expect(p.store.mensagemDeErro()).toBeNull();
      },
    );
  });

  describe('campo desabilitado por regra de negócio', () => {
    it('continua desabilitado depois do sucesso, e os demais seguem habilitados', async () => {
      await p.abrirCadastro();
      p.edicao.form.controls.codigoSga.disable();
      const post = await p.enviar();
      expect(p.campo('codigoSga').matches(':disabled')).toBe(true);
      post.flush(...criado());
      await p.recarregarCom([oferta]);

      expect(p.edicao.form.controls.codigoSga.disabled).toBe(true);
      expect(p.edicao.form.controls.eMecCodigo.enabled).toBe(true);
    });

    it('continua desabilitado depois da recusa do servidor', async () => {
      await p.abrirCadastro();
      p.edicao.form.controls.codigoSga.disable();
      (await p.enviar()).flush(
        ...recusaDeCampos({
          field: 'regimeDeFuncionamento',
          code: 'regime_de_funcionamento_invalido',
          message: 'Regime recusado.',
        }),
      );
      await p.propagar();

      expect(p.campo('codigoSga').matches(':disabled')).toBe(true);
      expect(p.campo('regimeDeFuncionamento').matches(':disabled')).toBe(false);
      expect(p.campo('regimeDeFuncionamento').getAttribute('aria-invalid')).toBe('true');
    });
  });

  it('reabrir o cadastro depois de um sucesso começa em branco', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...criado());
    await p.recarregarCom([oferta]);
    p.novo().click();
    await p.propagar();

    expect(p.edicao.form.controls.cursoId.value).toBe('');
  });

  describe('total depois da escrita', () => {
    const indicador = (): string | null =>
      p.fixture.nativeElement.querySelector('.list-count')?.textContent?.trim() ?? null;
    const paginacao = (): HTMLButtonElement[] => [
      ...p.fixture.nativeElement.querySelectorAll(
        'nav[aria-label="Paginação de ofertas de curso"] button',
      ),
    ];
    const carregarPrimeira = async (total: string, proxima: boolean): Promise<void> => {
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush([oferta], {
          headers: {
            'X-Total-Count': total,
            ...(proxima ? { Link: `<${LISTA}?cursor=p2&direction=next>; rel="next"` } : {}),
          },
        });
      await p.propagar();
    };

    it('após criar, consulta o total de novo e mostra o novo valor', async () => {
      await carregarPrimeira('1', false);
      await p.abrirCadastro();
      (await p.enviar()).flush(...criado());
      await p.propagar();

      expect(indicador()).toBe('Total de ofertas cadastradas: 1');
      const recarga = p.http.expectOne((r) => r.url === LISTA);
      expect(recarga.request.params.has('cursor')).toBe(false);
      expect(recarga.request.params.get('include_total')).toBe('true');
      recarga.flush([oferta, { ...oferta, id: 'b' }], { headers: { 'X-Total-Count': '2' } });
      await p.propagar();

      expect(indicador()).toBe('Total de ofertas cadastradas: 2');
    });

    it('após remover numa página adiante, volta ao início e mostra o novo total', async () => {
      await carregarPrimeira('2', true);
      paginacao()[1].click();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush([{ ...oferta, id: 'b' }]);
      await p.propagar();

      (await p.confirmarRemocao(identificador, 'b')).flush(...sucesso());
      await p.propagar();

      const recarga = p.http.expectOne((r) => r.url === LISTA);
      expect(recarga.request.params.has('cursor')).toBe(false);
      expect(recarga.request.params.get('include_total')).toBe('true');
      recarga.flush([oferta], { headers: { 'X-Total-Count': '1' } });
      await p.propagar();

      expect(indicador()).toBe('Total de ofertas cadastradas: 1');
    });
  });
});
