import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  Pagina,
  TITULO_DA_LISTA,
  aviso,
  criado,
  montarPagina,
  preliminar,
  problema,
  recusaDeCampo,
  sucesso,
} from './tipos-ato.testing';

const PROCESSANDO = { code: 'uniplus.idempotency.processing_conflict', title: 'Em processamento' };
const SOBREPOSTA = {
  code: 'uniplus.publicacoes.tipo_ato.vigencia_sobreposta',
  title: 'Vigência sobreposta',
};
const NAO_ENCONTRADO = {
  code: 'uniplus.publicacoes.tipo_ato.nao_encontrado',
  title: 'Tipo de ato não encontrado',
};

describe('TiposAtoPage — recusas do servidor', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([preliminar, aviso]);
  });
  afterEach(() => p.http.verify());

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alertaDoDrawer = (): HTMLElement => p.elemento('ui-drawer ui-alert');

  describe('ao salvar', () => {
    it.each([
      ['Codigo', 'input', 'codigo'],
      ['Nome', 'input', 'nome'],
      ['VigenciaInicio', 'input', 'vigenciaInicio'],
      ['VigenciaFim', 'input', 'vigenciaFim'],
      ['BaseLegal', 'textarea', 'baseLegal'],
    ] as const)('mostra a recusa de %s no campo e o foca', async (campo, tag, nome) => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo(campo, 'Valor recusado.'));
      await p.propagar();
      await p.propagar();

      const controle = p.elemento<HTMLElement>(`${tag}[formcontrolname="${nome}"]`);
      expect(controle.getAttribute('aria-invalid')).toBe('true');
      expect(controle.closest('.field')?.classList.contains('is-error')).toBe(true);
      expect(controle.closest('.field')?.querySelector('.field__error')?.textContent?.trim()).toBe(
        'Valor recusado.',
      );
      expect(document.activeElement).toBe(controle);
      expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('a recusa de um atributo de publicação associa a mensagem ao grupo', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('ExigeAtoCorrigido', 'Declare o atributo.'));
      await p.propagar();
      await p.propagar();

      const grupo = p.elemento('fieldset[role="radiogroup"]:last-of-type');
      expect(grupo.getAttribute('aria-describedby')?.split(' ')).toContain(
        'exigeAtoCorrigido-erro',
      );
      expect(grupo.querySelector('#exigeAtoCorrigido-erro')?.textContent?.trim()).toBe(
        'Declare o atributo.',
      );
      const primeiro = p.elemento('input[type="radio"][formcontrolname="exigeAtoCorrigido"]');
      expect(document.activeElement).toBe(primeiro);
    });

    it.each([
      ['efeitoIrreversivel', 'uniplus.publicacoes.tipo_ato.resultado_com_efeito_irreversivel'],
      ['ehResultado', 'uniplus.publicacoes.tipo_ato.nome_tamanho'],
      ['congelaConfiguracao', 'uniplus.publicacoes.tipo_ato.nome_tamanho'],
      ['unicoPorObjeto', 'uniplus.publicacoes.tipo_ato.nome_tamanho'],
    ] as const)(
      'a recusa do sinalizador %s aparece junto da caixa, que é marcada e focada',
      async (nome, codigo) => {
        await p.abrirCadastro();
        (await p.enviar()).flush(...recusaDeCampo(nome, 'Combinação recusada.', codigo));
        await p.propagar();
        await p.propagar();

        const caixa = p.elemento<HTMLInputElement>(
          `input[type="checkbox"][aria-describedby^="${nome}-ajuda"]`,
        );
        const campo = caixa.closest('.field');
        expect(caixa.getAttribute('aria-invalid')).toBe('true');
        expect(campo?.classList.contains('is-error')).toBe(true);
        expect(campo?.querySelector('.field__error')?.textContent?.trim()).toBe(
          'Combinação recusada.',
        );
        expect(caixa.getAttribute('aria-describedby')?.split(' ')).toEqual([
          `${nome}-ajuda`,
          `${nome}-erro`,
        ]);
        expect(document.activeElement).toBe(caixa);

        caixa.click();
        await p.propagar();
        expect(caixa.getAttribute('aria-invalid')).toBeNull();
        expect(campo?.querySelector('.field__error')).toBeNull();
      },
    );

    it('reenviar depois de recusa em VigenciaFim, alterando só o início, emite o POST', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('VigenciaFim', 'Fim recusado.'));
      await p.propagar();
      await p.propagar();
      expect(p.campo('vigenciaFim').getAttribute('aria-invalid')).toBe('true');

      p.preencher('vigenciaInicio', '2026-02-01');
      const segunda = await p.enviar();
      expect(segunda.request.body).toMatchObject({ vigenciaInicio: '2026-02-01' });
      segunda.flush(...criado());
      await p.recarregarCom([preliminar]);
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
      await p.recarregarCom([preliminar]);

      expect(p.edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(p.novo());
    });

    it('a sobreposição de vigência orienta a saída no alerta, renova a chave e mantém o formulário', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...problema(409, SOBREPOSTA));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Encerre a anterior ou escolha outro início');
      expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.edicao.aberto()).toBe(true);
      expect(chaveDe(await p.enviar())).not.toBe(chave);
    });

    it('a sobreposição na edição também vai ao alerta', async () => {
      await p.abrirEdicao(aviso);
      (await p.enviar(`${ESCRITA}/${aviso.id}`)).flush(...problema(409, SOBREPOSTA));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Encerre a anterior ou escolha outro início');
      expect(p.erros).not.toHaveBeenCalled();
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
      await p.recarregarCom([preliminar]);
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

    it('422 sem campo mapeável vai ao alerta com a orientação de revisar', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('Desconhecido', 'Sem campo.'));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Não foi possível mapear os erros');
    });

    it('tipo não encontrado na edição vai ao alerta, sem toast', async () => {
      await p.abrirEdicao(preliminar);
      (await p.enviar(`${ESCRITA}/${preliminar.id}`)).flush(...problema(404, NAO_ENCONTRADO));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Tipo de ato não encontrado');
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('falha 5xx vai ao alerta, avisa por toast e mantém a chave para o reenvio', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      expect(alertaDoDrawer()).toBeTruthy();
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(chaveDe(await p.enviar())).toBe(chave);
    });

    it('um novo envio, ainda que barrado pela validação, retira a recusa anterior da tela', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
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

    it('a recusa de validação local aparece no campo que a causou', async () => {
      await p.abrirCadastro();
      p.preencher('baseLegal', 'x'.repeat(501));
      p.preencher('nome', 'x');
      p.salvar().click();
      await p.propagar();

      p.http.expectNone(ESCRITA);
      const mensagem = (nome: string) =>
        p.campo(nome).closest('.field')?.querySelector('.field__error')?.textContent?.trim();
      expect(mensagem('baseLegal')).toBe('Informe no máximo 500 caracteres.');
      expect(mensagem('nome')).toBe('Informe ao menos 2 caracteres.');
    });
  });

  describe('ao remover', () => {
    const lerMensagem = (): string | undefined =>
      p.elemento('cfg-confirmacao-de-remocao .field__error').textContent?.trim();

    it('recusa 404 mantém o diálogo, a mensagem e o foco no botão, sem toast', async () => {
      (await p.confirmarRemocao(preliminar)).flush(...problema(404, NAO_ENCONTRADO));
      await p.propagar();

      expect(lerMensagem()).toBe(NAO_ENCONTRADO.title);
      expect(p.edicao.confirmando()).toBe(true);
      expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(document.activeElement).toBe(p.confirmar());
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Não foi possível remover a vigência RESULTADO_PRELIMINAR_INSCRICAO iniciada em 01/01/2026.',
      );
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.sucessos).not.toHaveBeenCalled();

      p.confirmar().click();
      await p.propagar();
      p.http.expectOne(`${ESCRITA}/${preliminar.id}`).flush(...sucesso());
      await p.recarregarCom([aviso]);
      expect(p.edicao.confirmando()).toBe(false);
    });

    it('falha 5xx mantém o diálogo com a mensagem, avisa por toast e aceita nova tentativa', async () => {
      (await p.confirmarRemocao(preliminar)).flush(
        ...problema(500, { code: 'uniplus.internal.unexpected' }),
      );
      await p.propagar();

      expect(lerMensagem()).toBe('Falha');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.confirmar());
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.remover(preliminar));
    });
  });

  describe('foco depois da escrita', () => {
    it('edição concluída com a linha na recarga devolve o foco ao botão de editar', async () => {
      await p.abrirEdicao(preliminar);
      (await p.enviar(`${ESCRITA}/${preliminar.id}`)).flush(...sucesso());
      await p.recarregarCom([preliminar, aviso]);
      expect(document.activeElement).toBe(p.editar(preliminar));
    });

    it('cancelar a edição devolve o foco ao botão que abriu o drawer', async () => {
      await p.abrirEdicao(preliminar);
      p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
      await p.propagar();
      expect(document.activeElement).toBe(p.editar(preliminar));
    });

    it('remoção concluída leva o foco ao título quando a linha some da recarga', async () => {
      (await p.confirmarRemocao(preliminar)).flush(...sucesso());
      await p.recarregarCom([aviso]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('escrita com falha na recarga leva o foco ao título da lista', async () => {
      (await p.confirmarRemocao(preliminar)).flush(...sucesso());
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('cancelar a confirmação devolve o foco ao botão de remover da linha', async () => {
      p.remover(preliminar).focus();
      p.remover(preliminar).click();
      await p.propagar();
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.remover(preliminar));
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
      await p.recarregarCom([preliminar]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('4xx mostra o alerta sem toast', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(403, { code: 'uniplus.auth.forbidden' }));
      await p.propagar();
      expect(p.elemento('ui-alert .list-state__retry button')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });
  });
});
