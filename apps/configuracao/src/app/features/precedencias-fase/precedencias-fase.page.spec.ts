import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CATALOGO,
  ESCRITA,
  FASES,
  LISTA,
  Pagina,
  avaliacaoClassificacao,
  criado,
  faseCanonica,
  inscricaoHomologacao,
  montarPagina,
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
      p = await montarPagina([inscricaoHomologacao, avaliacaoClassificacao], {
        cadastro: [faseCanonica('AVALIACAO', 'Avaliação')],
      });
    });
    afterEach(() => p.http.verify());

    it('lista as arestas com antecessora, sucessora, nome da fase e sobreposição', () => {
      expect(linhas()).toHaveLength(2);
      const texto = linhas()[0].textContent ?? '';
      expect(texto).toContain('INSCRICAO');
      expect(texto).toContain('HOMOLOGACAO_INSCRICOES');
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
      expect(linhas()[0].textContent).toContain('HOMOLOGACAO_INSCRICOES');

      await buscar('nada');
      expect(p.fixture.nativeElement.textContent).toContain('Nenhuma aresta encontrada');
    });

    it('as opções vêm do catálogo, na ordem dele, e marcam as fases ainda não cadastradas', async () => {
      p.novo().click();
      await p.propagar();

      expect(opcoesDe('antecessoraCodigo').slice(1)).toEqual([
        'INSCRICAO — Inscrição (não cadastrada)',
        'HOMOLOGACAO_INSCRICOES — Homologação (não cadastrada)',
        'AVALIACAO — Avaliação',
        'CLASSIFICACAO — Classificação (não cadastrada)',
        'RESULTADO_FINAL — Resultado final (não cadastrada)',
      ]);
      expect(opcoesDe('sucessoraCodigo').slice(1)).toEqual(opcoesDe('antecessoraCodigo').slice(1));
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
      expect([sucessora.readOnly, sucessora.value]).toEqual([true, 'HOMOLOGACAO_INSCRICOES']);

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
        'Deseja remover a aresta de INSCRICAO para HOMOLOGACAO_INSCRICOES?',
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
      expect(p.sucessos).toHaveBeenCalledWith(
        'Aresta removida',
        'INSCRICAO → HOMOLOGACAO_INSCRICOES',
      );
      expect(p.statusDaPagina()).toBe('Aresta INSCRICAO → HOMOLOGACAO_INSCRICOES removida.');
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

    it('percorre todas as páginas do cadastro sem truncar, e só marca a fase que falta nele', async () => {
      p = await montarPagina([inscricaoHomologacao], {
        cadastro: [faseCanonica('INSCRICAO', 'Inscrição')],
        linkDoCadastro: `<${FASES}?cursor=pagina-2&direction=next>; rel="next"`,
      });
      p.http
        .expectOne((r) => r.url === FASES && r.params.get('cursor') === 'pagina-2')
        .flush([faseCanonica('HOMOLOGACAO_INSCRICOES', 'Homologação')]);
      await p.propagar();
      p.novo().click();
      await p.propagar();

      expect(opcoesDe('antecessoraCodigo')).toContain('INSCRICAO — Inscrição');
      expect(opcoesDe('antecessoraCodigo')).toContain('HOMOLOGACAO_INSCRICOES — Homologação');
      expect(opcoesDe('antecessoraCodigo')).toContain('AVALIACAO — Avaliação (não cadastrada)');
    });

    it('a falha do cadastro tira só a marca: as opções e a lista seguem, sem aviso', async () => {
      p = await montarPagina([inscricaoHomologacao], { cadastro: 'falha' });
      p.novo().click();
      await p.propagar();

      expect(opcoesDe('antecessoraCodigo')).toContain('INSCRICAO — Inscrição');
      expect(opcoesDe('antecessoraCodigo').join()).not.toContain('(não cadastrada)');
      expect(linhas()[0].textContent).toContain('Inscrição');
      expect(p.fixture.nativeElement.textContent).not.toContain('Fases indisponíveis');
    });

    it('enquanto o cadastro carrega, as opções não afirmam que a fase falta', async () => {
      p = await montarPagina([inscricaoHomologacao], { cadastro: 'pendente' });
      p.novo().click();
      await p.propagar();
      expect(opcoesDe('antecessoraCodigo')).toContain('INSCRICAO — Inscrição');

      await p.responderCadastro([faseCanonica('AVALIACAO', 'Avaliação')]);
      expect(opcoesDe('antecessoraCodigo')).toContain('INSCRICAO — Inscrição (não cadastrada)');
      expect(opcoesDe('antecessoraCodigo')).toContain('AVALIACAO — Avaliação');
    });
  });

  describe('catálogo de fases', () => {
    afterEach(() => p.http.verify());

    const aviso = (): HTMLElement | null =>
      [
        ...(p.fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
          ':scope > ui-falha-de-leitura',
        ),
      ].find((a) => a.textContent?.includes('Fases indisponíveis')) ?? null;

    const antecessora = (linha: HTMLElement): string | undefined =>
      linha
        .querySelector('td[data-label="Fase antecessora"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();

    it('a lista mostra o nome do catálogo e só o código da fase que o catálogo não tem', async () => {
      p = await montarPagina([inscricaoHomologacao, avaliacaoClassificacao], {
        catalogo: [{ codigo: 'AVALIACAO', nome: 'Avaliação' }],
      });

      expect(antecessora(linhas()[0])).toBe('INSCRICAO');
      expect(antecessora(linhas()[1])).toBe('AVALIACAO Avaliação');
    });

    it('a falha do catálogo deixa o formulário sem fases, sem se confundir com a falha da lista', async () => {
      p = await montarPagina([inscricaoHomologacao], { catalogo: 'falha' });
      p.novo().click();
      await p.propagar();

      expect(p.store.mensagemDeErro()).toBeNull();
      expect(opcoesDe('antecessoraCodigo')).toEqual(['Selecione a fase antecessora']);
      expect(linhas()[0].textContent).toContain('INSCRICAO');
    });

    it('um catálogo sem fases conta como falha', async () => {
      p = await montarPagina([inscricaoHomologacao], { catalogo: [] });

      expect(aviso()).not.toBeNull();
    });

    it('enquanto o catálogo carrega não há opções, e elas chegam na ordem da resposta', async () => {
      p = await montarPagina([inscricaoHomologacao], { catalogo: 'pendente' });
      p.novo().click();
      await p.propagar();
      expect(opcoesDe('antecessoraCodigo')).toEqual(['Selecione a fase antecessora']);

      await p.responderCatalogo([
        { codigo: 'AVALIACAO', nome: 'Avaliação' },
        { codigo: 'INSCRICAO', nome: 'Inscrição' },
      ]);
      expect(opcoesDe('antecessoraCodigo').slice(1)).toEqual([
        'AVALIACAO — Avaliação (não cadastrada)',
        'INSCRICAO — Inscrição (não cadastrada)',
      ]);
    });

    it('a falha tem um só aviso, na página, e "Tentar novamente" recarrega e devolve o foco ao título', async () => {
      p = await montarPagina([inscricaoHomologacao], { catalogo: 'falha' });
      expect(aviso()?.textContent).toContain('a lista e a busca mostram só os códigos');

      const tentar = aviso()?.querySelector('button') as HTMLButtonElement;
      tentar.focus();
      tentar.click();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === CATALOGO)
        .flush([{ codigo: 'INSCRICAO', nome: 'Inscrição' }]);
      await p.propagar();
      await p.propagar();

      expect(aviso()).toBeNull();
      expect(p.fasesDoGrafo.nomeDaFase('INSCRICAO')).toBe('Inscrição');
      expect(document.activeElement).toBe(p.elemento('#cfg-precedencias-fase-list-title'));
    });

    it('com o formulário aberto, a nova tentativa está nele e a mesma leitura recarrega uma só vez', async () => {
      p = await montarPagina([inscricaoHomologacao], { catalogo: 'falha' });
      p.novo().click();
      await p.propagar();

      const formulario = p.elemento('cfg-precedencia-formulario');
      const tentar = formulario.querySelector<HTMLButtonElement>(
        'ui-falha-de-leitura-do-campo button',
      );
      expect(formulario.textContent).toContain('Tentar novamente');
      tentar?.click();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === CATALOGO)
        .flush([{ codigo: 'INSCRICAO', nome: 'Inscrição' }]);
      await p.propagar();
      await p.propagar();

      expect(formulario.querySelector('ui-falha-de-leitura-do-campo button')).toBeNull();
      expect(opcoesDe('antecessoraCodigo')).toContain('INSCRICAO — Inscrição (não cadastrada)');
    });
  });
});
