import { afterEach, describe, expect, it } from 'vitest';
import {
  LISTA,
  PERMISSAO_DE_CONSULTAR,
  PERMISSAO_DE_MANTER,
  PROTECAO,
  Pagina,
  comAprovacao,
  corRaca,
  montarPagina,
  pendencia,
  problema,
  sucesso,
  trabalha,
  urlDoFato,
} from './fatos-candidato.testing';

const inativo = { ...trabalha, ativo: false };
const ajuste = comAprovacao(trabalha, 'AJUSTE_RECOMENDADO', 'SENSIVEL');
const CONFIRMAR = 'dialog[open] [data-testid="confirm-dialog-confirm"]';
const CANCELAR = 'dialog[open] [data-testid="confirm-dialog-cancel"]';
const atosDe = (id: string) => `${LISTA}/${id}/protecao/atos`;

describe('FatosCandidatoPage — desativar, reativar e aceitar a recomendação', () => {
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  const confirmar = async (): Promise<void> => {
    await p.acionar(p.elemento(CONFIRMAR));
  };
  const abrirDetalhe = async (fato = trabalha): Promise<void> => {
    await p.acionar(p.nomeDaLinha(fato));
    p.http.match((r) => r.url === atosDe(fato.id)).forEach((r) => r.flush([]));
    await p.propagar();
  };

  describe('o fato de sistema', () => {
    it('mostra o desativar desabilitado, com o porquê, e não oferece reativar', async () => {
      p = await montarPagina([{ ...trabalha, sistema: true }]);

      const desativar = p.desativar();
      expect(desativar.matches(':disabled')).toBe(true);
      expect(p.texto(`#${desativar.getAttribute('aria-describedby')}`)).toContain(
        'Fato de sistema',
      );
      expect(p.existe('[aria-label^="Reativar"]')).toBe(false);
    });
  });

  describe('desativar', () => {
    it('pede confirmação, avisa o que acontece e não escreve antes do "Desativar"', async () => {
      p = await montarPagina([trabalha]);

      await p.acionar(p.desativar());

      expect(p.texto('dialog[open]')).toContain('Deseja desativar o fato TRABALHA?');
      expect(p.texto('dialog[open]')).toContain('O fato pode ser reativado depois.');
      p.http.expectNone((r) => r.method === 'DELETE');
    });

    it('cancelar fecha sem escrever e devolve o foco ao botão da linha', async () => {
      p = await montarPagina([trabalha]);
      await p.acionar(p.desativar());

      await p.acionar(p.elemento(CANCELAR));

      p.http.expectNone((r) => r.method === 'DELETE');
      expect(p.existe('dialog[open]')).toBe(false);
      expect(document.activeElement).toBe(p.desativar());
    });

    it('confirmado vai à API, avisa, recarrega a lista e leva o foco ao título dela', async () => {
      p = await montarPagina([trabalha]);
      await p.acionar(p.desativar());

      await confirmar();
      const pedido = p.http.expectOne(
        (r) => r.method === 'DELETE' && r.url === urlDoFato(trabalha),
      );
      expect(p.elemento(CONFIRMAR).getAttribute('aria-busy')).toBe('true');
      pedido.flush(...sucesso());
      await p.recarregarCom([corRaca]);

      expect(p.texto('tbody')).toContain('COR_RACA');
      expect(p.texto('tbody')).not.toContain('TRABALHA');
      expect(p.sucessos).toHaveBeenCalledWith('Fato desativado', 'TRABALHA');
      expect(p.statusDaPagina()).toContain('Fato desativado: TRABALHA.');
      expect(document.activeElement).toBe(p.titulo());
    });

    it('enquanto grava, o diálogo não fecha e o segundo clique não repete o envio', async () => {
      p = await montarPagina([trabalha]);
      await p.acionar(p.desativar());
      await confirmar();

      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      p.elemento(CONFIRMAR).dispatchEvent(clique);
      await p.propagar();

      expect(clique.defaultPrevented).toBe(true);
      expect(p.elemento(CANCELAR).matches(':disabled')).toBe(true);
      const pedidos = p.http.match((r) => r.method === 'DELETE');
      expect(pedidos).toHaveLength(1);
      pedidos[0].flush(...sucesso());
      await p.recarregarCom([]);
    });

    it('a recusa de negócio mantém o diálogo com a mensagem da API e não vira toast', async () => {
      p = await montarPagina([trabalha]);
      await p.acionar(p.desativar());
      await confirmar();

      p.http
        .expectOne((r) => r.method === 'DELETE')
        .flush(
          ...problema(422, {
            code: 'uniplus.configuracao.fato_candidato.sistema',
            title: 'Fato de sistema não se desativa.',
          }),
        );
      await p.propagar();

      expect(p.texto('dialog[open] .field__error')).toBe('Fato de sistema não se desativa.');
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('a falha do servidor (5xx) avisa por toast e mantém o diálogo', async () => {
      p = await montarPagina([trabalha]);
      await p.acionar(p.desativar());
      await confirmar();

      p.http
        .expectOne((r) => r.method === 'DELETE')
        .flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(p.existe('dialog[open]')).toBe(true);
    });

    it('o conflito de concorrência relê a lista e mantém a mensagem', async () => {
      p = await montarPagina([trabalha]);
      await p.acionar(p.desativar());
      await confirmar();

      p.http
        .expectOne((r) => r.method === 'DELETE')
        .flush(
          ...problema(409, {
            code: 'uniplus.concorrencia.conflito',
            title: 'O fato foi alterado ao mesmo tempo.',
          }),
        );
      await p.recarregarCom([trabalha]);

      expect(p.texto('dialog[open] .field__error')).toContain(
        'Outra pessoa alterou este fato enquanto você decidia',
      );
    });
  });

  describe('com a lista em releitura', () => {
    it('durante a releitura que segue a recusa, o confirmar fica indisponível e não apaga a recusa, o cancelar só destrava com a releitura', async () => {
      p = await montarPagina([trabalha]);
      await p.acionar(p.desativar());
      await confirmar();
      p.http
        .expectOne((r) => r.method === 'DELETE')
        .flush(...problema(409, { code: 'uniplus.concorrencia.conflito', title: 'x' }));
      await p.propagar();
      const recusa = p.texto('dialog[open] .field__error');
      expect(recusa).toContain('Outra pessoa alterou este fato enquanto você decidia');
      expect(recusa).not.toContain('A lista foi atualizada');

      await confirmar();

      expect(p.texto('dialog[open] .field__error')).toBe(recusa);
      p.http.expectNone((r) => r.method === 'DELETE');
      expect(p.elemento(CONFIRMAR).getAttribute('aria-disabled')).toBe('true');
      expect(p.elemento(CANCELAR).matches(':disabled')).toBe(true);
      await p.recarregarCom([trabalha]);
      expect(p.texto('dialog[open] .field__error')).toBe(recusa);
      expect(p.elemento(CONFIRMAR).getAttribute('aria-disabled')).toBeNull();
      expect(p.elemento(CANCELAR).matches(':disabled')).toBe(false);
    });

    it('a releitura que falha também destrava o confirmar e o cancelar', async () => {
      p = await montarPagina([trabalha]);
      await p.acionar(p.desativar());
      await confirmar();
      p.http
        .expectOne((r) => r.method === 'DELETE')
        .flush(...problema(409, { code: 'uniplus.concorrencia.conflito', title: 'x' }));
      await p.propagar();
      expect(p.elemento(CANCELAR).matches(':disabled')).toBe(true);

      p.pedidoDaLista().flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      p.atenderPendencias();
      await p.propagar();

      expect(p.elemento(CONFIRMAR).getAttribute('aria-disabled')).toBeNull();
      expect(p.elemento(CANCELAR).matches(':disabled')).toBe(false);
    });

    it('a recusa que deixa a linha fora do filtro "Ativos": ao cancelar, o foco vai ao título da lista', async () => {
      p = await montarPagina([trabalha, corRaca]);
      await p.acionar(p.desativar());
      await confirmar();
      p.http
        .expectOne((r) => r.method === 'DELETE')
        .flush(...problema(409, { code: 'uniplus.concorrencia.conflito', title: 'x' }));
      await p.recarregarCom([corRaca]);

      await p.acionar(p.elemento(CANCELAR));
      await p.propagar();

      expect(p.existe('dialog[open]')).toBe(false);
      expect(document.activeElement).toBe(p.titulo());
    });
  });

  describe('o aceite com a lista em releitura', () => {
    it('o confirmar durante a releitura que segue a recusa não apaga a recusa nem envia de novo', async () => {
      p = await montarPagina([ajuste]);
      await abrirDetalhe();
      await p.acionar(p.botaoPeloTexto('Aceitar recomendação', p.detalhe()) as HTMLButtonElement);
      await confirmar();
      p.http.expectOne(`${urlDoFato(trabalha)}/aceite-da-recomendacao`).flush(
        ...problema(409, {
          code: 'uniplus.configuracao.protecao_do_catalogo.conflito_de_concorrencia',
          title: 'x',
        }),
      );
      await p.propagar();
      const recusa = p.texto('dialog[open] .field__error');
      expect(recusa).toContain('Outra pessoa alterou este fato enquanto você decidia');

      await confirmar();

      expect(p.texto('dialog[open] .field__error')).toBe(recusa);
      p.http.expectNone((r) => r.method === 'POST' && r.url.endsWith('/aceite-da-recomendacao'));
      expect(p.elemento(CONFIRMAR).getAttribute('aria-disabled')).toBe('true');
      expect(p.elemento(CANCELAR).matches(':disabled')).toBe(true);
      await p.recarregarCom([ajuste]);
      expect(p.elemento(CONFIRMAR).getAttribute('aria-disabled')).toBeNull();
    });
  });

  describe('reativar', () => {
    it('leva a chave de idempotência, avisa e recarrega a lista', async () => {
      p = await montarPagina([inativo]);
      await p.acionar(p.reativar(inativo));
      expect(p.texto('dialog[open]')).toContain('Deseja reativar o fato TRABALHA?');

      await confirmar();
      const ativacao = p.http.expectOne(`${urlDoFato(inativo)}/ativacao`);
      expect(ativacao.request.method).toBe('POST');
      expect(ativacao.request.headers.get('Idempotency-Key')).toBeTruthy();
      ativacao.flush(...sucesso());
      await p.recarregarCom([trabalha]);

      expect(p.existe('[aria-label="Desativar o fato TRABALHA"]')).toBe(true);
      expect(p.existe('[aria-label="Reativar o fato TRABALHA"]')).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith('Fato reativado', 'TRABALHA');
    });

    it('a recusa reabre a confirmação com a mensagem da API, sem repetir a pergunta', async () => {
      p = await montarPagina([inativo]);
      await p.acionar(p.reativar(inativo));
      await confirmar();

      p.http.expectOne(`${urlDoFato(inativo)}/ativacao`).flush(
        ...problema(422, {
          code: 'uniplus.configuracao.fato_candidato.ja_ativo',
          title: 'O fato já está ativo.',
        }),
      );
      await p.propagar();

      expect(p.texto('dialog[open] .field__error')).toBe('O fato já está ativo.');
      expect(p.existe('dialog[open]')).toBe(true);
    });

    it('a chave é trocada depois de uma recusa que não é de concorrência nem de processamento', async () => {
      p = await montarPagina([inativo]);
      await p.acionar(p.reativar(inativo));
      await confirmar();
      const primeira = p.http.expectOne(`${urlDoFato(inativo)}/ativacao`);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(
        ...problema(422, { code: 'uniplus.configuracao.fato_candidato.ja_ativo', title: 'x' }),
      );
      await p.propagar();

      await confirmar();
      const segunda = p.http.expectOne(`${urlDoFato(inativo)}/ativacao`);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush(...sucesso());
      await p.recarregarCom([trabalha]);
    });

    it('depois de reativar um fato, salvar outro com a lista atrasada não mostra "Reativando" na linha do primeiro', async () => {
      p = await montarPagina([inativo, corRaca]);
      await p.acionar(p.reativar(inativo));
      await confirmar();
      p.http.expectOne(`${urlDoFato(inativo)}/ativacao`).flush(...sucesso());
      await p.propagar();
      expect(p.texto('tbody')).toContain('Reativando');
      await p.recarregarCom([trabalha, corRaca]);
      expect(p.texto('tbody')).not.toContain('Reativando');

      p.edicao.recarregar();
      await p.propagar();
      expect(p.texto('tbody')).not.toContain('Reativando');
      await p.recarregarCom([trabalha, corRaca]);

      await p.abrirEdicao(corRaca);
      p.submeter('#cfg-fato-descritivo');
      await p.propagar();
      p.http
        .expectOne((r) => r.method === 'PUT' && r.url === urlDoFato(corRaca))
        .flush(...sucesso());
      await p.propagar();
      p.http.expectOne(urlDoFato(corRaca)).flush(structuredClone(corRaca));
      p.atenderPendencias();
      await p.propagar();

      expect(p.edicao.gravando()).toBe(true);
      expect(p.texto('tbody')).not.toContain('Reativando');
      p.pedidoDaLista().flush([trabalha, corRaca]);
      p.atenderPendencias();
      await p.propagar();
    });

    it('cada linha oferece só a ação da sua situação: o ativo desativa, o inativo reativa', async () => {
      const outro = { ...corRaca, ativo: false };
      p = await montarPagina([trabalha, outro]);

      expect(p.existe('[aria-label="Desativar o fato TRABALHA"]')).toBe(true);
      expect(p.existe('[aria-label="Reativar o fato TRABALHA"]')).toBe(false);
      expect(p.existe('[aria-label="Reativar o fato COR_RACA"]')).toBe(true);
      expect(p.existe('[aria-label="Desativar o fato COR_RACA"]')).toBe(false);
    });
  });

  describe('permissões', () => {
    it('sem manter não oferece desativar, reativar nem aceitar', async () => {
      p = await montarPagina([trabalha, ajuste], { concedidas: [PERMISSAO_DE_CONSULTAR] });

      expect(p.existe('[aria-label^="Desativar"]')).toBe(false);
      expect(p.existe('[aria-label^="Reativar"]')).toBe(false);
    });
  });

  describe('aprovação da proteção de dados', () => {
    it('diz a situação como texto e, na negativa, a classificação recomendada, inclusive no fato de sistema', async () => {
      p = await montarPagina([{ ...ajuste, sistema: true }]);

      expect(p.texto('tbody')).toContain('Ajuste recomendado');
      expect(p.texto('tbody')).not.toContain('Classificação recomendada');
      await abrirDetalhe();
      expect(p.texto()).toContain('Classificação recomendada: Pessoal sensível');
      expect(p.botaoPeloTexto('Aceitar recomendação', p.detalhe())).toBeDefined();
    });

    it('aceita a recomendação com a chave de idempotência e recarrega a lista', async () => {
      p = await montarPagina([ajuste]);
      await abrirDetalhe();
      await p.acionar(p.botaoPeloTexto('Aceitar recomendação', p.detalhe()) as HTMLButtonElement);
      expect(p.texto('dialog[open]')).toContain('Pessoal sensível');

      await confirmar();
      const post = p.http.expectOne(`${urlDoFato(trabalha)}/aceite-da-recomendacao`);
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      post.flush(...sucesso());
      await p.recarregarCom([comAprovacao(trabalha, 'APROVADA')]);

      expect(p.texto('tbody')).toContain('Aprovada');
      expect(p.texto('tbody')).not.toContain('Ajuste recomendado');
      expect(p.sucessos).toHaveBeenCalledWith('Recomendação aceita', 'TRABALHA');
    });

    it('depois do aceite feito no detalhe, o foco volta ao nome da linha, de onde o detalhe foi aberto', async () => {
      p = await montarPagina([ajuste]);
      await abrirDetalhe();
      await p.acionar(p.botaoPeloTexto('Aceitar recomendação', p.detalhe()) as HTMLButtonElement);
      await confirmar();
      p.http.expectOne(`${urlDoFato(trabalha)}/aceite-da-recomendacao`).flush(...sucesso());

      await p.recarregarCom([comAprovacao(trabalha, 'APROVADA')]);
      await p.propagar();

      expect(document.activeElement).toBe(p.nomeDaLinha());
    });

    it('o aceite recusado cuja linha saiu da página: ao cancelar, o foco vai ao título da lista', async () => {
      p = await montarPagina([ajuste]);
      await abrirDetalhe();
      await p.acionar(p.botaoPeloTexto('Aceitar recomendação', p.detalhe()) as HTMLButtonElement);
      await confirmar();
      p.http.expectOne(`${urlDoFato(trabalha)}/aceite-da-recomendacao`).flush(
        ...problema(409, {
          code: 'uniplus.configuracao.protecao_do_catalogo.conflito_de_concorrencia',
          title: 'x',
        }),
      );
      await p.recarregarCom([corRaca]);

      await p.acionar(p.elemento(CANCELAR));
      await p.propagar();

      expect(document.activeElement).toBe(p.titulo());
    });

    it('o aceite que dá certo e deixa a linha fora da página leva o foco ao título, não a uma ação anterior de outra linha', async () => {
      p = await montarPagina([ajuste, corRaca]);
      await p.acionar(p.desativar(corRaca));
      await p.acionar(p.elemento(CANCELAR));
      await abrirDetalhe();
      await p.acionar(p.botaoPeloTexto('Aceitar recomendação', p.detalhe()) as HTMLButtonElement);
      await confirmar();
      p.http.expectOne(`${urlDoFato(trabalha)}/aceite-da-recomendacao`).flush(...sucesso());

      await p.recarregarCom([corRaca]);
      await p.propagar();

      expect(p.texto('tbody')).not.toContain('TRABALHA');
      expect(document.activeElement).toBe(p.titulo());
    });

    it('a recusa do aceite relê a lista e a situação, e reabre o diálogo com a mensagem da API', async () => {
      p = await montarPagina([ajuste]);
      await abrirDetalhe();
      await p.acionar(p.botaoPeloTexto('Aceitar recomendação', p.detalhe()) as HTMLButtonElement);
      await confirmar();

      p.http.expectOne(`${urlDoFato(trabalha)}/aceite-da-recomendacao`).flush(
        ...problema(409, {
          code: 'uniplus.configuracao.protecao_do_catalogo.conflito_de_concorrencia',
          title: 'O fato foi alterado ao mesmo tempo',
        }),
      );
      await p.recarregarCom([comAprovacao(trabalha, 'PENDENTE')]);

      expect(p.texto('dialog[open] .field__error')).toContain(
        'Outra pessoa alterou este fato enquanto você decidia',
      );
    });

    it('sem a permissão de manter não oferece "Aceitar recomendação" nem "Enviar solicitação"', async () => {
      p = await montarPagina([ajuste], { concedidas: [PERMISSAO_DE_CONSULTAR] });
      await abrirDetalhe();

      expect(p.botaoPeloTexto('Aceitar recomendação', p.detalhe())).toBeUndefined();
      expect(p.botaoPeloTexto('Enviar solicitação')).toBeUndefined();
    });

    it('quem só consulta não pede a lista de pendências, que a API recusa', async () => {
      p = await montarPagina([comAprovacao(trabalha, 'APROVADA')], {
        concedidas: [PERMISSAO_DE_CONSULTAR],
      });

      p.http.expectNone((r) => r.url === PROTECAO);
    });

    it('oferece "Enviar solicitação" com fato pendente e a envia de uma vez, levando o foco ao título', async () => {
      const pendente = comAprovacao(trabalha, 'PENDENTE');
      p = await montarPagina([pendente], { pendencias: [pendencia(trabalha)] });
      await p.acionar(p.botaoPeloTexto('Enviar solicitação') as HTMLButtonElement);
      expect(p.texto('cfg-solicitacao-da-protecao-dialog')).toContain('Trabalha');

      const enviar = [
        ...p
          .raiz()
          .querySelectorAll<HTMLButtonElement>('cfg-solicitacao-da-protecao-dialog button'),
      ].find((b) => /^Enviar \d+ it/u.test(b.textContent?.trim() ?? '')) as HTMLButtonElement;
      await p.acionar(enviar);
      const post = p.http.expectOne(`${PROTECAO}/solicitacoes`);
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      post.flush({ tiposDeDocumento: 0, fatos: 1 });
      await p.recarregarCom([comAprovacao(trabalha, 'SOLICITADA')]);
      await p.propagar();

      expect(p.botaoPeloTexto('Enviar solicitação')).toBeUndefined();
      expect(document.activeElement).toBe(p.titulo());
    });

    it('não oferece "Enviar solicitação" sem fato pendente', async () => {
      p = await montarPagina([comAprovacao(trabalha, 'SOLICITADA')]);

      expect(p.botaoPeloTexto('Enviar solicitação')).toBeUndefined();
    });

    it('recarregar a lista relê as pendências, e "Enviar solicitação" aparece com o fato novo', async () => {
      p = await montarPagina([]);
      expect(p.botaoPeloTexto('Enviar solicitação')).toBeUndefined();

      p.store.recarregar();
      await p.recarregarCom([comAprovacao(trabalha, 'PENDENTE')], [pendencia(trabalha)]);

      expect(p.botaoPeloTexto('Enviar solicitação')).toBeDefined();
    });
  });

  it('a permissão de manter está concedida por padrão nesta suíte', async () => {
    p = await montarPagina([trabalha]);

    expect(p.permissoes()).toContain(PERMISSAO_DE_MANTER);
  });
});
