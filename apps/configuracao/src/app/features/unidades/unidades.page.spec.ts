import { VENDOR_MIME_TOKEN } from '@uniplus/shared-core/http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LISTA,
  Pagina,
  TITULO_DA_LISTA,
  comLink,
  instituto,
  montarPagina,
  problema,
  reitoria,
} from './unidades.testing';
import {
  TEXTO_TENTANDO,
  situacaoDoBotao,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';

const ESPERA_DO_DEBOUNCE_MS = 360;
const esperar = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const LINK_PARA_PROXIMA = '<.../unidades?cursor=next_123&direction=next>; rel="next"';
const LINK_DAS_DUAS = `<.../unidades?cursor=prev_123&direction=prev>; rel="prev", <.../unidades?cursor=next_456&direction=next>; rel="next"`;
const ORDINAL_DE_INSTITUTO = '4';

describe('UnidadesPage — leitura', () => {
  let p: Pagina;

  afterEach(() => p.http.verify());

  const alternarRaiz = async (): Promise<HTMLButtonElement> => {
    const alternar = p.elemento<HTMLButtonElement>('.unit-node__toggle');
    alternar.click();
    await p.propagar();
    return alternar;
  };
  const digitarNaBusca = async (termo: string): Promise<void> => {
    const campo = p.elemento<HTMLInputElement>('ui-filter-bar input[type="search"]');
    campo.value = termo;
    campo.dispatchEvent(new Event('input'));
    await p.propagar();
  };
  const buscarPor = async (termo: string): Promise<void> => {
    await digitarNaBusca(termo);
    await esperar(ESPERA_DO_DEBOUNCE_MS);
    await p.propagar();
  };
  const pagina = (sentido: 'prev' | 'next'): HTMLButtonElement =>
    p.elemento(`[data-pager="${sentido}"]`);
  const aoMenosUmaVez = (texto: string): boolean =>
    (p.fixture.nativeElement as HTMLElement).textContent?.includes(texto) ?? false;

  describe('árvore', () => {
    it('consulta a primeira página com limit=100 e a mídia de versão da unidade', async () => {
      p = await montarPagina();

      expect(p.primeiraConsulta.request.params.get('limit')).toBe('100');
      expect(p.primeiraConsulta.request.params.has('cursor')).toBe(false);
      expect(p.primeiraConsulta.request.context.get(VENDOR_MIME_TOKEN)).toEqual({
        resource: 'unidade',
        version: 1,
      });
    });

    it('mostra a raiz recolhida e a hierarquia em listas aninhadas, com nome acessível', async () => {
      p = await montarPagina();

      const arvore = p.elemento('ul.unit-tree');
      expect(arvore.getAttribute('aria-label')).toBe('Hierarquia de unidades da Unifesspa');
      expect(p.fixture.nativeElement.querySelector('table')).toBeNull();
      expect(aoMenosUmaVez('Instituto de Ciências Exatas')).toBe(false);

      await alternarRaiz();
      const filhos = arvore.querySelectorAll(':scope > li.unit-node > ul.unit-node__children > li');
      expect(filhos).toHaveLength(1);
      expect(aoMenosUmaVez('Instituto de Ciências Exatas')).toBe(true);
    });

    it('expande e recolhe o nó com filhos, e aria-expanded acompanha', async () => {
      p = await montarPagina();
      const alternar = p.elemento<HTMLButtonElement>('.unit-node__toggle');
      expect(alternar.getAttribute('aria-expanded')).toBe('false');
      expect(alternar.getAttribute('aria-label')).toBe('Expandir REIT');

      alternar.click();
      await p.propagar();
      expect(alternar.getAttribute('aria-expanded')).toBe('true');
      expect(alternar.getAttribute('aria-label')).toBe('Recolher REIT');

      alternar.click();
      await p.propagar();
      expect(alternar.getAttribute('aria-expanded')).toBe('false');
    });

    it('a unidade folha não tem botão de expandir, só o ícone estático', async () => {
      p = await montarPagina();
      await alternarRaiz();

      const folha = p.elemento(`[data-unidade-id="${instituto.id}"]`);
      expect(folha.querySelector('.unit-node__toggle')).toBeNull();
      expect(folha.querySelector('.unit-node__icon')).not.toBeNull();
    });

    it('oferece Editar e Remover em cada nível, sem pintar o Remover de vermelho', async () => {
      p = await montarPagina();
      await alternarRaiz();

      for (const unidade of [reitoria, instituto]) {
        const editar = p.editar(unidade);
        const remover = p.remover(unidade);
        expect(editar.classList.contains('btn--tertiary')).toBe(true);
        expect(editar.querySelector('i')?.classList.contains('pi-pencil')).toBe(true);
        expect(remover.classList.contains('btn--tertiary')).toBe(true);
        expect(remover.classList.contains('btn--danger')).toBe(false);
        expect(remover.querySelector('i')?.classList.contains('pi-trash')).toBe(true);
      }
    });

    it('um pai fora do resultado faz o filho aparecer como raiz', async () => {
      p = await montarPagina([instituto]);

      expect(p.elemento('ul.unit-tree > li.unit-node')).toBeTruthy();
      expect(p.fixture.nativeElement.querySelector('.unit-node__toggle')).toBeNull();
      expect(p.editar(instituto)).toBeTruthy();
    });
  });

  describe('busca e filtro por tipo', () => {
    it('limita a busca a 256 caracteres, o que a API aceita em q', async () => {
      p = await montarPagina();

      const campo = p.elemento<HTMLInputElement>('ui-filter-bar input[type="search"]');
      expect(campo.getAttribute('maxlength')).toBe('256');
    });

    it('envia q ao servidor depois do debounce e abre o ramo com o resultado', async () => {
      p = await montarPagina();
      expect(aoMenosUmaVez('Instituto de Ciências Exatas')).toBe(false);

      await digitarNaBusca('exatas');
      p.http.expectNone((r) => r.url === LISTA && r.params.has('q'));
      await esperar(ESPERA_DO_DEBOUNCE_MS);
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.params.get('q') === 'exatas')
        .flush([reitoria, instituto]);
      await p.propagar();

      expect(aoMenosUmaVez('Instituto de Ciências Exatas')).toBe(true);
      const alternar = p.elemento<HTMLButtonElement>('.unit-node__toggle');
      expect(alternar.getAttribute('aria-expanded')).toBe('true');
      alternar.click();
      await p.propagar();
      expect(alternar.getAttribute('aria-expanded')).toBe('false');
      expect(aoMenosUmaVez('Instituto de Ciências Exatas')).toBe(false);
    });

    it('filtra por tipo enviando o ordinal numérico e volta à primeira página', async () => {
      p = await montarPagina([reitoria, instituto], comLink(LINK_PARA_PROXIMA));
      pagina('next').click();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.params.get('cursor') === 'next_123')
        .flush([instituto], comLink(LINK_DAS_DUAS));
      await p.propagar();

      p.elemento<HTMLButtonElement>('ui-filter-chips button:not([aria-pressed="true"])').click();
      await p.propagar();
      const requisicao = p.http.expectOne((r) => r.url === LISTA && r.params.has('tipo'));
      expect(requisicao.request.params.has('cursor')).toBe(false);
      expect(requisicao.request.params.getAll('tipo')).toHaveLength(1);
      requisicao.flush([reitoria]);
      await p.propagar();
    });

    it('o chip de Instituto usa o ordinal do backend', async () => {
      p = await montarPagina();

      const chips = [...p.fixture.nativeElement.querySelectorAll('ui-filter-chips button')];
      const chip = chips.find((c) => (c as HTMLElement).textContent?.trim() === 'Instituto');
      (chip as HTMLButtonElement).click();
      await p.propagar();
      const requisicao = p.http.expectOne((r) => r.url === LISTA && r.params.has('tipo'));
      expect(requisicao.request.params.get('tipo')).toBe(ORDINAL_DE_INSTITUTO);
      requisicao.flush([instituto]);
      await p.propagar();
      expect(p.store.unidades()).toEqual([instituto]);
    });

    it('"Limpar filtros" do estado vazio da busca zera a busca e o tipo', async () => {
      p = await montarPagina([reitoria, instituto]);
      p.elemento<HTMLButtonElement>('ui-filter-chips button:not([aria-pressed="true"])').click();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA && r.params.has('tipo')).flush([reitoria]);
      await p.propagar();
      await buscarPor('zzz');
      p.http.expectOne((r) => r.url === LISTA && r.params.get('q') === 'zzz').flush([]);
      await p.propagar();
      expect(p.store.tipoFiltro()).not.toBe('');

      expect(aoMenosUmaVez('Nenhuma unidade encontrada')).toBe(true);
      const limpar = [...p.fixture.nativeElement.querySelectorAll('ui-empty-state button')].find(
        (b) => (b as HTMLElement).textContent?.includes('Limpar filtros'),
      ) as HTMLButtonElement;
      limpar.click();
      await p.propagar();
      expect(p.store.termoBusca()).toBe('');
      expect(p.store.tipoFiltro()).toBe('');
      p.http
        .expectOne((r) => r.url === LISTA && r.params.get('q') === 'zzz' && !r.params.has('tipo'))
        .flush([]);
      await p.propagar();
      await esperar(ESPERA_DO_DEBOUNCE_MS);
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && !r.params.has('q') && !r.params.has('tipo'))
        .flush([reitoria]);
      await p.propagar();
    });

    it('sem filtro, o estado vazio convida ao cadastro e "Nova unidade" segue disponível', async () => {
      p = await montarPagina([]);

      expect(aoMenosUmaVez('Nenhuma unidade cadastrada')).toBe(true);
      expect(p.novo().getAttribute('aria-disabled')).toBeNull();
    });
  });

  describe('paginação', () => {
    it('avança pelo cursor, volta pelo cursor anterior e não oferece botão sem página', async () => {
      p = await montarPagina([reitoria, instituto], comLink(LINK_PARA_PROXIMA));
      expect(pagina('prev').getAttribute('aria-disabled')).toBe('true');

      pagina('next').click();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.params.get('cursor') === 'next_123')
        .flush([instituto], comLink(LINK_DAS_DUAS));
      await p.propagar();
      expect(p.store.anterior()).toBe('prev_123');
      expect(p.store.unidades()).toEqual([instituto]);

      pagina('prev').click();
      await p.propagar();
      const volta = p.http.expectOne(
        (r) => r.url === LISTA && r.params.get('cursor') === 'prev_123',
      );
      expect(volta.request.params.get('direction')).toBe('prev');
      expect(volta.request.params.has('limit')).toBe(false);
      volta.flush([reitoria, instituto]);
      await p.propagar();
      expect(p.store.unidades()).toEqual([reitoria, instituto]);
    });

    it('falha ao navegar preserva a página e os cursores, e "Tentar novamente" refaz a mesma página', async () => {
      p = await montarPagina([reitoria, instituto], comLink(LINK_PARA_PROXIMA));
      pagina('next').click();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.params.get('cursor') === 'next_123')
        .flush(...problema(503));
      await p.propagar();

      expect(p.store.unidades()).toEqual([reitoria, instituto]);
      expect(p.store.proximo()).toBe('next_123');
      p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button').click();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.params.get('cursor') === 'next_123')
        .flush([instituto]);
      await p.propagar();
      expect(p.store.unidades()).toEqual([instituto]);
    });

    it('falha na primeira página esvazia a lista e os cursores', async () => {
      p = await montarPagina([reitoria, instituto], comLink(LINK_PARA_PROXIMA));
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();

      expect(p.store.unidades()).toEqual([]);
      expect(p.store.anterior()).toBeNull();
      expect(p.store.proximo()).toBeNull();
    });
  });

  describe('detalhe', () => {
    it('mostra a ficha, com a cidade, e "Não informada" quando ausente', async () => {
      p = await montarPagina([
        { ...reitoria, cidadeCodigoIbge: null, cidadeNome: null, cidadeUf: null },
        instituto,
      ]);
      await alternarRaiz();

      p.nomeDoNo(instituto).click();
      await p.propagar();
      const ficha = p.elemento('cfg-unidade-detalhe dl').textContent ?? '';
      expect(ficha).toContain('Instituto de Ciências Exatas');
      expect(ficha).toContain('Marabá — PA');
      expect(ficha).toContain('Desde 01/01/2021');
      expect(ficha).toContain('REIT — Reitoria');
      expect(ficha).toContain('Sim');

      p.elemento<HTMLButtonElement>('cfg-unidade-detalhe button[aria-label="Fechar"]').click();
      await p.propagar();
      p.nomeDoNo(reitoria).click();
      await p.propagar();
      expect(p.elemento('cfg-unidade-detalhe dl').textContent).toContain('Não informada');
      expect(p.elemento('cfg-unidade-detalhe dl').textContent).toContain('Sem superior');
    });

    it('resolve o rótulo da superior mesmo depois de filtrada para fora da página', async () => {
      p = await montarPagina();
      p.elemento<HTMLButtonElement>('ui-filter-chips button:not([aria-pressed="true"])').click();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA && r.params.has('tipo')).flush([instituto]);
      await p.propagar();

      p.nomeDoNo(instituto).click();
      await p.propagar();
      expect(p.elemento('cfg-unidade-detalhe dl').textContent).toContain('REIT — Reitoria');
    });

    it('uma superior nunca vista aparece como "Não carregada"', async () => {
      p = await montarPagina([instituto]);

      p.nomeDoNo(instituto).click();
      await p.propagar();
      expect(p.elemento('cfg-unidade-detalhe dl').textContent).toContain('Não carregada');
    });

    it('Editar abre o formulário e fecha o detalhe; Remover abre a confirmação', async () => {
      p = await montarPagina();
      p.nomeDoNo(reitoria).click();
      await p.propagar();
      const botoes = [...p.fixture.nativeElement.querySelectorAll('.cfg-drawer-actions button')];

      (botoes[0] as HTMLButtonElement).click();
      await p.responderOpcoes();
      expect(p.edicao.aberto()).toBe(true);
      expect(p.elemento<HTMLDialogElement>('cfg-unidade-detalhe dialog').open).toBe(false);

      p.edicao.fechar();
      await p.propagar();
      p.nomeDoNo(reitoria).click();
      await p.propagar();
      (
        [
          ...p.fixture.nativeElement.querySelectorAll('.cfg-drawer-actions button'),
        ][1] as HTMLButtonElement
      ).click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(true);
      expect(p.elemento<HTMLDialogElement>('cfg-unidade-detalhe dialog').open).toBe(false);
    });
  });

  describe('falha de leitura', () => {
    it('5xx avisa por toast e "Tentar novamente" devolve o foco ao título', async () => {
      p = await montarPagina();
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
      expect(situacaoDoBotao(tentar)).toBe(TEXTO_TENTANDO);
      expect(tentar.getAttribute('aria-busy')).toBe('true');
      await p.recarregarCom([reitoria]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('4xx mostra o alerta sem toast', async () => {
      p = await montarPagina();
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(403, { code: 'uniplus.auth.forbidden' }));
      await p.propagar();

      expect(p.elemento('ui-alert .list-state__retry button')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('as ações das linhas ficam indisponíveis enquanto a lista recarrega', async () => {
      p = await montarPagina();
      p.store.recarregar();
      await p.propagar();

      expect(p.editar().matches(':disabled')).toBe(true);
      expect(p.remover().matches(':disabled')).toBe(true);
      expect(p.nomeDoNo(reitoria).matches(':disabled')).toBe(true);
      p.http.expectOne((r) => r.url === LISTA).flush([reitoria]);
      await p.propagar();
      expect(p.editar().matches(':disabled')).toBe(false);
    });
  });
});
