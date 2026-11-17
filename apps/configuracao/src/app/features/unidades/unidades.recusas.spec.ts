import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CenarioDaPaginaDeUnidades,
  CODIGO_DA_SIGLA_REPETIDA,
  CODIGO_DO_CODIGO_REPETIDO,
  CODIGO_DO_SLUG_REPETIDO,
  ERRO_INTERNO,
  ESCRITA,
  PROCESSANDO,
  REMOCAO_BLOQUEADA,
  codigoDaUnidade,
  criado,
  instituto,
  problema,
  recusaDeCampo,
  reitoria,
  sucesso,
} from './unidades.testing';

describe('UnidadesPage — recusas do servidor', () => {
  let p: CenarioDaPaginaDeUnidades;

  beforeEach(async () => {
    p = await CenarioDaPaginaDeUnidades.abrir();
  });
  afterEach(() => p.http.verify());

  const chaveDeIdempotencia = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');

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
        const chave = chaveDeIdempotencia(primeira);
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
        expect(chaveDeIdempotencia(await p.enviar())).not.toBe(chave);
      },
    );

    it('conflito de processamento mantém a chave e mostra a mensagem no alerta, sem marcar campo', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDeIdempotencia(primeira);
      primeira.flush(...problema(409, { code: PROCESSANDO, title: 'Em processamento' }));
      await p.propagar();

      expect(p.alertaDoDrawer().textContent).toContain('Em processamento');
      expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
      const segunda = await p.enviar();
      expect(chaveDeIdempotencia(segunda)).toBe(chave);
      segunda.flush(...criado());
      await p.responderAConsultaDasUnidades([reitoria]);
    });

    it('corpo divergente da chave vai ao alerta e renova a chave', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDeIdempotencia(primeira);
      primeira.flush(
        ...problema(422, { code: 'uniplus.idempotency.body_mismatch', title: 'Corpo divergente' }),
      );
      await p.propagar();

      expect(p.alertaDoDrawer().textContent).toContain('Corpo divergente');
      expect(chaveDeIdempotencia(await p.enviar())).not.toBe(chave);
    });

    it('recusa de campo (422) renova a chave', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDeIdempotencia(primeira);
      primeira.flush(
        ...recusaDeCampo('sigla', 'Sigla recusada.', codigoDaUnidade('sigla_tamanho')),
      );
      await p.propagar();

      expect(chaveDeIdempotencia(await p.enviar())).not.toBe(chave);
    });

    it('unidade não encontrada na edição vai ao alerta, sem toast', async () => {
      await p.abrirEdicao(reitoria);
      (await p.enviar(`${ESCRITA}/${reitoria.id}`)).flush(
        ...problema(404, { code: 'uniplus.organizacao.unidade.nao_encontrada' }),
      );
      await p.propagar();

      expect(p.alertaDoDrawer().textContent).toContain('Falha');
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('falha 5xx vai ao alerta, avisa por toast e mantém a chave para o reenvio', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDeIdempotencia(primeira);
      primeira.flush(...problema(500, { code: ERRO_INTERNO }));
      await p.propagar();

      expect(p.alertaDoDrawer()).toBeTruthy();
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(chaveDeIdempotencia(await p.enviar())).toBe(chave);
    });

    it('um novo envio, ainda que barrado pela validação, retira a recusa anterior da tela', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...problema(500, { code: ERRO_INTERNO }));
      await p.propagar();
      expect(p.alertaDoDrawer()).toBeTruthy();

      p.preencher('sigla', '');
      p.submeterOFormulario();
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert.alert--danger')).toBeNull();
      p.http.expectNone(ESCRITA);
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
      await p.responderAConsultaDasUnidades([instituto]);

      expect(p.sucessos).toHaveBeenCalledWith('Unidade removida', 'REIT');
      expect(p.statusDaPagina()).toBe('Unidade REIT removida.');
    });
  });
});
