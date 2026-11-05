import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import {
  ProtecaoDoCatalogoApi,
  type AtoDeDecisao,
  type CadastroDoCatalogo,
  type DecisaoDaProtecaoDto,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
  DrawerComponent,
  EmptyStateComponent,
  FilterBarComponent,
  FilterChipsComponent,
  ListFooterComponent,
  SpinnerComponent,
  TagComponent,
  type UiFilterChipOption,
  type UiFiltroAtivo,
} from '@uniplus/shared-ui/components';
import { formatarDataBr } from '@uniplus/shared-utils';
import { PaginaPorCursor } from '../../shared/pagina-por-cursor';
import { DetalheDaProtecaoComponent, LeituraDoDetalhe } from '../../shared/detalhe-do-catalogo';
import {
  AtosDaProtecaoComponent,
  CLASSIFICACOES_DE_PROTECAO,
  DECISOES_FILTRAVEIS,
  nomeDoCadastro,
  rotuloDe,
  rotuloDoAto,
} from '../../shared/protecao-do-catalogo';
import {
  ATOS_DE_DECISAO,
  CADASTROS,
  SEM_FILTROS,
  filtrosDaUrl,
  paramsDosFiltros,
  periodoInvalido,
  type FiltrosDasDecisoes,
} from './filtros-das-decisoes';

const BUSCA_DEBOUNCE_MS = 300;

const OPCOES_DE_CADASTRO: readonly UiFilterChipOption[] = CADASTROS.map((valor) => ({
  value: valor,
  label: nomeDoCadastro(valor),
}));

/**
 * A aba "Decisões" da proteção de dados do catálogo: o que foi decidido (aprovação, ajuste recomendado
 * e reprovação), da decisão mais recente à mais antiga, com filtros que ficam na query string para a
 * pessoa voltar ao mesmo recorte. Clicar numa linha abre a decisão e o histórico completo do item.
 */
