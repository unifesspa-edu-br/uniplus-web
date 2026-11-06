import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  Pagina,
  TITULO_DA_LISTA,
  criado,
  montarPagina,
  problema,
  prova,
  recusaDeCampo,
  sucesso,
} from './tipos-etapa.testing';

const PROCESSANDO = { code: 'uniplus.idempotency.processing_conflict', title: 'Em processamento' };
const NOTA_DO_ENEM = {
  code: 'uniplus.configuracao.tipo_etapa.nota_de_origem_no_enem_nao_desativa',
  title: 'Tipo de etapa com nota de origem no ENEM não pode ser desativado',
};

describe('TiposEtapaPage — recusas do servidor', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.http.verify());

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alertaDoDrawer = (): HTMLElement => p.elemento('ui-drawer ui-alert');

  describe('ao salvar', () => {
    it.each([
      ['Nome', 'input', 'nome', null],
      ['Descricao', 'textarea', 'descricao', 'cfg-etapa-descricao-erro'],
      ['AdmitePontuacao', 'input', 'admitePontuacao', 'cfg-etapa-pontuacao-erro'],
      ['AdmiteEliminacao', 'input', 'admiteEliminacao', 'cfg-etapa-eliminacao-erro'],
    ] as const)(
      'mostra a recusa de %s no campo, associada e focada',
      async (campo, tag, nome, id) => {
        await p.abrirCadastro();
        (await p.enviar()).flush(...recusaDeCampo(campo, 'Valor recusado.'));
        await p.propagar();
        await p.propagar();

        const controle = p.elemento<HTMLElement>(`${tag}[formcontrolname="${nome}"]`);
        expect(controle.getAttribute('aria-invalid')).toBe('true');
        expect(controle.closest('.field')?.classList.contains('is-error')).toBe(true);
        expect(
          controle.closest('.field')?.querySelector('.field__error')?.textContent?.trim(),
        ).toBe('Valor recusado.');
        if (id !== null) {
          expect(controle.getAttribute('aria-describedby')?.split(' ')).toContain(id);
        }
        expect(document.activeElement).toBe(controle);
        expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
        expect(p.erros).not.toHaveBeenCalled();
      },
    );

    it('recusa de caráter não impede corrigir outro campo e reenviar', async () => {
      await p.abrirCadastro();
      p.campo('admitePontuacao').click();
      p.campo('admiteEliminacao').click();
      (await p.enviar()).flush(...recusaDeCampo('AdmitePontuacao', 'Admita ao menos um caráter.'));
      await p.propagar();
      await p.propagar();
      expect(p.campo('admitePontuacao').getAttribute('aria-invalid')).toBe('true');

      p.campo('admiteEliminacao').click();
      await p.propagar();

      (await p.enviar()).flush(...criado());
      await p.recarregarCom([prova]);
      expect(p.edicao.aberto()).toBe(false);
    });

    it('recusa seguida de sucesso: o reenvio usa chave nova, fecha e devolve o foco', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...recusaDeCampo('Nome', 'Nome longo.'));
      await p.propagar();
      await p.propagar();
      p.preencher('nome', 'Nome revisado');

      const segunda = await p.enviar();
      expect(chaveDe(segunda)).not.toBe(chave);
      segunda.flush(...criado());
      await p.recarregarCom([prova]);

      expect(p.edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(p.novo());
    });

    it('código já reservado marca o campo, renova a chave e não avisa por toast', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(
        ...problema(409, {
          code: 'uniplus.configuracao.tipo_etapa.codigo_ja_existe',
          title: 'Código do tipo de etapa já está reservado',
        }),
      );
      await p.propagar();
      await p.propagar();

      const codigo = p.campo('codigo');
      expect(codigo.getAttribute('aria-invalid')).toBe('true');
      expect(codigo.closest('.field')?.querySelector('.field__error')?.textContent).toContain(
        'reservado',
      );
      expect(document.activeElement).toBe(codigo);
      expect(p.edicao.erro()).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
      p.preencher('codigo', 'OUTRO_CODIGO');
      expect(chaveDe(await p.enviar())).not.toBe(chave);
      p.http.expectNone(ESCRITA);
    });

    it('conflito de processamento mantém a chave e mostra a mensagem no alerta, sem marcar campo', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...problema(409, PROCESSANDO));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Em processamento');
      expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
      const segunda = await p.enviar();
      expect(chaveDe(segunda)).toBe(chave);
      segunda.flush(...criado());
      await p.recarregarCom([prova]);
    });

    it('corpo divergente da chave vai ao alerta e renova a chave', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(
        ...problema(422, { code: 'uniplus.idempotency.body_mismatch', title: 'Corpo divergente' }),
      );
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Corpo divergente');
      expect(chaveDe(await p.enviar())).not.toBe(chave);
    });

    it('tipo não encontrado na edição vai ao alerta, sem toast', async () => {
      await p.abrirEdicao(prova);
      (await p.enviar(`${ESCRITA}/${prova.id}`)).flush(
        ...problema(404, { code: 'uniplus.configuracao.tipo_etapa.nao_encontrado' }),
      );
      await p.propagar();

      expect(alertaDoDrawer()).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('falha 5xx vai ao alerta, avisa por toast e mantém a chave para o reenvio', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...problema(500, { code: 'uniplus.erro_interno' }));
      await p.propagar();

      expect(alertaDoDrawer()).toBeTruthy();
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(chaveDe(await p.enviar())).toBe(chave);
    });

    it('um novo envio, ainda que barrado pela validação, retira a recusa anterior da tela', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...problema(500, { code: 'uniplus.erro_interno' }));
      await p.propagar();
      expect(alertaDoDrawer()).toBeTruthy();

      p.preencher('codigo', '');
      p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert')).toBeNull();
      p.http.expectNone(ESCRITA);
    });

    it('envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
      await p.abrirCadastro();
      p.preencher('codigo', '');
      p.salvar().focus();
      p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
      await p.propagar();
      await p.propagar();

      p.http.expectNone(ESCRITA);
      expect(document.activeElement).toBe(p.campo('codigo'));
      expect(p.campo('codigo').getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('ao desativar', () => {
    const lerMensagem = (): string | undefined =>
      p.elemento('cfg-confirmacao-de-remocao .field__error').textContent?.trim();

    it('recusa de negócio (422) mantém o diálogo, a mensagem e o foco no botão, sem toast', async () => {
      const primeira = await p.confirmarDesativacao(prova);
      primeira.flush(...problema(422, NOTA_DO_ENEM));
      await p.propagar();

      expect(lerMensagem()).toBe(NOTA_DO_ENEM.title);
      expect(p.edicao.confirmando()).toBe(true);
      expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(document.activeElement).toBe(p.confirmar());
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Não foi possível desativar o tipo de etapa PROVA.',
      );
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.sucessos).not.toHaveBeenCalled();

      p.confirmar().click();
      await p.propagar();
      p.http.expectOne(`${ESCRITA}/${prova.id}`).flush(...sucesso());
      await p.recarregarCom([]);
      expect(p.edicao.confirmando()).toBe(false);
    });

    it('falha 5xx mantém o diálogo com a mensagem, avisa por toast e aceita nova tentativa', async () => {
      (await p.confirmarDesativacao(prova)).flush(
        ...problema(500, { code: 'uniplus.erro_interno' }),
      );
      await p.propagar();

      expect(lerMensagem()).toBe('Falha');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.confirmar());
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.desativar(prova));
    });
  });

  describe('foco depois da escrita', () => {
    it('edição concluída com a linha na recarga devolve o foco ao botão de editar', async () => {
      await p.abrirEdicao(prova);
      (await p.enviar(`${ESCRITA}/${prova.id}`)).flush(...sucesso());
      await p.recarregarCom([prova]);
      expect(document.activeElement).toBe(p.editar(prova));
    });

    it('cancelar a edição devolve o foco ao botão que abriu o drawer', async () => {
      await p.abrirEdicao(prova);
      p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
      await p.propagar();
      expect(document.activeElement).toBe(p.editar(prova));
    });

    it('desativação concluída leva o foco ao título quando a linha some da recarga', async () => {
      (await p.confirmarDesativacao(prova)).flush(...sucesso());
      await p.recarregarCom([]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('desativação concluída leva o foco ao título quando a linha segue inativa, sem o botão', async () => {
      (await p.confirmarDesativacao(prova)).flush(...sucesso());
      await p.recarregarCom([{ ...prova, ativo: false }]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('escrita com falha na recarga leva o foco ao título da lista', async () => {
      (await p.confirmarDesativacao(prova)).flush(...sucesso());
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('cancelar a confirmação devolve o foco ao botão de desativar da linha', async () => {
      p.desativar(prova).focus();
      p.desativar(prova).click();
      await p.propagar();
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.desativar(prova));
    });
  });

  describe('falha de leitura', () => {
    it('5xx avisa por toast e oferece "Tentar novamente", que devolve o foco ao título', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();
      expect(p.erros).toHaveBeenCalledTimes(1);

      const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      expect(tentar.getAttribute('aria-busy')).toBe('true');
      await p.recarregarCom([prova]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('4xx mostra o alerta sem toast', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(403, { code: 'uniplus.proibido' }));
      await p.propagar();
      expect(p.elemento('ui-alert .list-state__retry button')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });
  });
});
