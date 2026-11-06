import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CODIGO_DA_SIGLA_REPETIDA,
  CODIGO_DO_CODIGO_REPETIDO,
  CODIGO_DO_SLUG_REPETIDO,
  ERRO_INTERNO,
  ESCRITA,
  LISTA,
  Pagina,
  PROCESSANDO,
  REMOCAO_BLOQUEADA,
  TITULO_DA_LISTA,
  criado,
  instituto,
  montarPagina,
  problema,
  recusaDeCampo,
  reitoria,
  sucesso,
} from './unidades.testing';

const CODIGO_DE_REGRA = 'uniplus.validacao.regra';
const dominio = (sufixo: string): string => `uniplus.organizacao.unidade.${sufixo}`;

/** Campo, seletor, id do erro, modo e código da recusa; sem código próprio no domínio, o da regra genérica. */
const CAMPOS_RECUSAVEIS = [
  [
    'sigla',
    '[formcontrolname="sigla"]',
    'cfg-unidade-sigla-erro',
    'criar',
    dominio('sigla_tamanho'),
  ],
  ['slug', '[formcontrolname="slug"]', 'cfg-unidade-slug-erro', 'criar', dominio('slug_tamanho')],
  [
    'codigo',
    '[formcontrolname="codigo"]',
    'cfg-unidade-codigo-erro',
    'criar',
    dominio('codigo_tamanho'),
  ],
  [
    'alias',
    '[formcontrolname="alias"]',
    'cfg-unidade-alias-erro',
    'criar',
    dominio('alias_tamanho'),
  ],
  ['nome', '[formcontrolname="nome"]', 'cfg-unidade-nome-erro', 'criar', dominio('nome_tamanho')],
  ['tipo', '[formcontrolname="tipo"]', 'cfg-unidade-tipo-erro', 'criar', dominio('tipo_invalido')],
  [
    'unidadeSuperiorId',
    '#cfg-unidade-superior',
    'cfg-unidade-superior-erro',
    'criar',
    CODIGO_DE_REGRA,
  ],
  [
    'unidadeAcademica',
    '[formcontrolname="unidadeAcademica"]',
    'cfg-unidade-academica-erro',
    'criar',
    CODIGO_DE_REGRA,
  ],
  [
    'vigenciaInicio',
    '[formcontrolname="vigenciaInicio"]',
    'cfg-unidade-inicio-erro',
    'criar',
    CODIGO_DE_REGRA,
  ],
  [
    'vigenciaFim',
    '[formcontrolname="vigenciaFim"]',
    'cfg-unidade-fim-erro',
    'criar',
    dominio('vigencia_fim_anterior_ao_inicio'),
  ],
  [
    'motivoMudancaIdentificador',
    '[formcontrolname="motivoMudancaIdentificador"]',
    'cfg-unidade-motivo-erro',
    'editar',
    CODIGO_DE_REGRA,
  ],
] as const;

const LIMITES_DE_TAMANHO = [
  ['nome', 250, 'criar', 'cfg-unidade-nome-erro'],
  ['alias', 100, 'criar', 'cfg-unidade-alias-erro'],
  ['sigla', 50, 'criar', 'cfg-unidade-sigla-erro'],
  ['codigo', 50, 'criar', 'cfg-unidade-codigo-erro'],
  ['motivoMudancaIdentificador', 500, 'editar', 'cfg-unidade-motivo-erro'],
] as const;

