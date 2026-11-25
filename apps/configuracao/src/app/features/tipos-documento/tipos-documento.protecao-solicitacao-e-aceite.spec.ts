import { afterEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  PROTECAO_URL,
  Pagina,
  TITULO_DA_LISTA,
  diploma,
  laudo,
  montarPagina,
  pendencia,
  problema,
  sucesso,
} from './tipos-documento.testing';
import { apoioDaProtecao } from './tipos-documento.protecao.testing';

const SOLICITACOES = `${PROTECAO_URL}/solicitacoes`;
const ACEITE = (id: string): string => `${ESCRITA}/${id}/aceite-da-recomendacao`;
const ATOS = (id: string): string => `${ESCRITA}/${id}/protecao/atos`;

describe('TiposDocumentoPage — solicitação e aceite da proteção de dados', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());
  const { texto, botao, abrirDetalhe, ajuste } = apoioDaProtecao(() => p);

  describe('envio da solicitação', () => {
    const dialogo = (): HTMLDialogElement =>
      p.elemento('cfg-solicitacao-da-protecao-dialog dialog') as HTMLDialogElement;
    const caixas = (): HTMLInputElement[] => [
      ...dialogo().querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'),
    ];
    const todos = (): HTMLInputElement =>
      dialogo().querySelector<HTMLInputElement>('thead input[type="checkbox"]') as HTMLInputElement;
    const enviar = (): HTMLButtonElement =>
      [...dialogo().querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        /^Enviar \d+ it/u.test(b.textContent?.trim() ?? ''),
      ) as HTMLButtonElement;
    const abrirComDois = async (): Promise<void> => {
      p = await montarPagina([laudo, diploma], {
        pendencias: [
          pendencia(laudo, { situacao: 'PENDENTE' }),
          pendencia(diploma, { situacao: 'PENDENTE' }),
        ],
      });
      botao('Enviar solicitação')?.click();
      await p.propagar();
      await p.propagar();
    };
    const recusa422 = (corpo: object) =>
      [
        JSON.stringify({ status: 422, ...corpo }),
        {
          status: 422,
          statusText: 'Recusa',
          headers: { 'content-type': 'application/problem+json' },
        },
      ] as const;

    it('oferece "Enviar solicitação" só com item pendente', async () => {
      p = await montarPagina([laudo], {
        pendencias: [pendencia(laudo, { situacao: 'SOLICITADA' })],
      });
      expect(botao('Enviar solicitação')).toBeUndefined();
    });

    it('não oferece "Enviar solicitação" nem "Aceitar recomendação" sem a permissão de manter', async () => {
      p = await montarPagina([laudo, diploma], {
        concedidas: [],
        pendencias: [pendencia(laudo, { situacao: 'PENDENTE' }), ajuste(diploma)],
      });
      expect(botao('Enviar solicitação')).toBeUndefined();
      expect(botao('Aceitar recomendação')).toBeUndefined();
    });

    it('o diálogo é largo e lista Item e Sensibilidade, sem o código técnico', async () => {
      p = await montarPagina([laudo], { pendencias: [pendencia(laudo, { situacao: 'PENDENTE' })] });
      botao('Enviar solicitação')?.click();
      await p.propagar();

      expect(dialogo().classList.contains('uni-dialog--largo')).toBe(true);
      expect(
        [...dialogo().querySelectorAll('thead th')].map((th) => th.textContent?.trim()),
      ).toEqual(['Enviar', 'Item', 'Sensibilidade']);
      const t = dialogo().textContent?.replace(/\s+/gu, ' ') ?? '';
      expect(t).toContain('Laudo médico — PcD');
      expect(t).not.toContain('LAUDO_MEDICO');
    });

    it('abre com todos marcados, cada caixa com o nome do item, e o botão diz quantos vão', async () => {
      await abrirComDois();

      expect(caixas().map((c) => c.checked)).toEqual([true, true]);
      expect(caixas().map((c) => c.getAttribute('aria-label'))).toEqual([
        `Enviar ${laudo.nome}`,
        `Enviar ${diploma.nome}`,
      ]);
      expect(todos().checked).toBe(true);
      expect(todos().indeterminate).toBe(false);
      expect(enviar().textContent?.trim()).toBe('Enviar 2 itens');
    });

    it('desmarcar um item deixa "marcar todos" em estado misto e envia só o marcado', async () => {
      await abrirComDois();
      caixas()[1].click();
      await p.propagar();

      expect(todos().indeterminate).toBe(true);
      expect(enviar().textContent?.trim()).toBe('Enviar 1 item');
      enviar().click();
      const post = p.http.expectOne(SOLICITACOES);
      expect(post.request.body).toEqual({ itens: [{ cadastro: 'TIPO_DOCUMENTO', id: laudo.id }] });
      post.flush({ tiposDeDocumento: 1, fatos: 0 });
      await p.propagar();
    });

    it('"marcar todos" desmarca tudo, desabilita o envio e volta a marcar tudo', async () => {
      await abrirComDois();
      todos().click();
      await p.propagar();
      expect(caixas().map((c) => c.checked)).toEqual([false, false]);
      expect(
        dialogo().querySelector('.uni-dialog__footer .btn--primary')?.hasAttribute('disabled'),
      ).toBe(true);

      todos().click();
      await p.propagar();
      expect(caixas().map((c) => c.checked)).toEqual([true, true]);
    });

    it('envia a solicitação de todos os pendentes, com chave, e recarrega a situação', async () => {
      p = await montarPagina([laudo], { pendencias: [pendencia(laudo, { situacao: 'PENDENTE' })] });
      botao('Enviar solicitação')?.click();
      await p.propagar();
      await p.propagar();
      enviar().click();
      const post = p.http.expectOne(SOLICITACOES);
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      post.flush({ tiposDeDocumento: 1, fatos: 0 });
      await p.propagar();
      p.atenderProtecao([pendencia(laudo, { situacao: 'SOLICITADA' })]);
      await p.propagar();

      expect(botao('Enviar solicitação')).toBeUndefined();
      expect(texto()).toContain('Em análise');
    });

    it('item recusado como não pendente fica sinalizado na linha e sai da marcação', async () => {
      await abrirComDois();
      enviar().click();
      p.http.expectOne(SOLICITACOES).flush(
        ...recusa422({
          code: 'uniplus.configuracao.protecao_do_catalogo.item_nao_pendente',
          title: 'O item da solicitação não existe ou não está pendente',
          errors: [
            {
              field: 'itens[1].id',
              code: 'uniplus.configuracao.protecao_do_catalogo.item_nao_pendente',
              message: 'O item da solicitação não existe ou não está pendente',
            },
          ],
        }),
      );
      await p.propagar();
      await p.propagar();

      const recusado = caixas()[1];
      expect(recusado.checked).toBe(false);
      expect(recusado.getAttribute('aria-invalid')).toBe('true');
      expect(
        dialogo().querySelector(`[id="${recusado.getAttribute('aria-describedby')}"]`)?.textContent,
      ).toContain('não existe ou não está pendente');
      expect(caixas()[0].checked).toBe(true);
      expect(enviar().textContent?.trim()).toBe('Enviar 1 item');
    });

    it('troca a Idempotency-Key quando a seleção muda depois de uma falha', async () => {
      await abrirComDois();
      enviar().click();
      const primeira = p.http.expectOne(SOLICITACOES);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...problema(503));
      await p.propagar();

      enviar().click();
      const repetida = p.http.expectOne(SOLICITACOES);
      expect(repetida.request.headers.get('Idempotency-Key')).toBe(chave);
      repetida.flush(...problema(503));
      await p.propagar();

      caixas()[1].click();
      await p.propagar();
      enviar().click();
      const outra = p.http.expectOne(SOLICITACOES);
      expect(outra.request.headers.get('Idempotency-Key')).not.toBe(chave);
      expect(outra.request.body.itens).toHaveLength(1);
      outra.flush({ tiposDeDocumento: 1, fatos: 0 });
      await p.propagar();
    });

    it('a solicitação sem quem a aprove fica no diálogo, com a mensagem da API', async () => {
      p = await montarPagina([laudo], { pendencias: [pendencia(laudo, { situacao: 'PENDENTE' })] });
      botao('Enviar solicitação')?.click();
      await p.propagar();
      await p.propagar();
      enviar().click();
      p.http.expectOne(SOLICITACOES).flush(
        ...recusa422({
          code: 'uniplus.configuracao.protecao_do_catalogo.sem_quem_aprove',
          title: 'Ninguém tem a permissão de aprovar a proteção de dados do catálogo',
        }),
      );
      await p.propagar();

      expect(texto()).toContain(
        'Ninguém tem a permissão de aprovar a proteção de dados do catálogo',
      );
      expect(botao('Enviar solicitação')).toBeDefined();
    });
  });

  describe('aceite da recomendação', () => {
    const abrirAceite = async (tipo = laudo): Promise<void> => {
      await abrirDetalhe(tipo);
      botao('Aceitar recomendação')?.click();
      await p.propagar();
    };
    const dialogoDoAceite = (): HTMLElement => {
      const achado = [
        ...p.fixture.nativeElement.querySelectorAll('cfg-confirmacao-de-remocao'),
      ].find((c: HTMLElement) => c.textContent?.includes('Aceitar a recomendação'));
      expect(achado).toBeTruthy();
      return achado as HTMLElement;
    };
    const confirmar = async (): Promise<void> => {
      (
        dialogoDoAceite().querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLElement
      ).click();
      await p.propagar();
    };
    const falha = (status: number, corpo: object = {}) =>
      [
        JSON.stringify({ status, title: 'Falha', ...corpo }),
        { status, statusText: 'Falha', headers: { 'content-type': 'application/problem+json' } },
      ] as const;

    it('aceita a recomendação, relê a lista, e o tipo sai da lista de pendências', async () => {
      p = await montarPagina([laudo], { pendencias: [ajuste()] });
      await abrirAceite();
      p.http.match(ATOS(laudo.id));
      expect(p.store.detalheAberto()).toBe(false);
      expect(dialogoDoAceite().textContent).toContain('Pessoal sensível');
      await confirmar();

      const post = p.http.expectOne(ACEITE(laudo.id));
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      post.flush(...sucesso());
      await p.recarregarCom([{ ...laudo, classificacaoProtecao: 'SENSIVEL' }]);

      expect(botao('Aceitar recomendação')).toBeUndefined();
      expect(texto()).toContain('Aprovada');
      expect(p.sucessos).toHaveBeenCalledWith('Recomendação aceita', 'LAUDO_MEDICO');
    });

    it('a recusa fica no diálogo, com a mensagem da API, e relê a situação e a lista', async () => {
      p = await montarPagina([laudo], { pendencias: [ajuste()] });
      await abrirAceite();
      p.http.match(ATOS(laudo.id));
      await confirmar();
      p.http.expectOne(ACEITE(laudo.id)).flush(
        ...falha(422, {
          code: 'uniplus.configuracao.protecao_do_catalogo.recomendacao_incompativel_com_a_hipotese_legal',
          title: 'A base legal do item não cabe na classificação recomendada',
        }),
      );
      await p.propagar();

      expect(p.edicao.confirmandoAceite()).toBe(true);
      expect(dialogoDoAceite().textContent).toContain(
        'A base legal do item não cabe na classificação recomendada',
      );
      p.atenderProtecao([ajuste()]);
      p.http.expectOne((r) => r.url === LISTA).flush([laudo]);
      await p.propagar();
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('o 5xx repete a Idempotency-Key e avisa por toast; a recusa 4xx troca a chave', async () => {
      p = await montarPagina([laudo], { pendencias: [ajuste()] });
      await abrirAceite();
      p.http.match(ATOS(laudo.id));

      await confirmar();
      const primeira = p.http.expectOne(ACEITE(laudo.id));
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...falha(503));
      await p.propagar();
      expect(p.erros).toHaveBeenCalledTimes(1);
      p.atenderProtecao([ajuste()]);
      p.http.expectOne((r) => r.url === LISTA).flush([laudo]);
      await p.propagar();

      await confirmar();
      const segunda = p.http.expectOne(ACEITE(laudo.id));
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush(...falha(422));
      await p.propagar();
      p.atenderProtecao([ajuste()]);
      p.http.expectOne((r) => r.url === LISTA).flush([laudo]);
      await p.propagar();

      await confirmar();
      const terceira = p.http.expectOne(ACEITE(laudo.id));
      expect(terceira.request.headers.get('Idempotency-Key')).not.toBe(chave);
      terceira.flush(...sucesso());
      await p.recarregarCom([laudo]);
    });

    it('cancelar o aceite fecha sem requisição e leva o foco ao título da lista', async () => {
      p = await montarPagina([laudo], { pendencias: [ajuste()] });
      await abrirAceite();
      p.http.match(ATOS(laudo.id));
      (
        dialogoDoAceite().querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLElement
      ).click();
      await p.propagar();
      await p.propagar();

      p.http.expectNone(ACEITE(laudo.id));
      expect(p.edicao.confirmandoAceite()).toBe(false);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });
  });
});
