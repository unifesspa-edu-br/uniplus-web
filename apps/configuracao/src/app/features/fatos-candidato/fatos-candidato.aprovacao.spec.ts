import { afterEach, describe, expect, it } from 'vitest';
import { atenderHistoricosDoDrawer } from '../../shared/protecao-do-catalogo/historicos-do-drawer.testing';
import {
  LISTA,
  PERMISSAO_DE_CONSULTAR,
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

const ajuste = comAprovacao(trabalha, 'AJUSTE_RECOMENDADO', 'SENSIVEL');
const CONFIRMAR = 'dialog[open] [data-testid="confirm-dialog-confirm"]';
const CANCELAR = 'dialog[open] [data-testid="confirm-dialog-cancel"]';
const atosDe = (id: string) => `${LISTA}/${id}/protecao/atos`;

describe('FatosCandidatoPage — aprovação da proteção de dados', () => {
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    atenderHistoricosDoDrawer(p.http);
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
});