@Component({
  selector: 'cfg-decisoes-da-protecao',
  standalone: true,
  imports: [
    AlertComponent,
    AtosDaProtecaoComponent,
    DetalheDaProtecaoComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FilterChipsComponent,
    ListFooterComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-filter-bar
      ariaLabel="Filtrar as decisões"
      searchPlaceholder="Buscar por nome ou código do item…"
      searchAriaLabel="Buscar decisão pelo nome ou código do item"
      secondaryRole="group"
      secondaryAriaLabel="Filtros das decisões"
      [(searchValue)]="termoBusca"
      [filtrosAtivos]="filtrosAtivos()"
    >
      <ng-container uiFilterBarSecondary>
        <span class="u-eyebrow" id="cfg-dec-filtro-decisao">Decisão</span>
        <div class="filter-chips" role="group" aria-labelledby="cfg-dec-filtro-decisao">
          @for (opcao of decisoes; track opcao.valor) {
            <button
              type="button"
              class="filter-chip"
              [attr.aria-pressed]="filtros().ato.includes(opcao.valor) ? 'true' : 'false'"
              (click)="alternarDecisao(opcao.valor)"
            >
              <span>{{ opcao.rotulo }}</span>
            </button>
          }
        </div>
        <span class="u-eyebrow">Cadastro</span>
        <ui-filter-chips
          [options]="cadastros"
          [selected]="filtros().cadastro"
          (selectedChange)="trocarCadastro($event)"
          ariaLabel="Filtrar por cadastro"
        />
        <div class="cfg-filtro-periodo">
          <label class="field" [class.is-error]="periodoComErro()">
            <span class="field__label">Decidido a partir de</span>
            <input
              class="input"
              type="date"
              [value]="filtros().de"
              [attr.aria-invalid]="periodoComErro() ? 'true' : null"
              [attr.aria-describedby]="periodoComErro() ? 'cfg-dec-periodo-erro' : null"
              (change)="aplicar({ de: valorDe($event) })"
            />
          </label>
          <label class="field" [class.is-error]="periodoComErro()">
            <span class="field__label">Decidido até</span>
            <input
              class="input"
              type="date"
              [value]="filtros().ate"
              [attr.aria-invalid]="periodoComErro() ? 'true' : null"
              [attr.aria-describedby]="periodoComErro() ? 'cfg-dec-periodo-erro' : null"
              (change)="aplicar({ ate: valorDe($event) })"
            />
          </label>
        </div>
        @if (periodoComErro()) {
          <span class="field__error" id="cfg-dec-periodo-erro" role="alert">
            A data final deve ser igual ou posterior à inicial.
          </span>
        }
        <label class="checkbox">
          <input
            type="checkbox"
            [checked]="filtros().minhas"
            (change)="aplicar({ minhas: marcadoEm($event) })"
          />
          <span class="checkbox__box" aria-hidden="true"></span>
          Só as minhas
        </label>
      </ng-container>
    </ui-filter-bar>

    @if (mensagemDeErro(); as mensagem) {
      <ui-alert variant="danger" heading="Não foi possível carregar as decisões">
        {{ mensagem }}
        <div class="list-state__retry">
          <button
            type="button"
            class="btn btn--secondary btn--sm"
            [disabled]="pagina.carregando()"
            (click)="carregar()"
          >
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }

    <section
      class="panel"
      aria-labelledby="cfg-decisoes-titulo"
      [attr.aria-busy]="pagina.carregando()"
    >
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-decisoes-titulo">Decisões registradas</h2>
          @if (pagina.carregando()) {
            <span class="list-state__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
      </div>

      @if (pagina.itens().length > 0) {
        <div class="table-responsive" role="region" tabindex="0" aria-label="Decisões registradas">
          <table>
            <caption class="sr-only">
              Decisões da proteção de dados do catálogo, da mais recente à mais antiga. Use o nome
              do item para abrir a decisão.
            </caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Cadastro</th>
                <th scope="col">Decisão</th>
                <th scope="col">Sensibilidade conferida</th>
                <th scope="col">Data</th>
              </tr>
            </thead>
            <tbody>
              @for (decisao of pagina.itens(); track chaveDe(decisao)) {
                <tr>
                  <td data-label="Item" class="u-nowrap-desktop">
                    <button
                      type="button"
                      class="table-responsive__alvo"
                      [attr.aria-label]="'Ver a decisão sobre ' + decisao.itemNome"
                      (click)="abrir(decisao)"
                    >
                      {{ decisao.itemNome }}
                    </button>
                  </td>
                  <td data-label="Cadastro" class="u-nowrap-desktop">
                    {{ cadastro(decisao.cadastro) }}
                  </td>
                  <td data-label="Decisão" class="u-nowrap-desktop">
                    <ui-tag [variant]="rotuloDoAto(decisao.ato).variante">{{
                      rotuloDoAto(decisao.ato).texto
                    }}</ui-tag>
                  </td>
                  <td data-label="Sensibilidade conferida" class="u-nowrap-desktop">
                    {{ rotulo(classificacoes, decisao.classificacaoProtecao) }}
                  </td>
                  <td data-label="Data" class="u-nowrap-desktop">{{ data(decisao.instante) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!pagina.carregando() && !mensagemDeErro()) {
        @if (temFiltro()) {
          <ui-empty-state
            heading="Nenhuma decisão encontrada"
            description="Nenhuma decisão corresponde aos filtros. Ajuste ou limpe os filtros."
          >
            <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
              Limpar filtros
            </button>
          </ui-empty-state>
        } @else {
          <ui-empty-state
            heading="Nenhuma decisão registrada"
            description="Quando a proteção de dados aprovar, recomendar ajuste ou reprovar um item, a decisão aparece aqui."
          />
        }
      }

      <ui-list-footer
        navigationLabel="Paginação das decisões"
        [pageSizeOptions]="opcoesDeLimite"
        [pageSize]="limite()"
        (pageSizeChange)="aoTrocarLimite($event)"
        [hasRows]="pagina.itens().length > 0"
        [hasPrevious]="pagina.anterior() !== null"
        [hasNext]="pagina.proximo() !== null"
        [isDisabled]="pagina.carregando()"
        (previous)="pagina.voltar()"
        (next)="pagina.proxima()"
      />
    </section>

    <ui-drawer
      class="form-drawer"
      [(visible)]="drawerAberto"
      [heading]="selecionada()?.itemNome ?? 'Decisão'"
      ariaLabel="Detalhe da decisão"
      focoInicial="titulo"
      position="right"
    >
      @if (drawerAberto() && selecionada(); as decisao) {
        <div
          class="form-drawer__form"
          role="region"
          tabindex="0"
          aria-label="Dados da decisão"
          [attr.aria-busy]="carregandoHistorico()"
        >
          <section class="cfg-detalhe-secao">
            <h3 class="cfg-detalhe-secao__titulo">A decisão</h3>
            <dl class="cfg-detalhe">
              <div>
                <dt>Decisão</dt>
                <dd>
                  <ui-tag [variant]="rotuloDoAto(decisao.ato).variante">{{
                    rotuloDoAto(decisao.ato).texto
                  }}</ui-tag>
                </dd>
              </div>
              <div>
                <dt>Item</dt>
                <dd>
                  {{ cadastro(decisao.cadastro) }}: {{ decisao.itemNome }} (<code>{{
                    decisao.itemCodigo
                  }}</code
                  >)
                </dd>
              </div>
              <div>
                <dt>Decidido por</dt>
                <dd>{{ decisao.atorNome || 'Pessoa não identificada' }}</dd>
              </div>
              <div>
                <dt>Decidido em</dt>
                <dd>{{ dataEHora(decisao.instante) }}</dd>
              </div>
              @if (decisao.classificacaoRecomendada; as recomendada) {
                <div>
                  <dt>Classificação recomendada</dt>
                  <dd>{{ rotulo(classificacoes, recomendada) }}</dd>
                </div>
              }
              @if (decisao.justificativa; as justificativa) {
                <div>
                  <dt>Justificativa</dt>
                  <dd class="cfg-justificativa">{{ justificativa }}</dd>
                </div>
              }
            </dl>
          </section>
          <cfg-detalhe-da-protecao titulo="Proteção conferida" [protecao]="decisao" />
          <section class="cfg-detalhe-secao">
            <h3 class="cfg-detalhe-secao__titulo">Histórico do item</h3>
            @if (carregandoHistorico()) {
              <span class="list-state__loading"><ui-spinner size="sm" /> Carregando o histórico</span>
            }
            @if (erroDoHistorico(); as erro) {
              <ui-alert
                variant="danger"
                [heading]="
                  itemInexistente()
                    ? 'Item não encontrado'
                    : 'Não foi possível carregar o histórico'
                "
              >
                {{ erro }}
                @if (!itemInexistente()) {
                  <div class="list-state__retry">
                    <button
                      type="button"
                      class="btn btn--secondary btn--sm"
                      (click)="lerHistorico(decisao)"
                    >
                      Tentar novamente
                    </button>
                  </div>
                }
              </ui-alert>
            } @else if (historico(); as atos) {
              <cfg-atos-da-protecao [atos]="atos" ariaLabel="Histórico completo do item" />
            }
          </section>
        </div>
        <div class="form-drawer__footer">
          <button
            type="button"
            class="btn btn--tertiary btn--rect"
            (click)="drawerAberto.set(false)"
          >
            Fechar
          </button>
        </div>
      }
    </ui-drawer>
  `,
})
export class DecisoesDaProtecaoComponent {
  private readonly api = inject(ProtecaoDoCatalogoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly decisoes = DECISOES_FILTRAVEIS;
  protected readonly cadastros = OPCOES_DE_CADASTRO;
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly opcoesDeLimite = DEFAULT_PAGE_SIZE_OPTIONS;
  protected readonly rotulo = rotuloDe;
  protected readonly rotuloDoAto = rotuloDoAto;
  protected readonly cadastro = nomeDoCadastro;
  protected readonly data = (instante: string): string => formatarDataBr(instante);
  protected readonly dataEHora = (instante: string): string => formatarDataBr(instante, 'datetime');
  protected readonly chaveDe = (decisao: DecisaoDaProtecaoDto): string =>
    `${decisao.cadastro}|${decisao.itemId}|${decisao.ato}|${decisao.instante}`;

  /** A URL é a fonte dos filtros: voltar no navegador e recarregar a página trazem o mesmo recorte. */
  protected readonly filtros = toSignal(this.route.queryParamMap.pipe(map(filtrosDaUrl)), {
    initialValue: filtrosDaUrl(this.route.snapshot.queryParamMap),
  });
  protected readonly limite = signal<number>(DEFAULT_PAGE_SIZE);
  protected readonly termoBusca = signal(this.filtros().busca);
  protected readonly periodoComErro = computed(() => periodoInvalido(this.filtros()));
  protected readonly temFiltro = computed(
    () => JSON.stringify(this.filtros()) !== JSON.stringify(SEM_FILTROS),
  );

  protected readonly filtrosAtivos = computed<readonly UiFiltroAtivo[]>(() => {
    const f = this.filtros();
    const ativos: UiFiltroAtivo[] = [];
    if (f.ato.length > 0) {
      ativos.push({
        nome: 'Decisão',
        valor: f.ato.map((ato) => rotuloDoAto(ato).texto).join(', '),
      });
    }
    if (f.cadastro !== null) ativos.push({ nome: 'Cadastro', valor: nomeDoCadastro(f.cadastro) });
    if (f.de !== '' || f.ate !== '') {
      ativos.push({
        nome: 'Período',
        valor: `${formatarDataBr(f.de) || 'início'} a ${formatarDataBr(f.ate) || 'hoje'}`,
      });
    }
    if (f.minhas) ativos.push({ nome: 'Só as minhas', valor: 'sim' });
    return ativos;
  });

  protected readonly pagina = new PaginaPorCursor<DecisaoDaProtecaoDto>((pagina) => {
    const f = this.filtros();
    return this.api.listarDecisoes({
      ato: f.ato,
      cadastro: f.cadastro ?? undefined,
      de: f.de,
      ate: f.ate,
      busca: f.busca,
      minhas: f.minhas,
      limit: this.limite(),
      cursor: pagina?.cursor,
      direction: pagina?.direction,
    });
  }, inject(DestroyRef));

  protected readonly mensagemDeErro = computed(() => {
    const problema = this.pagina.problema();
    return problema === null ? null : this.problemI18n.resolve(problema).title;
  });

  protected readonly drawerAberto = signal(false);
  protected readonly selecionada = signal<DecisaoDaProtecaoDto | null>(null);
  private readonly leituraDoItem = new LeituraDoDetalhe(
    this.api,
    this.problemI18n,
    this.destroyRef,
  );
  protected readonly historico = computed(() => this.leituraDoItem.detalhe()?.atos ?? null);
  protected readonly carregandoHistorico = this.leituraDoItem.carregando;
  protected readonly erroDoHistorico = this.leituraDoItem.erro;
  protected readonly itemInexistente = this.leituraDoItem.naoEncontrado;

  /** A busca que a tela mandou para a URL: a que volta dela não reescreve o campo enquanto a pessoa digita. */
  private buscaEnviada = this.filtros().busca;

  constructor() {
    // Mudou o filtro ou o tamanho da página: recomeça da primeira, porque o cursor pertence à consulta que o emitiu.
    effect(() => {
      this.filtros();
      this.limite();
      untracked(() => this.carregar());
    });
    effect(() => {
      const busca = this.filtros().busca;
      untracked(() => {
        if (busca !== this.buscaEnviada) {
          this.buscaEnviada = busca;
          this.termoBusca.set(busca);
        }
      });
    });
    toObservable(this.termoBusca)
      .pipe(
        debounceTime(BUSCA_DEBOUNCE_MS),
        map((termo) => termo.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((busca) => {
        if (busca === this.filtros().busca) return;
        this.buscaEnviada = busca;
        this.aplicar({ busca });
      });
  }

  /** Período invertido não tem o que consultar: cancela a busca em voo e deixa a lista vazia, também no "Tentar novamente". */
  protected carregar(): void {
    if (periodoInvalido(this.filtros())) this.pagina.cancelar();
    else this.pagina.carregar();
  }

  protected aoTrocarLimite(valor: number | null): void {
    if (valor !== null && valor !== this.limite()) this.limite.set(valor);
  }

  protected trocarCadastro(valor: string | null): void {
    this.aplicar({ cadastro: CADASTROS.find((cadastro) => cadastro === valor) ?? null });
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected marcadoEm(evento: Event): boolean {
    return (evento.target as HTMLInputElement).checked;
  }

  protected alternarDecisao(ato: AtoDeDecisao): void {
    const atual = this.filtros().ato;
    const marcadas = atual.includes(ato) ? atual.filter((valor) => valor !== ato) : [...atual, ato];
    this.aplicar({ ato: ATOS_DE_DECISAO.filter((valor) => marcadas.includes(valor)) });
  }

  protected aplicar(parcial: Partial<FiltrosDasDecisoes>): void {
    const novos: FiltrosDasDecisoes = { ...this.filtros(), ...parcial };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aba: 'decisoes', ...paramsDosFiltros(novos) },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected limparFiltros(): void {
    this.termoBusca.set('');
    this.buscaEnviada = '';
    this.aplicar(SEM_FILTROS);
  }

  protected abrir(decisao: DecisaoDaProtecaoDto): void {
    this.selecionada.set(decisao);
    this.drawerAberto.set(true);
    this.lerHistorico(decisao);
  }

  protected lerHistorico(decisao: DecisaoDaProtecaoDto): void {
    this.leituraDoItem.ler(decisao.cadastro as CadastroDoCatalogo, decisao.itemId);
  }
}
