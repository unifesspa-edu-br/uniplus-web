import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LISTA,
  Pagina,
  TITULO_DA_LISTA,
  criado,
  montarPagina,
  problema,
  recusaDeCampo,
  sisu,
  sucesso,
  vestibular,
} from './tipos-processo.testing';

const PROCESSANDO = { code: 'uniplus.idempotency.processing_conflict', title: 'Em processamento' };
const CONCORRENCIA = {
  code: 'uniplus.configuracao.tipo_processo.conflito_de_concorrencia',
  title: 'Tipo de processo seletivo alterado concorrentemente',
};
const CONCORRENCIA_NA_REMOCAO = {
  code: 'uniplus.concorrencia.conflito',
  title: 'Conflito de concorrência',
};
const JA_DESATIVADO = {
  code: 'uniplus.configuracao.tipo_processo.ja_desativado',
  title: 'Tipo de processo seletivo já está desativado',
};
const JA_ATIVO = {
  code: 'uniplus.configuracao.tipo_processo.ja_ativo',
  title: 'Tipo de processo seletivo já está ativo',
};
const CODIGO_JA_EXISTE = {
  code: 'uniplus.configuracao.tipo_processo.codigo_ja_existe',
  title: 'Código do tipo de processo seletivo já está reservado',
};

describe('TiposProcessoPage — recusas do servidor', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.http.verify());

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alertaDoDrawer = (): HTMLElement => p.elemento('ui-drawer ui-alert');
  const urlDaAtivacao = `${LISTA}/${vestibular.id}/ativacao`;

  describe('ao salvar', () => {
    it.each([
      ['Nome', 'input', 'nome', 'cfg-tproc-nome-erro'],
      ['Codigo', 'input', 'codigo', 'cfg-tproc-codigo-erro'],
      ['Descricao', 'textarea', 'descricao', 'cfg-tproc-descricao-erro'],
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
        expect(p.elemento(`#${id}`).textContent?.trim()).toBe('Valor recusado.');
        expect(controle.getAttribute('aria-describedby')?.split(' ')).toContain(id);
        expect(document.activeElement).toBe(controle);
        expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
        expect(p.erros).not.toHaveBeenCalled();
      },
    );

    it('orienta o formato do código inválido sem enviar', async () => {
      await p.abrirCadastro();
      p.preencher('codigo', '1A');
      p.salvar().focus();
      p.salvar().click();
      await p.propagar();
      await p.propagar();

      p.http.expectNone((r) => r.method === 'POST');
      expect(p.campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(p.elemento('#cfg-tproc-codigo-erro').textContent).toContain(
        'Use caixa alta, começando por letra',
      );
      expect(document.activeElement).toBe(p.campo('codigo'));
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
      await p.recarregarCom([sisu]);

      expect(p.edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(p.novo());
    });

    it('código já reservado marca o campo, renova a chave e não avisa por toast', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...problema(409, CODIGO_JA_EXISTE));
      await p.propagar();
      await p.propagar();

      const codigo = p.campo('codigo');
      expect(codigo.getAttribute('aria-invalid')).toBe('true');
      expect(p.elemento('#cfg-tproc-codigo-erro').textContent).toContain('já está reservado');
      expect(document.activeElement).toBe(codigo);
      expect(p.edicao.erro()).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
      p.preencher('codigo', 'OUTRO_CODIGO');
      expect(chaveDe(await p.enviar())).not.toBe(chave);
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
      await p.recarregarCom([sisu]);
    });

    it('conflito de concorrência na edição vai ao alerta, sem marcar campo nem avisar por toast', async () => {
      await p.abrirEdicao(sisu);
      (await p.enviar(`${LISTA}/${sisu.id}`)).flush(...problema(409, CONCORRENCIA));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain(CONCORRENCIA.title);
      expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
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
      await p.abrirEdicao(sisu);
      (await p.enviar(`${LISTA}/${sisu.id}`)).flush(
        ...problema(404, { code: 'uniplus.configuracao.tipo_processo.nao_encontrado' }),
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

      p.preencher('nome', '');
      p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert')).toBeNull();
      p.http.expectNone((r) => r.method === 'POST');
    });

    it('envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
      await p.abrirCadastro();
      p.preencher('nome', '');
      p.preencher('codigo', '');
      p.salvar().focus();
      p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
      await p.propagar();
      await p.propagar();

      p.http.expectNone((r) => r.method === 'POST');
      expect(document.activeElement).toBe(p.campo('codigo'));
      expect(p.campo('codigo').getAttribute('aria-invalid')).toBe('true');
    });

    it('a recusa do servidor vale só para o envio que a causou', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('Nome', 'Nome recusado.'));
      await p.propagar();
      expect(p.campo('nome').getAttribute('aria-invalid')).toBe('true');

      p.preencher('codigo', '');
      p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
      await p.propagar();

      expect(p.edicao.form.controls.nome.hasError('backend')).toBe(false);
      expect(p.edicao.form.controls.codigo.value).toBe('');
    });
  });

  describe('toast de sucesso', () => {
    it('diz o que foi feito em cada escrita', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...criado());
      await p.recarregarCom([sisu, vestibular]);
      expect(p.sucessos).toHaveBeenLastCalledWith('Tipo de processo criado');

      await p.abrirEdicao(sisu);
      (await p.enviar(`${LISTA}/${sisu.id}`)).flush(...sucesso());
      await p.recarregarCom([sisu, vestibular]);
      expect(p.sucessos).toHaveBeenLastCalledWith('Tipo de processo atualizado');

      (await p.confirmarDesativacao(sisu)).flush(...sucesso());
      await p.recarregarCom([{ ...sisu, ativo: false }, vestibular]);
      expect(p.sucessos).toHaveBeenLastCalledWith('Tipo de processo desativado', 'SISU');

      (await p.confirmarAtivacao(vestibular)).flush(...sucesso());
      await p.recarregarCom([
        { ...sisu, ativo: false },
        { ...vestibular, ativo: true },
      ]);
      expect(p.sucessos).toHaveBeenLastCalledWith('Tipo de processo ativado', 'VESTIBULAR_TRAD');
      expect(p.erros).not.toHaveBeenCalled();
    });
  });

  describe('ao desativar', () => {
    const lerMensagem = (): string | undefined =>
      p.confirmacao('desativar').querySelector('.field__error')?.textContent?.trim();

    it.each([
      ['422 de tipo já desativado', 422, JA_DESATIVADO],
      ['409 de conflito de concorrência', 409, CONCORRENCIA_NA_REMOCAO],
    ] as const)(
      'recusa %s mantém o diálogo, a mensagem e o foco no botão, sem toast',
      async (_nome, status, corpo) => {
        (await p.confirmarDesativacao(sisu)).flush(...problema(status, corpo));
        await p.propagar();

        expect(lerMensagem()).toBe(corpo.title);
        expect(p.confirmacao('desativar').textContent).toContain('Deseja desativar o tipo');
        expect(p.edicao.confirmando()).toBe(true);
        expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
        expect(document.activeElement).toBe(p.confirmar());
        expect(p.confirmacao('desativar').querySelector('[role="status"]')?.textContent).toContain(
          'Não foi possível desativar o tipo de processo SISU.',
        );
        expect(p.erros).not.toHaveBeenCalled();
        expect(p.sucessos).not.toHaveBeenCalled();

        p.confirmar().click();
        await p.propagar();
        p.http.expectOne(`${LISTA}/${sisu.id}`).flush(...sucesso());
        await p.recarregarCom([vestibular]);
        expect(p.edicao.confirmando()).toBe(false);
      },
    );

    it('falha 5xx mantém o diálogo com a mensagem, avisa por toast e aceita nova tentativa', async () => {
      (await p.confirmarDesativacao(sisu)).flush(
        ...problema(500, { code: 'uniplus.erro_interno' }),
      );
      await p.propagar();

      expect(lerMensagem()).toBe('Falha');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.confirmar());
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.desativar(sisu));
    });
  });

  describe('ao ativar', () => {
    const lerMensagem = (): string | undefined =>
      p.confirmacao('ativar').querySelector('.field__error')?.textContent?.trim();

    it.each([
      ['422 de tipo já ativo', 422, JA_ATIVO],
      ['409 de conflito de concorrência', 409, CONCORRENCIA],
    ] as const)(
      'recusa %s mantém o diálogo, a mensagem e o foco no botão, sem toast',
      async (_nome, status, corpo) => {
        (await p.confirmarAtivacao(vestibular)).flush(...problema(status, corpo));
        await p.propagar();

        expect(lerMensagem()).toBe(corpo.title);
        expect(p.edicao.confirmandoReativacao()).toBe(true);
        expect(document.activeElement).toBe(p.confirmar('ativar'));
        expect(p.confirmacao('ativar').querySelector('[role="status"]')?.textContent).toContain(
          'Não foi possível ativar o tipo de processo VESTIBULAR_TRAD.',
        );
        expect(p.erros).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['o conflito de processamento mantém', problema(409, PROCESSANDO), true],
      ['a falha 5xx mantém', problema(500, { code: 'uniplus.erro_interno' }), true],
      ['a recusa de negócio renova', problema(422, JA_ATIVO), false],
    ] as const)('%s a chave no reenvio da ativação', async (_nome, recusa, mantem) => {
      const primeira = await p.confirmarAtivacao(vestibular);
      const chave = chaveDe(primeira);
      primeira.flush(...recusa);
      await p.propagar();

      p.confirmar('ativar').click();
      await p.propagar();
      const segunda = p.http.expectOne(urlDaAtivacao);
      expect(chaveDe(segunda) === chave).toBe(mantem);
      segunda.flush(...sucesso());
      await p.recarregarCom([sisu, { ...vestibular, ativo: true }]);
    });

    it('a falha 5xx da ativação avisa por toast uma vez', async () => {
      (await p.confirmarAtivacao(vestibular)).flush(
        ...problema(500, { code: 'uniplus.erro_interno' }),
      );
      await p.propagar();
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(lerMensagem()).toBe('Falha');
    });

    it('cancelar a confirmação devolve o foco ao botão de ativar da linha', async () => {
      await p.confirmarAtivacao(vestibular).then((req) => req.flush(...problema(422, JA_ATIVO)));
      await p.propagar();
      p.cancelarDaConfirmacao('ativar').click();
      await p.propagar();
      expect(document.activeElement).toBe(p.ativar(vestibular));
    });
  });

  describe('foco depois da escrita', () => {
    it('edição concluída com a linha na recarga devolve o foco ao botão de editar', async () => {
      await p.abrirEdicao(sisu);
      (await p.enviar(`${LISTA}/${sisu.id}`)).flush(...sucesso());
      await p.recarregarCom([sisu]);
      expect(document.activeElement).toBe(p.editar(sisu));
    });

    it('cancelar a edição devolve o foco ao botão que abriu o drawer', async () => {
      await p.abrirEdicao(sisu);
      p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
      await p.propagar();
      expect(document.activeElement).toBe(p.editar(sisu));
    });

    it('desativação concluída leva o foco ao botão de ativar da mesma linha', async () => {
      (await p.confirmarDesativacao(sisu)).flush(...sucesso());
      await p.recarregarCom([{ ...sisu, ativo: false }, vestibular]);
      expect(document.activeElement).toBe(p.ativar({ ...sisu, ativo: false }));
    });

    it('ativação concluída leva o foco ao botão de desativar da mesma linha', async () => {
      (await p.confirmarAtivacao(vestibular)).flush(...sucesso());
      await p.recarregarCom([sisu, { ...vestibular, ativo: true }]);
      expect(document.activeElement).toBe(p.desativar({ ...vestibular, ativo: true }));
    });

    it('desativação concluída leva o foco ao título quando a linha some da recarga', async () => {
      (await p.confirmarDesativacao(sisu)).flush(...sucesso());
      await p.recarregarCom([vestibular]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('escrita com falha na recarga leva o foco ao título da lista', async () => {
      (await p.confirmarDesativacao(sisu)).flush(...sucesso());
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(...problema(503));
      await p.propagar();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('cancelar a confirmação devolve o foco ao botão de desativar da linha', async () => {
      p.desativar(sisu).focus();
      p.desativar(sisu).click();
      await p.propagar();
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.desativar(sisu));
    });
  });

  describe('falha de leitura', () => {
    it('5xx avisa por toast e oferece "Tentar novamente", que devolve o foco ao título', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(...problema(503));
      await p.propagar();
      expect(p.erros).toHaveBeenCalledTimes(1);

      const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      expect(tentar.getAttribute('aria-busy')).toBe('true');
      await p.recarregarCom([sisu]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('4xx mostra o alerta sem toast', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush(...problema(403, { code: 'uniplus.proibido' }));
      await p.propagar();
      expect(p.elemento('ui-alert .list-state__retry button')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });
  });
});
