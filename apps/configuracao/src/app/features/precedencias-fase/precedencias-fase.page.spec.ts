import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  FASES,
  LISTA,
  Pagina,
  avaliacaoClassificacao,
  criado,
  faseCanonica,
  inscricaoHomologacao,
  montarPagina,
  problema,
  sucesso,
} from './precedencias-fase.testing';

describe('PrecedenciasFasePage', () => {
  let p: Pagina;

  const linhas = (): HTMLElement[] => [...p.fixture.nativeElement.querySelectorAll('tbody tr')];
  const buscar = async (termo: string): Promise<void> => {
    const busca = p.elemento<HTMLInputElement>('input[type="search"]');
    busca.value = termo;
    busca.dispatchEvent(new Event('input'));
    await p.propagar();
  };
  const opcoesDe = (campo: string): string[] =>
    [...p.campo(campo).querySelectorAll('option')].map((o) => o.textContent?.trim() ?? '');

  describe('com as fases cadastradas', () => {
    beforeEach(async () => {
      p = await montarPagina(
        [inscricaoHomologacao, avaliacaoClassificacao],
        [faseCanonica('AVALIACAO', 'Avaliação')],
      );
    });
    afterEach(() => p.http.verify());

    it('lista as arestas com antecessora, sucessora, nome da fase e sobreposição', () => {
      expect(linhas()).toHaveLength(2);
      const texto = linhas()[0].textContent ?? '';
      expect(texto).toContain('INSCRICAO');
      expect(texto).toContain('HOMOLOGACAO');
      expect(texto).toContain('Não');
      expect(linhas()[1].textContent).toContain('Avaliação');
    });

    it('pede a primeira página com o limite da tela', async () => {
      p.store.recarregar();
      await p.propagar();
      const req = p.http.expectOne((r) => r.url === LISTA);
      expect(req.request.params.get('limit')).toBe('100');
      req.flush([inscricaoHomologacao]);
      await p.propagar();
    });

    it('a busca casa pelo código e pelo nome da fase', async () => {
      await buscar('CLASSIFICACAO');
      expect(linhas()).toHaveLength(1);
      expect(linhas()[0].textContent).toContain('AVALIACAO');

      await buscar('Avaliação');
      expect(linhas()).toHaveLength(1);

      await buscar('INSCRICAO');
      expect(linhas()[0].textContent).toContain('HOMOLOGACAO');

      await buscar('nada');
      expect(p.fixture.nativeElement.textContent).toContain('Nenhuma aresta encontrada');
    });

    it('as opções cobrem o roster canônico e marcam as fases ainda não cadastradas', async () => {
      p.novo().click();
      await p.propagar();

      expect(opcoesDe('antecessoraCodigo')).toContain('AVALIACAO — Avaliação');
      expect(opcoesDe('antecessoraCodigo')).toContain('INSCRICAO — (não cadastrada)');
    });

    it('identifica as duas fases como obrigatórias para tecnologias assistivas', async () => {
      p.novo().click();
      await p.propagar();
      for (const nome of ['antecessoraCodigo', 'sucessoraCodigo']) {
        expect(p.campo(nome).getAttribute('aria-required')).toBe('true');
      }
    });

    it('descreve a tabela por uma legenda acessível', () => {
      expect(p.elemento('caption.sr-only').textContent).toContain('Precedências entre fases');
    });

    it('cria a aresta, avisa o sucesso e anuncia o desfecho na página', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(post.request.body).toEqual({
        antecessoraCodigo: 'AVALIACAO',
        sucessoraCodigo: 'CLASSIFICACAO',
        permiteSobreposicao: false,
      });
      post.flush(...criado());
      await p.recarregarCom([inscricaoHomologacao]);

      expect(p.edicao.aberto()).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith('Aresta criada');
      expect(p.statusDaPagina()).toBe('Aresta criada.');
    });

    it('na edição o par é somente leitura e a atualização leva só a sobreposição', async () => {
      await p.abrirEdicao(inscricaoHomologacao);
      const antecessora = p.campo('antecessoraCodigo') as HTMLInputElement;
      const sucessora = p.campo('sucessoraCodigo') as HTMLInputElement;
      expect([antecessora.readOnly, antecessora.value]).toEqual([true, 'INSCRICAO']);
      expect([sucessora.readOnly, sucessora.value]).toEqual([true, 'HOMOLOGACAO']);

      p.selecionar('permiteSobreposicao', 'Sim');
      const put = await p.enviar(`${ESCRITA}/${inscricaoHomologacao.id}`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ id: inscricaoHomologacao.id, permiteSobreposicao: true });
      put.flush(...sucesso());
      await p.recarregarCom([inscricaoHomologacao, avaliacaoClassificacao]);

      expect(p.sucessos).toHaveBeenCalledWith('Aresta atualizada');
      expect(p.statusDaPagina()).toBe('Aresta atualizada.');
    });

    it('o cadastro aberto depois de uma edição não herda o par nem o id da aresta editada', async () => {
      await p.abrirEdicao(inscricaoHomologacao);
      p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
      await p.propagar();
      await p.abrirCadastro();

      expect(p.campo('antecessoraCodigo').tagName).toBe('SELECT');
      const post = await p.enviar();
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({
        antecessoraCodigo: 'AVALIACAO',
        sucessoraCodigo: 'CLASSIFICACAO',
        permiteSobreposicao: false,
      });
      post.flush(...criado());
      await p.recarregarCom([inscricaoHomologacao]);
    });

    it('pede confirmação nomeando o par da linha, sem enviar nada, e a cancela', async () => {
      p.remover().click();
      await p.propagar();

      const dialogo = p.elemento('cfg-confirmacao-de-remocao');
      expect(dialogo.textContent).toContain('Remover aresta de precedência');
      expect(dialogo.textContent).toContain(
        'Deseja remover a aresta de INSCRICAO para HOMOLOGACAO?',
      );
      expect(p.confirmar().textContent?.trim()).toBe('Remover');
      p.http.expectNone(`${ESCRITA}/${inscricaoHomologacao.id}`);
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(false);
    });

    it('remove após a confirmação, avisa e anuncia o desfecho na página', async () => {
      const del = await p.confirmarRemocao(inscricaoHomologacao);
      expect(del.request.method).toBe('DELETE');
      del.flush(...sucesso());
      await p.recarregarCom([avaliacaoClassificacao]);

      expect(p.edicao.confirmando()).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith('Aresta removida', 'INSCRICAO → HOMOLOGACAO');
      expect(p.statusDaPagina()).toBe('Aresta INSCRICAO → HOMOLOGACAO removida.');
    });

    it('cada ação mostra seu ícone e sua dica', () => {
      expect(p.editar().querySelector('i')?.className).toContain('pi-pencil');
      expect(p.editar().getAttribute('data-tooltip')).toBe('Editar precedência');
      expect(p.remover().querySelector('i')?.className).toContain('pi-trash');
      expect(p.remover().getAttribute('data-tooltip')).toBe('Remover precedência');
    });

    it('segue pelo cursor e volta à primeira página ao recarregar', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush([inscricaoHomologacao], {
          headers: { Link: '</api/precedencias-fase?cursor=abc&direction=next>; rel="next"' },
        });
      await p.propagar();

      p.store.proximaPagina();
      await p.propagar();
      const proxima = p.http.expectOne((r) => r.params.get('cursor') === 'abc');
      expect(proxima.request.params.get('direction')).toBe('next');
      proxima.flush([avaliacaoClassificacao]);
      await p.propagar();
      expect(p.store.arestas()).toEqual([avaliacaoClassificacao]);

      p.store.recarregar();
      await p.propagar();
      const primeira = p.http.expectOne((r) => r.url === LISTA);
      expect(primeira.request.params.has('cursor')).toBe(false);
      primeira.flush([inscricaoHomologacao]);
      await p.propagar();
      expect(p.store.arestas()).toEqual([inscricaoHomologacao]);
    });
  });

  describe('cadastro de fases', () => {
    afterEach(() => p.http.verify());

    it('percorre todas as páginas de fases canônicas sem truncar', async () => {
      p = await montarPagina(
        [inscricaoHomologacao],
        [faseCanonica('INSCRICAO', 'Inscrição')],
        `<${FASES}?cursor=pagina-2&direction=next>; rel="next"`,
      );
      p.http
        .expectOne((r) => r.url === FASES && r.params.get('cursor') === 'pagina-2')
        .flush([faseCanonica('HOMOLOGACAO', 'Homologação')]);
      await p.propagar();

      expect(p.fasesDoGrafo.nomeDaFase('INSCRICAO')).toBe('Inscrição');
      expect(p.fasesDoGrafo.nomeDaFase('HOMOLOGACAO')).toBe('Homologação');
    });

    it('a falha ao consultar as fases degrada os rótulos sem se confundir com a da lista', async () => {
      p = await montarPagina([inscricaoHomologacao], 'falha');
      p.novo().click();
      await p.propagar();

      expect(p.store.mensagemDeErro()).toBeNull();
      expect(p.elemento('ui-drawer ui-alert').textContent).toContain(
        'Nomes das fases indisponíveis',
      );
      expect(opcoesDe('antecessoraCodigo')).toContain('INSCRICAO');
      expect(opcoesDe('antecessoraCodigo')).not.toContain('INSCRICAO — (não cadastrada)');
    });

    it('enquanto as fases carregam, as opções mostram só o código, sem "(não cadastrada)"', async () => {
      p = await montarPagina([inscricaoHomologacao], 'pendente');
      p.novo().click();
      await p.propagar();
      expect(opcoesDe('antecessoraCodigo')).toContain('INSCRICAO');
      expect(opcoesDe('antecessoraCodigo')).not.toContain('INSCRICAO — (não cadastrada)');

      await p.responderFases([faseCanonica('AVALIACAO', 'Avaliação')]);
      expect(opcoesDe('antecessoraCodigo')).toContain('INSCRICAO — (não cadastrada)');
      expect(opcoesDe('antecessoraCodigo')).toContain('AVALIACAO — Avaliação');
    });

    it('a falha das fases avisa junto da lista e "Tentar novamente" recarrega e devolve o foco ao título', async () => {
      p = await montarPagina([inscricaoHomologacao], 'falha');
      const aviso = (): HTMLElement | null =>
        [
          ...(p.fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
            ':scope > ui-alert',
          ),
        ].find((a) => a.textContent?.includes('Nomes das fases indisponíveis')) ?? null;
      const tentar = (): HTMLButtonElement => aviso()?.querySelector('button') as HTMLButtonElement;
      expect(aviso()?.textContent).toContain('Nomes das fases indisponíveis');
      expect(aviso()?.textContent).toContain('a busca por nome não encontra');

      tentar().focus();
      tentar().click();
      await p.propagar();
      expect(tentar().getAttribute('aria-disabled')).toBe('true');
      p.http.expectOne((r) => r.url === FASES).flush([faseCanonica('INSCRICAO', 'Inscrição')]);
      await p.propagar();
      await p.propagar();

      expect(aviso()).toBeNull();
      expect(p.fasesDoGrafo.nomeDaFase('INSCRICAO')).toBe('Inscrição');
      expect(document.activeElement).toBe(p.elemento('#cfg-precedencias-fase-list-title'));
    });

    it('anuncia cada nova tentativa de ler as fases, também a segunda falha seguida', async () => {
      p = await montarPagina([inscricaoHomologacao], 'falha');
      const anuncio = (): string =>
        p.elemento(':scope > span.sr-only[role="status"] + span.sr-only[role="status"]')
          .textContent ?? '';
      const tentar = (): HTMLButtonElement =>
        [
          ...(p.fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
            ':scope > ui-alert',
          ),
        ]
          .find((a) => a.textContent?.includes('Nomes das fases indisponíveis'))
          ?.querySelector('button') as HTMLButtonElement;

      for (let vez = 0; vez < 2; vez++) {
        tentar().click();
        await p.propagar();
        expect(anuncio()).toBe('Lendo nomes das fases...');
        p.http.expectOne((r) => r.url === FASES).flush(...problema(503));
        await p.propagar();
        expect(anuncio()).toBe('Falha na leitura: nomes das fases.');
      }
    });

    it('anuncia, dentro do drawer, a nova tentativa acionada pelo alerta do formulário', async () => {
      p = await montarPagina([inscricaoHomologacao], 'falha');
      p.novo().click();
      await p.propagar();
      const anuncio = (): string =>
        p.fixture.nativeElement.querySelectorAll('ui-drawer span.sr-only[role="status"]')[1]
          ?.textContent ?? '';

      for (let vez = 0; vez < 2; vez++) {
        p.elemento<HTMLButtonElement>('ui-drawer ui-alert button').click();
        await p.propagar();
        expect(anuncio()).toBe('Lendo nomes das fases...');
        p.http.expectOne((r) => r.url === FASES).flush(...problema(503));
        await p.propagar();
        expect(anuncio()).toBe('Falha na leitura: nomes das fases.');
      }
    });

    it('a nova tentativa das fases também está no alerta do formulário', async () => {
      p = await montarPagina([inscricaoHomologacao], 'falha');
      p.novo().click();
      await p.propagar();

      p.elemento<HTMLButtonElement>('ui-drawer ui-alert button').click();
      await p.propagar();
      p.http.expectOne((r) => r.url === FASES).flush([faseCanonica('INSCRICAO', 'Inscrição')]);
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert')).toBeNull();
    });
  });
});
