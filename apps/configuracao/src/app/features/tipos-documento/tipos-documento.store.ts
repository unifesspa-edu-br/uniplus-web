import { HttpParams } from '@angular/common/http';
import {
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import {
  CursorPagina,
  ProblemI18nService,
  ResolucaoDeVinculo,
  cursorToString,
  resolverVinculo,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AprovacaoDaProtecaoDto,
  CONFIGURACAO_BASE_PATH,
  TipoDocumentoDto,
} from '@uniplus/shared-data/configuracao';
import type { UiFilterChipOption, UiFiltroAtivo } from '@uniplus/shared-ui/components';
import { CatalogoCategoriasDocumento } from '../../shared/categorias-documento';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';
import { AprovacaoDoCatalogo } from '../../shared/protecao-do-catalogo';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

/**
 * Valor do chip que recolhe os registros cuja categoria saiu do cadastro. Não colide com código
 * de categoria, que é `^[A-Z][A-Z0-9_]{1,49}$`.
 */
const FILTRO_FORA_DO_CATALOGO = '*fora-do-cadastro*';

/** A situação da aprovação na linha: a lida, `ilegivel` quando a leitura falhou, `null` enquanto não chegou. */
export type SituacaoNaLinha = AprovacaoDaProtecaoDto | 'ilegivel' | null;

/** Um tipo de documento com o que a linha mostra além dele: a categoria resolvida e a situação. */
export interface LinhaDoTipoDocumento {
  readonly tipo: TipoDocumentoDto;
  readonly categoria: ResolucaoDeVinculo;
  readonly situacao: SituacaoNaLinha;
}

/**
 * Estado da leitura de tipos de documento: consulta, paginação, busca e filtro por categoria no
 * cliente (o contrato só pagina por cursor), o detalhe aberto e os catálogos que rotulam a lista.
 */
@Injectable()
export class TiposDocumentoStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  readonly categorias = inject(CatalogoCategoriasDocumento);
  readonly aprovacao = inject(AprovacaoDoCatalogo);

  private readonly pagina = signal<CursorPagina | undefined>(undefined);

  private readonly lista = useApiResource<readonly TipoDocumentoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-documento`,
    params: this.montarParams(),
    context: withVendorMime('tipo-documento', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly termoBusca = signal('');
  readonly carregando = this.lista.isLoading;
  readonly tipos = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;

  private readonly buscados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) return this.tipos();
    return this.tipos().filter(
      (tipo) =>
        tipo.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        tipo.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });

  /**
   * Códigos de categoria que a página exibe mas o catálogo não conhece (categoria removida do
   * cadastro depois de já ter classificado um tipo). Só faz sentido perguntar isso do catálogo
   * inteiro: sem ele, todo registro pareceria órfão.
   */
  private readonly codigosForaDoCatalogo = computed<ReadonlySet<string>>(() => {
    if (this.categorias.pendente() || this.categorias.comErro()) return new Set<string>();
    const conhecidos = this.categorias.porCodigo();
    return new Set(
      this.tipos()
        .map((tipo) => tipo.categoria)
        .filter((codigo) => !conhecidos.has(codigo)),
    );
  });

  /**
   * Chips de categoria com o contador do conjunto já filtrado pela busca. As opções vêm do
   * cadastro, não de um roster escrito à mão; o chip extra recolhe os registros cuja categoria
   * saiu do cadastro, para nenhum ficar fora de toda navegação por categoria.
   */
  readonly categoriaChips = computed<readonly UiFilterChipOption[]>(() => {
    const registros = this.buscados();
    const contagem = new Map<string, number>();
    for (const registro of registros) {
      contagem.set(registro.categoria, (contagem.get(registro.categoria) ?? 0) + 1);
    }
    const orfaos = this.codigosForaDoCatalogo();
    const chips: UiFilterChipOption[] = [
      { value: '', label: 'Todas', count: registros.length },
      ...this.categorias.opcoes().map((categoria) => ({
        value: categoria.codigo,
        label: categoria.nome,
        count: contagem.get(categoria.codigo) ?? 0,
      })),
    ];
    if (orfaos.size > 0) {
      chips.push({
        value: FILTRO_FORA_DO_CATALOGO,
        label: 'Fora do cadastro',
        count: registros.filter((tipo) => orfaos.has(tipo.categoria)).length,
      });
    }
    return chips;
  });

  /**
   * Chip selecionado, reconciliado com os chips que existem: se a categoria escolhida sai do
   * cadastro, a tabela não pode seguir filtrada por um chip que sumiu da barra.
   */
  readonly filtroCategoria = linkedSignal<readonly UiFilterChipOption[], string>({
    source: () => this.categoriaChips(),
    computation: (chips, previous) => {
      const atual = previous?.value ?? '';
      return chips.some((chip) => chip.value === atual) ? atual : '';
    },
  });

  readonly filtrosAtivos = computed<readonly UiFiltroAtivo[]>(() => {
    const categoria = this.filtroCategoria();
    if (categoria === '') return [];
    const chip = this.categoriaChips().find((c) => c.value === categoria);
    return [{ nome: 'Categoria', valor: chip?.label ?? categoria }];
  });

  readonly tiposFiltrados = computed(() => {
    const categoria = this.filtroCategoria();
    const registros = this.buscados();
    if (categoria === '') return registros;
    if (categoria === FILTRO_FORA_DO_CATALOGO) {
      const orfaos = this.codigosForaDoCatalogo();
      return registros.filter((tipo) => orfaos.has(tipo.categoria));
    }
    return registros.filter((tipo) => tipo.categoria === categoria);
  });

  readonly linhas = computed<readonly LinhaDoTipoDocumento[]>(() =>
    this.tiposFiltrados().map((tipo) => ({
      tipo,
      categoria: this.categoriaDoTipo(tipo.categoria),
      situacao: this.situacaoDe(tipo.id),
    })),
  );

  readonly temFiltro = computed(
    () => this.termoBusca().trim().length > 0 || this.filtroCategoria() !== '',
  );

  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) return this.problemI18n.resolve(problem).title;
    return this.lista.error() ? 'Erro inesperado ao carregar tipos de documento.' : null;
  });

  readonly detalheAberto = signal(false);
  private readonly detalheId = signal<string | null>(null);
  /** O tipo aberto no detalhe, lido da lista: a releitura depois de uma escrita o atualiza. */
  readonly detalhe = computed(() => {
    const id = this.detalheId();
    return id === null ? null : (this.tipos().find((tipo) => tipo.id === id) ?? null);
  });
  readonly categoriaDoDetalhe = computed(() => {
    const tipo = this.detalhe();
    return tipo === null ? null : this.categoriaDoTipo(tipo.categoria);
  });
  readonly situacaoDoDetalhe = computed(() => {
    const tipo = this.detalhe();
    return tipo === null ? null : this.aprovacao.aprovacaoDe(tipo.id);
  });

  constructor() {
    // O catálogo é do injector raiz: a primeira tela do cadastro que o pedir paga a requisição.
    this.categorias.garantirCarregado();
    this.aprovacao.carregar();
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  abrirDetalhe(tipo: TipoDocumentoDto): void {
    this.detalheId.set(tipo.id);
    this.detalheAberto.set(true);
  }

  limparFiltros(): void {
    this.termoBusca.set('');
    this.filtroCategoria.set('');
  }

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }

  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }

  tentarNovamente(): void {
    if (!this.carregando()) this.lista.reload();
  }

  /** Volta à primeira página, para a lista refletir o que acabou de ser gravado. */
  recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  /**
   * O que a coluna exibe: distingue carregando, catálogo recusado e código fora do cadastro, em
   * vez de devolver o token em caixa alta, que pareceria dado legítimo.
   */
  private categoriaDoTipo(codigo: string): ResolucaoDeVinculo {
    return resolverVinculo(
      this.categorias,
      this.categorias.porCodigo().get(codigo),
      (categoria) => categoria.nome,
    );
  }

  private situacaoDe(id: string): SituacaoNaLinha {
    const situacao = this.aprovacao.aprovacaoDe(id);
    if (situacao !== null) return situacao;
    return this.aprovacao.comErro() ? 'ilegivel' : null;
  }

  private montarParams(): HttpParams {
    const pagina = this.pagina();
    if (pagina === undefined) return new HttpParams().set('limit', String(PAGE_SIZE));
    return new HttpParams()
      .set('cursor', cursorToString(pagina.cursor))
      .set('direction', pagina.direction);
  }
}