describe('UnidadesPage — recusas do servidor', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.http.verify());

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alertaDoDrawer = (): HTMLElement => p.elemento('ui-drawer ui-alert');
  const submeter = (): void => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  };

  describe('ao salvar, por campo', () => {
    it.each(CAMPOS_RECUSAVEIS)(
      'mapeia a recusa de %s ao campo, associada e focada (prova o mapeamento do campo, não o código do domínio)',
      async (campo, seletor, idDoErro, modo, codigo) => {
        if (modo === 'criar') await p.abrirCadastro();
        else await p.abrirEdicao(reitoria);
        const url = modo === 'criar' ? ESCRITA : `${ESCRITA}/${reitoria.id}`;
        (await p.enviar(url)).flush(...recusaDeCampo(campo, 'Valor recusado.', codigo));
        await p.propagar();
        await p.propagar();

        const controle = p.elemento<HTMLElement>(seletor);
        expect(controle.getAttribute('aria-invalid')).toBe('true');
        expect(controle.getAttribute('aria-describedby')?.split(' ')).toContain(idDoErro);
        expect(p.elemento(`#${idDoErro}`).textContent?.trim()).toBe('Valor recusado.');
        expect(document.activeElement).toBe(controle);
        expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
        expect(p.erros).not.toHaveBeenCalled();
      },
    );

    it('o nome do servidor em PascalCase com caminho e índice chega ao campo', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(
        ...recusaDeCampo('Comando.Itens[0].Sigla', 'Sigla recusada.', dominio('sigla_tamanho')),
      );
      await p.propagar();

      expect(p.elemento('#cfg-unidade-sigla-erro').textContent).toContain('Sigla recusada.');
    });

    it('campo desconhecido vai ao alerta do drawer', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('inexistente', 'Algo recusado.', CODIGO_DE_REGRA));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Não foi possível mapear');
    });

    it('recusa corrigida em outro campo: o reenvio descarta a recusa antiga sem emitir valores', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(
        ...recusaDeCampo('sigla', 'Sigla recusada.', dominio('sigla_tamanho')),
      );
      await p.propagar();
      expect(p.edicao.form.controls.sigla.hasError('backend')).toBe(true);

      p.preencher('nome', 'Núcleo revisado');
      let emissoes = 0;
      const inscricao = p.edicao.form.valueChanges.subscribe(() => (emissoes += 1));
      p.edicao.salvar();

      expect(emissoes).toBe(0);
      expect(p.edicao.form.controls.sigla.hasError('backend')).toBe(false);
      inscricao.unsubscribe();
      p.http.expectOne(ESCRITA).flush(...criado());
      await p.recarregarCom([reitoria]);
    });
  });

  describe('ao salvar, por conflito', () => {
    it.each([
      [CODIGO_DA_SIGLA_REPETIDA, 'sigla', 'cfg-unidade-sigla-erro'],
      [CODIGO_DO_CODIGO_REPETIDO, 'codigo', 'cfg-unidade-codigo-erro'],
      [CODIGO_DO_SLUG_REPETIDO, 'slug', 'cfg-unidade-slug-erro'],
    ] as const)(
      '409 %s marca o campo, renova a chave, foca e não avisa por toast',
      async (code, nome, idDoErro) => {
        await p.abrirCadastro();
        const primeira = await p.enviar();
        const chave = chaveDe(primeira);
        primeira.flush(...problema(409, { code, title: 'Valor já existe' }));
        await p.propagar();
        await p.propagar();

        const campo = p.campo(nome);
        expect(campo.getAttribute('aria-invalid')).toBe('true');
        expect(p.elemento(`#${idDoErro}`).textContent).toContain('Valor já existe');
        expect(document.activeElement).toBe(campo);
        expect(p.edicao.erro()).toBeNull();
        expect(p.erros).not.toHaveBeenCalled();
        p.preencher(nome, 'outro');
        expect(chaveDe(await p.enviar())).not.toBe(chave);
      },
    );

    it('conflito de processamento mantém a chave e mostra a mensagem no alerta, sem marcar campo', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...problema(409, { code: PROCESSANDO, title: 'Em processamento' }));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Em processamento');
      expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
      const segunda = await p.enviar();
      expect(chaveDe(segunda)).toBe(chave);
      segunda.flush(...criado());
      await p.recarregarCom([reitoria]);
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

    it('recusa de campo (422) renova a chave', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...recusaDeCampo('sigla', 'Sigla recusada.', dominio('sigla_tamanho')));
      await p.propagar();

      expect(chaveDe(await p.enviar())).not.toBe(chave);
    });

    it('unidade não encontrada na edição vai ao alerta, sem toast', async () => {
      await p.abrirEdicao(reitoria);
      (await p.enviar(`${ESCRITA}/${reitoria.id}`)).flush(
        ...problema(404, { code: 'uniplus.organizacao.unidade.nao_encontrada' }),
      );
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Falha');
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('falha 5xx vai ao alerta, avisa por toast e mantém a chave para o reenvio', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...problema(500, { code: ERRO_INTERNO }));
      await p.propagar();

      expect(alertaDoDrawer()).toBeTruthy();
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(chaveDe(await p.enviar())).toBe(chave);
    });

    it('um novo envio, ainda que barrado pela validação, retira a recusa anterior da tela', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...problema(500, { code: ERRO_INTERNO }));
      await p.propagar();
      expect(alertaDoDrawer()).toBeTruthy();

      p.preencher('sigla', '');
      submeter();
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert.alert--danger')).toBeNull();
      p.http.expectNone(ESCRITA);
    });
  });

  describe('validação local', () => {
    it('envio barrado leva o foco ao primeiro campo inválido', async () => {
      await p.abrirCadastro();
      p.preencher('sigla', '');
      p.preencher('codigo', '');
      p.salvar().focus();
      submeter();
      await p.propagar();
      await p.propagar();

      p.http.expectNone(ESCRITA);
      expect(document.activeElement).toBe(p.campo('sigla'));
      expect(p.campo('sigla').getAttribute('aria-invalid')).toBe('true');
      expect(p.campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(p.elemento('#cfg-unidade-sigla-erro').textContent).toContain('Campo obrigatório.');
    });

    it('os obrigatórios declaram aria-required', async () => {
      await p.abrirCadastro();

      for (const nome of ['sigla', 'slug', 'codigo', 'nome', 'tipo', 'vigenciaInicio']) {
        expect(p.campo(nome).getAttribute('aria-required'), nome).toBe('true');
      }
      expect(p.campo('alias').getAttribute('aria-required')).toBeNull();
    });

    it.each(LIMITES_DE_TAMANHO)(
      'recusa %s acima de %i caracteres, marcando o campo e sem enviar',
      async (nome, limite, modo, idDoErro) => {
        const abrir = async (): Promise<string> => {
          if (modo === 'criar') {
            await p.abrirCadastro();
            return ESCRITA;
          }
          await p.abrirEdicao(reitoria);
          return `${ESCRITA}/${reitoria.id}`;
        };
        const url = await abrir();
        p.preencher(nome, 'x'.repeat(limite));
        submeter();
        await p.propagar();
        const aceite = p.http.expectOne(url);
        if (modo === 'criar') aceite.flush(...criado());
        else aceite.flush(...sucesso());
        await p.recarregarCom([reitoria]);

        await abrir();
        p.preencher(nome, 'x'.repeat(limite + 1));
        submeter();
        await p.propagar();
        await p.propagar();

        p.http.expectNone(url);
        expect(p.campo(nome).getAttribute('aria-invalid')).toBe('true');
        expect(p.elemento(`#${idDoErro}`).textContent).toContain(
          `Informe no máximo ${limite} caracteres.`,
        );
      },
    );

    it('o nome com menos de 2 caracteres diz quantos faltam', async () => {
      await p.abrirCadastro();
      p.preencher('nome', 'N');
      submeter();
      await p.propagar();

      expect(p.elemento('#cfg-unidade-nome-erro').textContent).toContain(
        'Informe ao menos 2 caracteres.',
      );
    });

    it('o tipo que o servidor devolveu e a tela não conhece bloqueia o envio e diz por quê', async () => {
      const desconhecida = { ...reitoria, tipo: 'TipoInexistente' };
      p = await recriar([desconhecida]);
      await p.abrirEdicao(desconhecida);

      expect(p.edicao.tipoNaoReconhecido()).toBe(true);
      expect(p.edicao.form.invalid).toBe(true);
      p.salvar().click();
      await p.propagar();
      await p.propagar();

      p.http.expectNone(ESCRITA);
      expect(p.elemento('#cfg-unidade-tipo-erro').textContent).toContain('não reconhecido');
      expect(p.campo('tipo').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(p.campo('tipo'));
    });

    it('o tipo com acentuação ou hífen diferente na API é reconhecido e preservado', async () => {
      const proReitoria = { ...reitoria, id: 'u-9', sigla: 'PROEG', tipo: 'Pro-Reitoria' };
      p = await recriar([proReitoria]);
      await p.abrirEdicao(proReitoria);

      expect(p.edicao.tipoNaoReconhecido()).toBe(false);
      expect(p.campo('tipo').value).toBe('proReitoria');
    });
  });

  describe('ao remover', () => {
    const mensagemDoDialogo = (): string | undefined =>
      p.elemento('cfg-confirmacao-de-remocao .field__error').textContent?.trim();

    it('remoção bloqueada (409) mantém o diálogo, a mensagem e o foco no botão, sem toast', async () => {
      const del = await p.confirmarRemocao(reitoria);
      del.flush(...problema(409, { code: REMOCAO_BLOQUEADA, title: 'Tem subordinadas' }));
      await p.propagar();

      expect(mensagemDoDialogo()).toBe('Tem subordinadas');
      expect(p.edicao.confirmando()).toBe(true);
      expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(document.activeElement).toBe(p.confirmar());
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Não foi possível remover a unidade REIT.',
      );
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.sucessos).not.toHaveBeenCalled();

      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.remover(reitoria));
    });

    it('falha 5xx mantém o diálogo com a mensagem e avisa por toast', async () => {
      (await p.confirmarRemocao(reitoria)).flush(...problema(500, { code: ERRO_INTERNO }));
      await p.propagar();

      expect(mensagemDoDialogo()).toBe('Falha');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.confirmar());
    });

    it('remoção concluída avisa o sucesso e recarrega', async () => {
      (await p.confirmarRemocao(reitoria)).flush(...sucesso());
      await p.recarregarCom([instituto]);

      expect(p.sucessos).toHaveBeenCalledWith('Unidade removida', 'REIT');
      expect(p.statusDaPagina()).toBe('Unidade REIT removida.');
    });
  });

  describe('foco depois da escrita', () => {
    it('edição concluída com a linha na recarga devolve o foco ao botão de editar', async () => {
      await p.abrirEdicao(reitoria);
      (await p.enviar(`${ESCRITA}/${reitoria.id}`)).flush(...sucesso());
      await p.recarregarCom([reitoria, instituto]);
      expect(document.activeElement).toBe(p.editar(reitoria));
      expect(p.sucessos).toHaveBeenCalledWith('Unidade atualizada');
    });

    it('quem levou o foco a outro campo durante a recarga não o perde para a linha', async () => {
      await p.abrirEdicao(reitoria);
      (await p.enviar(`${ESCRITA}/${reitoria.id}`)).flush(...sucesso());
      await p.propagar();
      const expandir = p.elemento<HTMLButtonElement>('button[aria-label="Expandir REIT"]');
      expandir.focus();
      p.http.expectOne((r) => r.url === LISTA).flush([reitoria, instituto]);
      await p.propagar();
      await p.propagar();
      expect(document.activeElement).toBe(expandir);
    });

    it('cadastro concluído devolve o foco ao botão "Nova unidade"', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...criado());
      await p.recarregarCom([reitoria, instituto]);
      expect(document.activeElement).toBe(p.novo());
      expect(p.sucessos).toHaveBeenCalledWith('Unidade criada');
    });

    it('cancelar a edição devolve o foco ao botão que abriu o drawer', async () => {
      await p.abrirEdicao(reitoria);
      p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
      await p.propagar();
      expect(document.activeElement).toBe(p.editar(reitoria));
    });

    it('remoção concluída leva o foco ao título quando a linha some da recarga', async () => {
      (await p.confirmarRemocao(reitoria)).flush(...sucesso());
      await p.recarregarCom([]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('escrita com falha na recarga leva o foco ao título da lista', async () => {
      (await p.confirmarRemocao(reitoria)).flush(...sucesso());
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('ação iniciada no detalhe devolve o foco à linha da unidade', async () => {
      p.nomeDoNo(reitoria).click();
      await p.propagar();
      p.elemento<HTMLButtonElement>('.cfg-drawer-actions button').click();
      await p.responderOpcoes();
      (await p.enviar(`${ESCRITA}/${reitoria.id}`)).flush(...sucesso());
      await p.recarregarCom([reitoria, instituto]);

      expect(document.activeElement).toBe(p.editar(reitoria));
    });

    it('cancelar a confirmação aberta pelo detalhe devolve o foco à linha', async () => {
      p.nomeDoNo(reitoria).click();
      await p.propagar();
      [...p.fixture.nativeElement.querySelectorAll('.cfg-drawer-actions button')][1].click();
      await p.propagar();
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      await p.propagar();

      expect(document.activeElement).toBe(p.remover(reitoria));
    });
  });

  /** Remonta a página com outra lista, para o cenário que depende de como ela chega. */
  async function recriar(itens: readonly (typeof reitoria)[]): Promise<Pagina> {
    p.http.verify();
    p.fixture.destroy();
    const { TestBed } = await import('@angular/core/testing');
    TestBed.resetTestingModule();
    return montarPagina(itens);
  }
});
