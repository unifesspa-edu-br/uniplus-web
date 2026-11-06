import { AreaPesoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AREAS,
  GRUPOS,
  LIST_URL,
  PaginaDeTeste,
  RES_750,
  RES_805,
  grupo,
  linha,
  linhas750,
  linhas805,
} from './pesos-enem.testing';

describe('PesosEnemPage — leitura', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_TextoDeApoio_DescreveOCadastroSemRotuloInterno', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.fixture.detectChanges();

    const texto = (t.fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

    // As áreas vêm da API: o texto não fixa quantas são, e o conjunto não decorre da LDB.
    expect(texto).toContain('Pesos das áreas do ENEM por grupo de curso');
    expect(texto).not.toMatch(/\b(cinco|5) áreas\b/);
    expect(texto).not.toContain('LDB');

    // Identificador de requisito e rótulo de regra são rastreabilidade interna:
    // não dizem nada a quem opera a tela e envelhecem sem ninguém perceber.
    expect(texto).not.toMatch(/UNI-REQ-\d{4}/);
    expect(texto).not.toMatch(/\bRN\s?\d{2}\b/);

    // O congelamento é do processo seletivo, que é a entidade; "edital" é o
    // documento que o publica, e trocar um pelo outro confunde o operador.
    expect(texto).toContain('congelados por processo seletivo');
    expect(texto).not.toContain('edital');
  });

  it('PesosEnemPage_CarregamentoInicial_EsgotaCursorEAgrupaPorResolucao', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush([...GRUPOS]);
    const pagina1 = t.expectListagem();
    pagina1.flush([...linhas805], {
      headers: { Link: `<${LIST_URL}?cursor=abc&direction=next>; rel="next"` },
    });
    await t.propagate();

    const pagina2 = t.expectListagem();
    pagina2.flush([...linhas750]);
    await t.propagate();

    expect(t.store.resolucoes()).toEqual([RES_805, RES_750]);
    expect(t.store.porResolucao().get(RES_805)).toHaveLength(4);
    expect(t.store.porResolucao().get(RES_750)).toHaveLength(4);
  });

  it('PesosEnemPage_ResolucoesOrdenadasPorDataDesc_MaisRecentePrimeiro', async () => {
    await t.carregarUmaPagina([...linhas750, ...linhas805]);
    expect(t.store.resolucoes()).toEqual([RES_805, RES_750]);
  });

  it('PesosEnemPage_ModoLeitura_ExibeTagsVigenteEAnterior', async () => {
    await t.carregarUmaPagina([...linhas805, ...linhas750]);
    const texto = t.fixture.nativeElement.textContent as string;
    expect(texto).toContain('Vigente');
    expect(texto).toContain('Anterior');
    expect(texto).toContain(RES_805);
    expect(texto).toContain(RES_750);
  });

  it('PesosEnemPage_LinhaSemRotulo_UsaORotuloDoVocabulario', async () => {
    await t.carregarUmaPagina([
      linha({
        id: '01960000-0000-7000-0000-0000000000d1',
        resolucao: RES_805,
        grupoCurso: { codigo: 'TECNOLOGICA', rotulo: '' },
      }),
    ]);

    const rotulos = Array.from(
      t.fixture.nativeElement.querySelectorAll(
        '.cell-label--group-label',
      ) as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim());
    expect(rotulos).toEqual(['Tecnológica']);
  });

  it('PesosEnemPage_GrupoForaDoVocabularioSemRotulo_MostraOCodigo', async () => {
    await t.carregarUmaPagina([
      linha({
        id: '01960000-0000-7000-0000-0000000000d2',
        resolucao: RES_805,
        grupoCurso: { codigo: 'OUTRO', rotulo: '  ' },
      }),
    ]);

    const rotulos = Array.from(
      t.fixture.nativeElement.querySelectorAll(
        '.cell-label--group-label',
      ) as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim());
    expect(rotulos).toEqual(['OUTRO']);
  });

  it('PesosEnemPage_AreaSemRotulo_CabecalhoMostraOCodigo', async () => {
    const areas = AREAS.map((area) =>
      area.codigo === 'MATEMATICA' ? { ...area, rotulo: ' ' } : area,
    );
    await t.carregarUmaPagina([...linhas805], areas);

    const cabecalhos = Array.from(
      t.fixture.nativeElement.querySelectorAll('.num-cell--head') as NodeListOf<HTMLDivElement>,
    ).map((el) => el.textContent?.trim());
    expect(cabecalhos).toContain('MATEMATICA');
  });

  it('PesosEnemPage_AreaSemCodigoUtilizavel_NaoGeraColunaNemCampo', async () => {
    const invalidas = [
      { rotulo: 'Sem código' },
      { codigo: null, rotulo: 'Nulo' },
      { codigo: '', rotulo: 'Vazio' },
      { codigo: '   ', rotulo: 'Espaços' },
    ] as unknown as readonly AreaPesoAreaEnemDto[];
    await t.carregarUmaPagina([...linhas805], [...AREAS, ...invalidas]);

    expect(t.store.areas().map((a) => a.codigo)).toEqual(AREAS.map((a) => a.codigo));
    const cabecalhos = Array.from(
      t.fixture.nativeElement.querySelectorAll('.num-cell--head') as NodeListOf<HTMLDivElement>,
    ).map((el) => el.textContent?.trim());
    expect(cabecalhos).toHaveLength(AREAS.length);

    t.criacao.abrir();
    await t.propagate();
    for (const grupo of t.criacao.form.controls.grupos.controls) {
      expect(grupo.controls.areas.controls.map((a) => a.controls.codigo.value)).toEqual(
        AREAS.map((a) => a.codigo),
      );
    }
  });

  it('PesosEnemPage_AreaEGrupoComEspacosNoCodigo_UsamOCodigoAparadoNoFormulario', async () => {
    const areas = AREAS.map((a, i) => (i === 0 ? { ...a, codigo: ` ${a.codigo} ` } : a));
    const grupos = GRUPOS.map((g, i) => (i === 0 ? { ...g, codigo: ` ${g.codigo} ` } : g));
    await t.carregarUmaPagina([...linhas805], areas, grupos);

    t.criacao.abrir();
    await t.propagate();
    const [primeiro] = t.criacao.form.controls.grupos.controls;
    expect(primeiro?.controls.grupoCurso.value.codigo).toBe(GRUPOS[0]?.codigo);
    expect(primeiro?.controls.areas.controls.map((a) => a.controls.codigo.value)).toEqual(
      AREAS.map((a) => a.codigo),
    );
  });

  it('PesosEnemPage_GrupoSemRotuloNemCodigo_MostraOTraco', async () => {
    await t.carregarUmaPagina([
      linha({
        id: '01960000-0000-7000-0000-0000000000d3',
        resolucao: RES_805,
        grupoCurso: { codigo: ' ', rotulo: ' ' },
      }),
    ]);

    const rotulos = Array.from(
      t.fixture.nativeElement.querySelectorAll(
        '.cell-label--group-label',
      ) as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim());
    expect(rotulos).toEqual(['—']);
  });

  it('PesosEnemPage_SemResolucoes_ExibeEmptyState', async () => {
    await t.carregarUmaPagina([]);
    expect(t.fixture.nativeElement.querySelector('ui-empty-state')).not.toBeNull();
    expect(t.fixture.nativeElement.querySelector('.page-header__actions')).not.toBeNull();
  });

  it('PesosEnemPage_Colunas_VemDasAreasDaApiNaOrdemDela', async () => {
    await t.carregarUmaPagina([...linhas805]);

    const cabecalho = Array.from(
      t.fixture.nativeElement.querySelectorAll(
        '.num-grid__header .num-cell--head',
      ) as NodeListOf<HTMLDivElement>,
    ).map((celula) => celula.textContent?.trim());
    expect(cabecalho).toEqual(AREAS.map((area) => area.rotulo));
    expect(t.fixture.nativeElement.textContent as string).not.toContain('Corte de redação');
  });

  it('PesosEnemPage_Colunas_NaoTemListaDeAreasNoCliente', async () => {
    // Com outra lista vinda da API, a tabela mostra exatamente essa lista:
    // nenhuma área é escrita no cliente.
    const duas: readonly AreaPesoAreaEnemDto[] = [
      { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
      { codigo: 'REDACAO', rotulo: 'Redação' },
    ];
    await t.carregarUmaPagina([...linhas805], duas);

    const cabecalho = Array.from(
      t.fixture.nativeElement.querySelectorAll(
        '.num-grid__header .num-cell--head',
      ) as NodeListOf<HTMLDivElement>,
    ).map((celula) => celula.textContent?.trim());
    expect(cabecalho).toEqual(['Matemática e suas Tecnologias', 'Redação']);
  });

  it('PesosEnemPage_ModoLeitura_MostraCorteAbaixoDoPesoSoQuandoExiste', async () => {
    await t.carregarUmaPagina([...linhas805]);

    const cortes = Array.from(
      t.fixture.nativeElement.querySelectorAll('.pe-corte') as NodeListOf<HTMLSpanElement>,
    ).map((el) => el.textContent?.trim());
    // Uma por grupo: só a Redação tem corte nas linhas de exemplo.
    expect(cortes).toEqual(['Corte: 400', 'Corte: 400', 'Corte: 400', 'Corte: 400']);
  });

  it('PesosEnemPage_ModoLeitura_FormataCorteEmPtBr', async () => {
    const comCorteFracionado = linhas805.map((l) => ({
      ...l,
      areas: l.areas.map((area) => (area.codigo === 'REDACAO' ? { ...area, corte: 450.5 } : area)),
    }));
    await t.carregarUmaPagina(comCorteFracionado);

    const cortes = Array.from(
      t.fixture.nativeElement.querySelectorAll('.pe-corte') as NodeListOf<HTMLSpanElement>,
    ).map((el) => el.textContent?.trim());
    expect(cortes).toEqual(['Corte: 450,5', 'Corte: 450,5', 'Corte: 450,5', 'Corte: 450,5']);
  });

  it('PesosEnemPage_ModoLeitura_CorteDescreveOPeso', async () => {
    await t.carregarUmaPagina([...linhas805]);
    const raiz = t.fixture.nativeElement as HTMLElement;

    const pesoRedacao = raiz.querySelector<HTMLInputElement>('#pe-res-805-2024-g0-a0-leitura');
    const idDescricao = pesoRedacao?.getAttribute('aria-describedby') ?? '';
    expect(idDescricao).not.toBe('');
    expect(raiz.querySelector(`[id="${idDescricao}"]`)?.textContent?.trim()).toBe('Corte: 400');

    // Área sem corte não aponta descrição inexistente.
    const pesoMatematica = raiz.querySelector<HTMLInputElement>('#pe-res-805-2024-g0-a4-leitura');
    expect(pesoMatematica?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('PesosEnemPage_ModoLeitura_LinhasNaOrdemDosGruposDaApiComORotuloDaLinha', async () => {
    const outroGrupo = linha({
      id: '01960000-0000-7000-0000-0000000000a5',
      resolucao: RES_805,
      grupoCurso: { codigo: 'GRUPO_FORA_DA_LISTA', rotulo: 'Grupo fora da lista' },
    });
    await t.carregarUmaPagina([outroGrupo, ...linhas805], AREAS, [
      grupo('HUMANISTICA_II'),
      grupo('TECNOLOGICA'),
      grupo('SAUDE_E_BIOLOGICAS'),
      grupo('HUMANISTICA_I'),
    ]);

    const rotulos = Array.from(
      (t.fixture.nativeElement as HTMLElement).querySelectorAll('.cell-label--group-label'),
      (el) => el.textContent?.trim(),
    );
    // Linha de um grupo que a lista não traz não some: vai para o fim.
    expect(rotulos).toEqual([
      'Humanística II',
      'Tecnológica',
      'Saúde e Biológicas',
      'Humanística I',
      'Grupo fora da lista',
    ]);
  });

  it('PesosEnemPage_Textos_AtribuemAResolucaoAoConsepeENaoAoInep', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.criacao.abrir();
    await t.propagate();
    t.fixture.detectChanges();

    const texto = ((t.fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    expect(texto).not.toContain('INEP');
    expect(texto).toContain('versionados por resolução do Consepe');
    expect(texto).toContain('Identificador da resolução do Consepe');
    // O número de grupos vem da API: o texto não o fixa.
    expect(texto).not.toMatch(/\b4 grupos\b/);
  });

  it('PesosEnemPage_AreasPendentesComRegistrosCarregados_ExibeSkeleton', async () => {
    // Sem as áreas a tabela não é montada: enquanto elas não chegam, a tela
    // mostra o skeleton em vez de ficar em branco, mesmo com os registros já carregados.
    t.fixture.detectChanges();
    const areas = t.expectAreas();
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush([...linhas805]);
    await t.propagate();
    t.fixture.detectChanges();
    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('ui-skeleton').length).toBeGreaterThan(0);

    areas.flush([...AREAS]);
    await t.propagate();
    t.fixture.detectChanges();
    expect(raiz.querySelectorAll('ui-skeleton')).toHaveLength(0);
  });

  it('PesosEnemPage_FormatacaoDoCorte_NaoCriaFormatadorPorCelula', async () => {
    // O formatador é criado uma vez, no módulo: montar as células não constrói outro
    // Intl.NumberFormat nem usa o toLocaleString, que cria um a cada chamada.
    const construtor = vi.spyOn(Intl, 'NumberFormat');
    const toLocaleString = vi.spyOn(Number.prototype, 'toLocaleString');
    try {
      const comCorteFracionado = linhas805.map((l) => ({
        ...l,
        areas: l.areas.map((area) =>
          area.codigo === 'REDACAO' ? { ...area, corte: 450.5 } : area,
        ),
      }));
      await t.carregarUmaPagina(comCorteFracionado);

      expect(construtor).not.toHaveBeenCalled();
      expect(toLocaleString).not.toHaveBeenCalled();
      const cortes = Array.from(
        t.fixture.nativeElement.querySelectorAll('.pe-corte') as NodeListOf<HTMLSpanElement>,
      ).map((el) => el.textContent?.trim());
      expect(cortes).toEqual(['Corte: 450,5', 'Corte: 450,5', 'Corte: 450,5', 'Corte: 450,5']);
    } finally {
      construtor.mockRestore();
      toLocaleString.mockRestore();
    }
  });
});
