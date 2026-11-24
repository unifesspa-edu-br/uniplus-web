import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PaginaDaListaDeModalidades, V } from './modalidades-list.page.testing';
import { AC, URL, URL_CATALOGO } from './modalidades-de-teste.testing';
import { CATALOGO } from './catalogo-de-fatos.fixture';
import { NATUREZAS } from './modalidades-tabela.testing';

describe('ModalidadesListPage', () => {
  let pagina: PaginaDaListaDeModalidades;

  beforeEach(() => {
    pagina = new PaginaDaListaDeModalidades();
  });

  afterEach(() => {
    pagina.verificar();
  });

  it('CA-01: renderiza código e natureza', async () => {
    await pagina.flushLista([AC, V]);
    pagina.fixture.detectChanges();
    const texto = pagina.fixture.nativeElement.textContent as string;
    expect(pagina.component['modalidadesFiltradas']()).toHaveLength(2);
    expect(texto).toContain('AC');
    expect(texto).toContain(AC.naturezaLegal.rotulo);
  });

  it('mostra a composição seguida do código da modalidade de origem', async () => {
    await pagina.flushLista([AC, V]);
    pagina.fixture.detectChanges();

    const composicao = (codigo: string) =>
      (
        pagina.fixture.nativeElement.querySelector(
          `tr[data-codigo="${codigo}"] td[data-label="Composição de vagas"]`,
        ) as HTMLElement
      ).textContent
        ?.replace(/\s+/g, ' ')
        .trim();
    expect(composicao('V')).toBe(`${V.composicaoVagas.rotulo} AC`);
    expect(composicao('AC')).toBe(AC.composicaoVagas.rotulo);
  });

  it('resume a regra de aplicabilidade pelos nomes do catálogo, e a regra sem condição como todos', async () => {
    await pagina.flushLista([AC, V]);
    pagina.fixture.detectChanges();

    const quemConcorre = (codigo: string) =>
      (
        pagina.fixture.nativeElement.querySelector(
          `tr[data-codigo="${codigo}"] td[data-label="Quem concorre"]`,
        ) as HTMLElement
      ).textContent?.trim();
    expect(quemConcorre('AC')).toBe('Todos os candidatos');
    expect(quemConcorre('V')).toBe(
      'Cursou o ensino médio em escola pública é sim e Cor/raça é um de Preta, Indígena; ou Cor/raça é Parda',
    );
  });

  describe('fatos que nomeiam as condições', () => {
    const quemConcorreDeV = () =>
      (
        pagina.fixture.nativeElement.querySelector(
          'tr[data-codigo="V"] td[data-label="Quem concorre"]',
        ) as HTMLElement
      ).textContent?.trim();
    const problemaDosFatos = (status: number) =>
      [
        { title: 'Erro', status, code: 'uniplus.x', type: 'about:blank', traceId: '' },
        {
          status,
          statusText: 'Erro',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ] as const;

    async function listaComFatosRecusados(status: number): Promise<void> {
      pagina.controller.expectOne((r) => r.url === URL).flush([AC, V]);
      pagina.controller.expectOne(URL_CATALOGO).flush(...problemaDosFatos(status));
      await pagina.propagate();
    }

    it('a falha dos fatos explica a coluna e a nova tentativa devolve os nomes das condições', async () => {
      await listaComFatosRecusados(500);
      expect(quemConcorreDeV()).toBe('Quem atende às condições da regra');
      expect(pagina.fixture.nativeElement.textContent).toContain(
        'A coluna “Quem concorre” mostra “Quem atende às condições da regra”',
      );

      pagina.fixture.nativeElement.querySelector('ui-falha-de-leitura button').click();
      await pagina.propagate();
      pagina.controller.expectOne(URL_CATALOGO).flush(CATALOGO);
      await pagina.propagate();

      expect(quemConcorreDeV()).toContain('Cursou o ensino médio em escola pública');
      expect(pagina.fixture.nativeElement.querySelector('ui-falha-de-leitura ui-alert')).toBeNull();
    });

    it('os fatos que não existem mais explicam a coluna sem oferecer nova tentativa', async () => {
      await listaComFatosRecusados(404);

      expect(pagina.fixture.nativeElement.textContent).toContain(
        'Fatos das regras não encontrados',
      );
      expect(pagina.fixture.nativeElement.querySelector('ui-falha-de-leitura ui-alert')).toBeNull();
      expect(pagina.fixture.nativeElement.textContent).not.toContain('Tentar novamente');
    });
  });

  it('CA-01: chips de natureza contam por token e filtram client-side', async () => {
    await pagina.flushLista([AC, V]);
    const chips = pagina.component['chipsNatureza']();
    expect(chips.find((c) => c.value === NATUREZAS.ampla.codigo)?.count).toBe(1);
    expect(chips.find((c) => c.value === NATUREZAS.acao.codigo)?.count).toBe(1);

    pagina.component['naturezaSelecionada'].set(NATUREZAS.acao.codigo);
    expect(pagina.component['modalidadesFiltradas']().map((m) => m.codigo)).toEqual(['V']);
  });

  it('CA-01: busca casa código e descrição', async () => {
    await pagina.flushLista([AC, V]);
    pagina.component['busca'].set('pcd');
    expect(pagina.component['modalidadesFiltradas']().map((m) => m.codigo)).toEqual(['V']);
  });

  it('CA-01: mapa reverso lista quem referencia a modalidade (AC referenciada por V)', async () => {
    await pagina.flushLista([AC, V]);
    expect(pagina.component['referenciadaPor']('AC').map((m) => m.codigo)).toEqual(['V']);
    expect(pagina.component['referenciadaPor']('V')).toEqual([]);
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await pagina.flushLista([AC, V]);
    pagina.fixture.detectChanges();

    const caption = pagina.fixture.nativeElement.querySelector('table > caption');
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Modalidades de concorrência, com quem concorre em cada uma, natureza, composição de vagas, remanejamento e modalidades que a referenciam',
    );
  });

  it('CA-13/CA-14: a tabela não tem a coluna Status e preserva as demais', async () => {
    await pagina.flushLista([AC, V]);
    pagina.fixture.detectChanges();
    const cabecalhos = Array.from(
      pagina.fixture.nativeElement.querySelectorAll('thead th') as NodeListOf<HTMLElement>,
    ).map((th) => th.textContent?.trim());
    expect(cabecalhos).toEqual([
      'Código',
      'Quem concorre',
      'Natureza',
      'Composição de vagas',
      'Remanejamento',
      'Referenciada por',
      'Ações',
    ]);
  });
});
