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
  rg,
  sucesso,
} from './tipos-documento.testing';

const SOLICITACOES = `${PROTECAO_URL}/solicitacoes`;
const ACEITE = (id: string): string => `${ESCRITA}/${id}/aceite-da-recomendacao`;
const ATOS = (id: string): string => `${ESCRITA}/${id}/protecao/atos`;
const DETALHE = 'dialog[aria-label="Detalhe do tipo de documento"]';

describe('TiposDocumentoPage — detalhe e aprovação da proteção de dados', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());

  const texto = (): string => (p.fixture.nativeElement.textContent as string).replace(/\s+/gu, ' ');
  const painel = (): string =>
    (p.fixture.nativeElement.querySelector(DETALHE)?.textContent ?? '').replace(/\s+/gu, ' ');
  const rodape = (): string[] =>
    [...p.fixture.nativeElement.querySelectorAll(`${DETALHE} .form-drawer__footer button`)].map(
      (b: HTMLElement) => b.textContent?.trim() ?? '',
    );
  const botao = (
    rotulo: string,
    onde = '.panel-head__actions button, .form-drawer__footer button',
  ) =>
    [...p.fixture.nativeElement.querySelectorAll(onde)].find((b: HTMLElement) =>
      b.textContent?.includes(rotulo),
    ) as HTMLButtonElement | undefined;
  const abrirDetalhe = async (tipo = rg): Promise<void> => {
    p.nomeDaLinha(tipo).click();
    await p.propagar();
  };
  const ajuste = (tipo = laudo) =>
    pendencia(tipo, { situacao: 'AJUSTE_RECOMENDADO', classificacaoRecomendada: 'SENSIVEL' });
  const ato = (extra: object) => ({
    ato: 'SOLICITACAO',
    instante: '2026-10-30T15:00:00Z',
    atorNome: 'Isabella Moura',
    classificacaoProtecao: 'PESSOAL',
    hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    finalidadeTratamento: 'Conferir o documento do candidato.',
    classificacaoRecomendada: null,
    justificativa: null,
    ...extra,
  });

  describe('detalhe', () => {
    it('o nome da linha é um botão nativo com nome acessível, e a linha não é clicável', async () => {
      p = await montarPagina([rg]);
      const alvo = p.nomeDaLinha(rg);

      expect(alvo.tagName).toBe('BUTTON');
      expect(alvo.type).toBe('button');
      expect(alvo.getAttribute('aria-label')).toBe('Ver o detalhe de Registro Geral');
      expect(p.fixture.nativeElement.querySelector('tbody tr').hasAttribute('onclick')).toBe(false);
    });

    it('abre o drawer só de leitura com todos os campos que a consulta devolve', async () => {
      p = await montarPagina([rg], { pendencias: [pendencia(rg, { situacao: 'SOLICITADA' })] });
      await abrirDetalhe();
      p.http.expectOne(ATOS(rg.id)).flush([]);
      await p.propagar();

      expect(p.store.detalheAberto()).toBe(true);
      expect(p.elemento(`${DETALHE} .uni-drawer__title`).textContent?.trim()).toBe(
        'Registro Geral',
      );
      for (const esperado of [
        'RG',
        'Documento de identificação civil.',
        'Identificação',
        'CIN',
        'pdf,jpg',
        '10 MB',
        'Pessoal',
        'Execução de políticas públicas',
        'Conferir o documento do candidato.',
        'Em análise',
        'Cadastrado em',
        '10/06/2026',
      ]) {
        expect(painel(), esperado).toContain(esperado);
      }
      expect(
        p.fixture.nativeElement.querySelector(`${DETALHE} input, ${DETALHE} textarea`),
      ).toBeNull();
    });

    it('"Editar" fecha o detalhe e abre a edição do mesmo tipo', async () => {
      p = await montarPagina([rg], { pendencias: [pendencia(rg, { situacao: 'APROVADA' })] });
      await abrirDetalhe();
      p.http.expectOne(ATOS(rg.id)).flush([]);
      expect(rodape()).toEqual(['Fechar', 'Editar']);

      botao('Editar', `${DETALHE} .form-drawer__footer button`)?.click();
      await p.propagar();

      expect(p.store.detalheAberto()).toBe(false);
      expect(p.edicao.aberto()).toBe(true);
      expect(p.edicao.modo()).toBe('editar');
      expect(p.edicao.form.controls.codigo.value).toBe('RG');
    });

    it('oferece "Aceitar recomendação" só com a recomendação do tipo negado', async () => {
      p = await montarPagina([rg, laudo], { pendencias: [ajuste()] });
      await abrirDetalhe(rg);
      expect(rodape()).toEqual(['Fechar', 'Editar']);
      p.store.detalheAberto.set(false);
      await p.propagar();

      await abrirDetalhe(laudo);
      expect(rodape()).toEqual(['Fechar', 'Aceitar recomendação', 'Editar']);
      expect(painel()).toContain('Classificação recomendada: Pessoal sensível');
      expect(painel()).toContain('Ajuste recomendado');
    });

    it('no tipo reprovado mostra a justificativa e oferece "Editar", sem "Aceitar recomendação"', async () => {
      p = await montarPagina([laudo], {
        pendencias: [
          pendencia(laudo, { situacao: 'REPROVADA', justificativa: 'O laudo traz dado de saúde.' }),
        ],
      });
      await abrirDetalhe(laudo);

      expect(rodape()).toEqual(['Fechar', 'Editar']);
      expect(painel()).toContain('Reprovada');
      expect(painel()).toContain('Justificativa: O laudo traz dado de saúde.');
      expect(painel()).not.toContain('Classificação recomendada');
    });

    it('o tipo sem tamanho máximo, descrição e equivalente mostra o travessão', async () => {
      p = await montarPagina([laudo], { pendencias: [pendencia(laudo, { situacao: 'APROVADA' })] });
      await abrirDetalhe(laudo);
      p.http.expectOne(ATOS(laudo.id)).flush([]);
      await p.propagar();

      const linhas = [...p.fixture.nativeElement.querySelectorAll(`${DETALHE} dl div`)].map(
        (d: HTMLElement) => d.textContent?.replace(/\s+/gu, ''),
      );
      expect(linhas).toContain('Tamanhomáximo—');
      expect(linhas).toContain('Tipoequivalente—');
    });

    it('ao editar o tipo reprovado, o formulário explica a decisão e não oferece o aceite', async () => {
      p = await montarPagina([laudo], {
        pendencias: [
          pendencia(laudo, { situacao: 'REPROVADA', justificativa: 'O laudo traz dado de saúde.' }),
        ],
      });
      await p.abrirEdicao(laudo);

      const aviso = p.elemento('cfg-tipo-documento-avisos').textContent ?? '';
      expect(aviso).toContain('Reprovado pela proteção de dados');
      expect(aviso).toContain('Justificativa: O laudo traz dado de saúde.');
      expect(aviso).not.toContain('Aceitar recomendação');
    });

    it('ao editar o tipo com ajuste recomendado, o formulário cita a classificação e o caminho do aceite', async () => {
      p = await montarPagina([laudo], { pendencias: [ajuste()] });
      await p.abrirEdicao(laudo);

      const aviso = p.elemento('cfg-tipo-documento-avisos').textContent ?? '';
      expect(aviso).toContain('Ajuste recomendado pela proteção de dados');
      expect(aviso).toContain('Pessoal sensível');
      expect(aviso).toContain('use "Aceitar recomendação" no detalhe');
    });

    it('sem a permissão de manter, só consulta e fecha, sem ler o histórico', async () => {
      p = await montarPagina([laudo], { concedidas: [], pendencias: [ajuste()] });
      await abrirDetalhe(laudo);

      p.http.expectNone(ATOS(laudo.id));
      expect(rodape()).toEqual(['Fechar']);
      expect(painel()).not.toContain('Histórico da proteção');
    });

    it('lê os atos só ao abrir o drawer e os mostra em ordem', async () => {
      p = await montarPagina([rg], { pendencias: [pendencia(rg, { situacao: 'APROVADA' })] });
      p.http.expectNone(ATOS(rg.id));
      await abrirDetalhe();
      p.http.expectOne(ATOS(rg.id)).flush([
        ato({}),
        ato({
          ato: 'AJUSTE_RECOMENDADO',
          atorNome: 'Caroline Ribeiro',
          classificacaoRecomendada: 'SENSIVEL',
          justificativa: 'Há dado de saúde.',
        }),
        ato({ ato: 'ACEITE' }),
      ]);
      await p.propagar();

      const t = painel();
      expect(t).toContain('Histórico da proteção');
      expect(t.indexOf('Solicitação')).toBeLessThan(t.indexOf('Ajuste recomendado'));
      expect(t.indexOf('Ajuste recomendado')).toBeLessThan(t.indexOf('Aceite da recomendação'));
      expect(t).toContain('Caroline Ribeiro');
      expect(t).toContain('Justificativa: Há dado de saúde.');
    });

    it('sem atos diz que o item ainda não passou pela proteção de dados', async () => {
      p = await montarPagina([rg], { pendencias: [pendencia(rg, { situacao: 'PENDENTE' })] });
      await abrirDetalhe();
      p.http.expectOne(ATOS(rg.id)).flush([]);
      await p.propagar();

      expect(painel()).toContain('Este item ainda não passou pela proteção de dados.');
    });
  });

  describe('situação na lista', () => {
    it('diz a situação como texto, e a negativa não traz a classificação na linha', async () => {
      p = await montarPagina([rg, laudo, diploma], {
        pendencias: [ajuste(), pendencia(diploma, { situacao: 'SOLICITADA' })],
      });

      expect(texto()).toContain('Aprovada');
      expect(texto()).toContain('Ajuste recomendado');
      expect(texto()).not.toContain('Classificação recomendada');
      expect(texto()).toContain('Em análise');
    });

    it('quando a leitura da situação falha, não diz "Aprovada" e avisa que não leu', async () => {
      p = await montarPagina([rg], { pendencias: 'falha' });

      expect(texto()).not.toContain('Aprovada');
      expect(texto()).toContain('Não foi possível ler a situação');
    });

    it('releitura que falha depois de uma boa não devolve "Aprovada" ao tipo', async () => {
      p = await montarPagina([laudo], {
        pendencias: [pendencia(laudo, { situacao: 'SOLICITADA' })],
      });
      expect(texto()).toContain('Em análise');

      p.store.aprovacao.carregar();
      p.atenderProtecao('falha');
      await p.propagar();

      expect(texto()).not.toContain('Aprovada');
      expect(p.store.aprovacao.aprovacaoDe(laudo.id)).toBeNull();
      expect(p.store.aprovacao.solicitaveis()).toEqual([]);
    });
  });

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
