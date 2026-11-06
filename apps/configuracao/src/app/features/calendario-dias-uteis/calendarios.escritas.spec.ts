import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CALENDARIO_ANTERIOR,
  CALENDARIO_VIGENTE,
  CONFLITO_DE_CONCORRENCIA,
  ESCRITA,
  JA_VIGENTE,
  LISTA,
  NAO_ENCONTRADO,
  PROCESSANDO,
  PaginaDaLista,
  REMOCAO_DO_VIGENTE,
  chaveDe,
  montarLista,
  problema,
  semConteudo,
} from './calendarios.testing';

const REMOCAO = `${ESCRITA}/${CALENDARIO_ANTERIOR.id}`;
const VIGENCIA = `${REMOCAO}/vigente`;

describe('CalendarioDiasUteisListPage — escritas pela interface', () => {
  let p: PaginaDaLista;

  beforeEach(async () => {
    p = await montarLista();
  });
  afterEach(() => p.http.verify());

  const acionadoresDaPagina = (): HTMLElement[] => [
    ...p.fixture.nativeElement.querySelectorAll(
      'cfg-calendarios-lista button, cfg-calendarios-lista a',
    ),
  ];
  const indisponivel = (item: HTMLElement): boolean =>
    item.matches(':disabled') || item.getAttribute('aria-disabled') === 'true';
  const textoDoDialogo = (qual: 'remocao' | 'vigencia'): string =>
    p.confirmacao(qual).textContent ?? '';
  const anuncioDoDialogo = (qual: 'remocao' | 'vigencia'): string =>
    p.confirmacao(qual).querySelector('[role="status"]')?.textContent ?? '';

  describe('remoção pendente', () => {
    it('anuncia o andamento, rotula a linha e deixa todos os acionadores indisponíveis', async () => {
      const del = await p.confirmarRemocao();

      expect(p.edicao.removendo()).toBe(true);
      expect(p.edicao.marcando()).toBe(false);
      expect(p.fixture.nativeElement.textContent).toContain('Removendo...');
      expect(anuncioDoDialogo('remocao')).toContain('Removendo o calendário 2025.2.');
      expect(acionadoresDaPagina().length).toBeGreaterThanOrEqual(5);
      expect(acionadoresDaPagina().filter((item) => !indisponivel(item))).toEqual([]);
      expect(p.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(p.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(p.confirmar());

      del.flush(...semConteudo());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      await p.recarregarCom([CALENDARIO_VIGENTE]);
      expect(p.edicao.gravando()).toBe(false);
    });

    it('não fecha por Cancelar, X nem Esc, e o segundo clique não envia', async () => {
      const del = await p.confirmarRemocao();

      expect(p.cancelarDaConfirmacao().matches(':disabled')).toBe(true);
      expect(
        p.dialogo('remocao').querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
          ?.disabled,
      ).toBe(true);
      p.dialogo('remocao').dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar().click();
      await p.propagar();
      expect(p.edicao.confirmandoRemocao()).toBe(true);
      p.http.expectNone(REMOCAO);

      del.flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_VIGENTE]);
    });

    it('"Tentar novamente" fica indisponível com a leitura falha enquanto remove', async () => {
      const del = await p.confirmarRemocao();
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(...problema(503));
      await p.propagar();

      const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      tentar.click();
      await p.propagar();
      p.http.expectNone((r) => r.url === LISTA && r.method === 'GET');

      del.flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_VIGENTE]);
    });
  });

  describe('vigência pendente', () => {
    it('anuncia o andamento, rotula a linha e mantém o foco no botão do diálogo', async () => {
      const post = await p.confirmarVigencia();

      expect(p.edicao.marcando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.fixture.nativeElement.textContent).toContain('Marcando como vigente...');
      expect(anuncioDoDialogo('vigencia')).toContain('Marcando como vigente o calendário 2025.2.');
      expect(p.confirmar('vigencia').getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(p.confirmar('vigencia'));
      expect(acionadoresDaPagina().filter((item) => !indisponivel(item))).toEqual([]);

      post.flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_VIGENTE]);
      expect(p.edicao.gravando()).toBe(false);
    });

    it('não fecha por Cancelar nem Esc e o segundo clique não envia', async () => {
      const post = await p.confirmarVigencia();

      expect(p.cancelarDaConfirmacao('vigencia').matches(':disabled')).toBe(true);
      p.dialogo('vigencia').dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar('vigencia').click();
      await p.propagar();
      expect(p.edicao.confirmandoVigencia()).toBe(true);
      p.http.expectNone(VIGENCIA);

      post.flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_VIGENTE]);
    });
  });

  describe('recusa da remoção', () => {
    it('o vigente recusado fica no diálogo, com a mensagem e o anúncio, sem toast, e relê a lista', async () => {
      const del = await p.confirmarRemocao();

      del.flush(
        ...problema(409, {
          code: REMOCAO_DO_VIGENTE,
          title: 'O dataset vigente não pode ser removido',
        }),
      );
      await p.propagar();

      expect(p.edicao.confirmandoRemocao()).toBe(true);
      expect(textoDoDialogo('remocao')).toContain('O dataset vigente não pode ser removido');
      expect(anuncioDoDialogo('remocao')).toContain(
        'Não foi possível remover o calendário 2025.2. O dataset vigente não pode ser removido',
      );
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.sucessos).not.toHaveBeenCalled();
      expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(p.cancelarDaConfirmacao().matches(':disabled')).toBe(false);
      await p.recarregarCom([
        { ...CALENDARIO_VIGENTE, vigente: false },
        { ...CALENDARIO_ANTERIOR, vigente: true },
      ]);
      expect(p.edicao.confirmandoRemocao()).toBe(true);
    });

    it.each([
      [404, NAO_ENCONTRADO],
      [409, CONFLITO_DE_CONCORRENCIA],
    ])('a recusa %s %s fica no diálogo, sem toast, e relê a lista', async (status, code) => {
      const del = await p.confirmarRemocao();

      del.flush(...problema(status, { code, title: 'Recusado pelo servidor' }));
      await p.propagar();

      expect(textoDoDialogo('remocao')).toContain('Recusado pelo servidor');
      expect(p.erros).not.toHaveBeenCalled();
      await p.recarregarCom([CALENDARIO_VIGENTE]);
    });

    it('enquanto a leitura pedida pela recusa corre, o diálogo aceita confirmar de novo', async () => {
      const del = await p.confirmarRemocao();
      del.flush(...problema(409, { code: CONFLITO_DE_CONCORRENCIA, title: 'Conflito' }));
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);

      p.confirmar().click();
      await p.propagar();
      p.http.expectOne(REMOCAO).flush(...semConteudo());
      await p.propagar();

      const leituras = p.http
        .match((r) => r.url === LISTA && r.method === 'GET')
        .filter((leitura) => !leitura.cancelled);
      expect(leituras).toHaveLength(1);
      leituras[0].flush([CALENDARIO_VIGENTE]);
      await p.propagar();
      expect(p.edicao.confirmandoRemocao()).toBe(false);
    });

    it('a falha do servidor fica no diálogo, avisa por toast e não relê a lista', async () => {
      const del = await p.confirmarRemocao();

      del.flush(...problema(500, { code: 'uniplus.erro_interno', title: 'Erro interno' }));
      await p.propagar();

      expect(textoDoDialogo('remocao')).toContain('Erro interno');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(p.edicao.gravando()).toBe(false);
      p.http.expectNone((r) => r.url === LISTA && r.method === 'GET');
    });

    it('a recusa antiga some ao confirmar de novo, e o sucesso seguinte fecha o diálogo', async () => {
      const primeira = await p.confirmarRemocao();
      primeira.flush(...problema(500, { code: 'uniplus.erro_interno', title: 'Erro interno' }));
      await p.propagar();

      p.confirmar().click();
      await p.propagar();
      expect(textoDoDialogo('remocao')).not.toContain('Erro interno');
      p.http.expectOne(REMOCAO).flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_VIGENTE]);
      expect(p.edicao.confirmandoRemocao()).toBe(false);
    });
  });

  describe('recusa da vigência e chave de idempotência', () => {
    it('o 409 de execução em curso mantém a chave e mostra a mensagem no diálogo', async () => {
      const post = await p.confirmarVigencia();
      const chave = chaveDe(post);

      post.flush(...problema(409, { code: PROCESSANDO, title: 'Escrita em processamento' }));
      await p.propagar();

      expect(textoDoDialogo('vigencia')).toContain('Escrita em processamento');
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.edicao.gravando()).toBe(false);
      p.http.expectNone((r) => r.url === LISTA && r.method === 'GET');
      p.confirmar('vigencia').click();
      await p.propagar();
      const repeticao = p.http.expectOne(VIGENCIA);
      expect(chaveDe(repeticao)).toBe(chave);
      repeticao.flush(...semConteudo());
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush([CALENDARIO_VIGENTE]);
      await p.propagar();
    });

    it.each([
      [409, JA_VIGENTE],
      [409, CONFLITO_DE_CONCORRENCIA],
      [404, NAO_ENCONTRADO],
      [422, 'uniplus.idempotency.body_mismatch'],
    ])(
      'a recusa %s %s renova a chave, fica no diálogo e não avisa por toast',
      async (status, code) => {
        const post = await p.confirmarVigencia();
        const chave = chaveDe(post);

        post.flush(...problema(status, { code, title: 'Recusado pelo servidor' }));
        await p.propagar();

        expect(textoDoDialogo('vigencia')).toContain('Recusado pelo servidor');
        expect(p.erros).not.toHaveBeenCalled();
        if (status === 404 || status === 409) {
          await p.recarregarCom([CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR]);
        }
        p.confirmar('vigencia').click();
        await p.propagar();
        const repeticao = p.http.expectOne(VIGENCIA);
        expect(chaveDe(repeticao)).not.toBe(chave);
        repeticao.flush(...semConteudo());
        await p.recarregarCom([CALENDARIO_VIGENTE]);
      },
    );

    it('a falha do servidor mantém a chave, fica no diálogo e avisa por toast', async () => {
      const post = await p.confirmarVigencia();
      const chave = chaveDe(post);

      post.flush(...problema(503, { code: 'uniplus.indisponivel', title: 'Indisponível' }));
      await p.propagar();

      expect(textoDoDialogo('vigencia')).toContain('Indisponível');
      expect(p.erros).toHaveBeenCalledTimes(1);
      p.confirmar('vigencia').click();
      await p.propagar();
      const repeticao = p.http.expectOne(VIGENCIA);
      expect(chaveDe(repeticao)).toBe(chave);
      repeticao.flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_VIGENTE]);
    });

    it('cada marcação confirmada usa uma chave própria', async () => {
      const primeira = await p.confirmarVigencia();
      const chave = chaveDe(primeira);
      primeira.flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR]);

      const segunda = await p.confirmarVigencia();
      expect(chaveDe(segunda)).not.toBe(chave);
      segunda.flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_VIGENTE]);
    });
  });

  describe('chamadas concorrentes', () => {
    it('remover durante a marcação e marcar durante a remoção não geram requisição', async () => {
      p.edicao.pedirVigencia(CALENDARIO_ANTERIOR);
      p.edicao.marcarConfirmado();
      p.edicao.pedirRemocao(CALENDARIO_ANTERIOR);
      p.edicao.removerConfirmado();
      p.edicao.marcarConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE');
      p.http.expectOne(VIGENCIA).flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_VIGENTE]);

      p.edicao.pedirRemocao(CALENDARIO_VIGENTE);
      p.edicao.removerConfirmado();
      p.edicao.pedirVigencia(CALENDARIO_ANTERIOR);
      p.edicao.marcarConfirmado();
      p.http.expectNone((r) => r.method === 'POST');
      p.http.expectOne(`${ESCRITA}/${CALENDARIO_VIGENTE.id}`).flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_ANTERIOR]);
    });

    it('confirmar sem ter pedido a remoção ou a vigência não envia nada', () => {
      p.edicao.removerConfirmado();
      p.edicao.marcarConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE' || r.method === 'POST');
    });
  });

  describe('recarga depois da escrita', () => {
    it('mantém as ações indisponíveis até a lista refletir o que foi gravado', async () => {
      (await p.confirmarRemocao()).flush(...semConteudo());
      await p.propagar();

      expect(p.edicao.removendo()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(p.remover(CALENDARIO_ANTERIOR).matches(':disabled')).toBe(true);
      await p.recarregarCom([CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.remover(CALENDARIO_ANTERIOR).matches(':disabled')).toBe(false);
    });

    it.each(['remover', 'marcar'] as const)(
      'libera as ações e permite nova leitura se a recarga após %s falhar',
      async (operacao) => {
        const requisicao =
          operacao === 'remover' ? await p.confirmarRemocao() : await p.confirmarVigencia();
        requisicao.flush(...semConteudo());
        await p.propagar();
        p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(...problema(503));
        await p.propagar();

        expect(p.edicao.gravando()).toBe(false);
        const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
        expect(tentar.getAttribute('aria-disabled')).toBeNull();
        tentar.click();
        await p.propagar();
        await p.recarregarCom([CALENDARIO_VIGENTE]);
        expect(p.store.mensagemDeErro()).toBeNull();
      },
    );

    it('depois da remoção com sucesso o status da página anuncia o desfecho, com o diálogo fechado', async () => {
      (await p.confirmarRemocao()).flush(...semConteudo());
      await p.recarregarCom([CALENDARIO_VIGENTE]);

      expect(p.statusDaPagina()).toBe('Calendário 2025.2 removido.');
    });
  });
});
