import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  FilterChipsComponent,
  IconButtonComponent,
  LookupAlertComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiFilterChipOption,
  type UiFiltroAtivo,
  type UiLookupFalho,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista, focoEstaLivre } from '../../shared/foco';
import {
  CLASSIFICACOES_DE_PROTECAO,
  SituacaoDaAprovacaoComponent,
  rotuloDe,
} from '../../shared/protecao-do-catalogo';
import type { AndamentoDaEscrita } from '../../shared/escrita';
import { ID_DO_CADASTRO, ID_DO_TITULO_DA_LISTA } from './ids-do-fato';
import { DOMINIOS, ORIGENS, acaoDeAtivacao } from './fato-candidato.regras';

const CHIPS_DE_ORIGEM: readonly UiFilterChipOption[] = [
  { value: '', label: 'Todas' },
  ...ORIGENS.map((origem) => ({ value: origem.valor, label: origem.rotulo })),
];

const CHIPS_DE_SITUACAO: readonly UiFilterChipOption[] = [
  { value: 'true', label: 'Ativos' },
  { value: 'false', label: 'Desativados' },
  { value: '', label: 'Todos' },
];

/** A situação começa em "Ativos": é esse o padrão que fica de fora dos filtros ativos, não "Todos". */
const SITUACAO_PADRAO = 'true';

@Component({
  selector: 'cfg-fatos-candidato-lista',
  imports: [
    TemPermissaoDirective,
    EmptyStateComponent,
    FilterBarComponent,
    FilterChipsComponent,
    IconButtonComponent,
    LookupAlertComponent,
    PagerComponent,
    SituacaoDaAprovacaoComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fatos-candidato-lista.component.html',
})
export class FatosCandidatoListaComponent {
  readonly fatos = input.required<readonly FatoCandidatoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  /** Uma sobreposição (drawer ou confirmação) está aberta sobre a lista. */
  readonly emSobreposicao = input.required<boolean>();
  readonly andamento = input.required<AndamentoDaEscrita | null>();
  readonly erro = input.required<string | null>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly podeSolicitar = input.required<boolean>();
  readonly falhasDeApoio = input.required<readonly UiLookupFalho[]>();
  readonly termoBusca = model.required<string>();
  readonly filtroOrigem = model.required<string>();
  readonly filtroSituacao = model.required<string>();
  readonly cadastrar = output<void>();
  readonly solicitar = output<void>();
  readonly detalhar = output<FatoCandidatoDto>();
  readonly editar = output<FatoCandidatoDto>();
  readonly desativar = output<FatoCandidatoDto>();
  readonly reativar = output<FatoCandidatoDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly permissaoDeManter = PERMISSAO.configuracao.fatosCandidatoManter;
  protected readonly idDoTitulo = ID_DO_TITULO_DA_LISTA;
  protected readonly idDoCadastro = ID_DO_CADASTRO;
  protected readonly chipsDeOrigem = CHIPS_DE_ORIGEM;
  protected readonly chipsDeSituacao = CHIPS_DE_SITUACAO;
  protected readonly origens = ORIGENS;
  protected readonly dominios = DOMINIOS;
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly rotulo = rotuloDe;
  protected readonly acaoDeAtivacao = acaoDeAtivacao;
  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  protected readonly filtrosAtivos = computed<readonly UiFiltroAtivo[]>(() => {
    const ativos: UiFiltroAtivo[] = [];
    const origem = this.filtroOrigem();
    if (origem !== '')
      ativos.push({ nome: 'Origem', valor: rotuloDoChip(CHIPS_DE_ORIGEM, origem) });
    const situacao = this.filtroSituacao();
    if (situacao !== SITUACAO_PADRAO) {
      ativos.push({ nome: 'Situação', valor: rotuloDoChip(CHIPS_DE_SITUACAO, situacao) });
    }
    return ativos;
  });

  private readonly injector = inject(Injector);
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');
  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-fato-id',
    idDoTitulo: ID_DO_TITULO_DA_LISTA,
    idDoCadastro: ID_DO_CADASTRO,
  });

  private abriuSobreposicao = false;

  constructor() {
    effect(() => {
      if (this.emSobreposicao()) {
        this.abriuSobreposicao = true;
      } else if (!this.gravando() && this.abriuSobreposicao) {
        this.abriuSobreposicao = false;
        afterNextRender(() => this.focarTituloSeLivre(), { injector: this.injector });
      }
    });
  }

  /** O aceite parte do detalhe da linha: o foco volta a ela, ou ao título se o filtro a tirou da lista. */
  registrarAceiteDoDetalhe(fato: FatoCandidatoDto): void {
    this.foco.registrar({ acao: 'editar', id: fato.id });
  }

  /**
   * Uma sobreposição fechada depois de a linha sair da lista (recusa com a lista já relida, página
   * seguinte, filtro) não tem a quem devolver o foco: ele vai ao título, se ninguém o tomou.
   */
  private focarTituloSeLivre(): void {
    if (focoEstaLivre()) this.titulo()?.nativeElement.focus();
  }

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionarEditar(fato: FatoCandidatoDto): void {
    this.foco.registrar({ acao: 'editar', id: fato.id });
    this.editar.emit(fato);
  }

  /** Desativar e reativar partem da mesma linha; o foco volta à linha, ou ao título se o filtro a tirou da lista. */
  protected acionarSituacao(fato: FatoCandidatoDto, saida: 'desativar' | 'reativar'): void {
    this.foco.registrar({ acao: 'situacao', id: fato.id });
    if (saida === 'desativar') this.desativar.emit(fato);
    else this.reativar.emit(fato);
  }
}

function rotuloDoChip(chips: readonly UiFilterChipOption[], valor: string): string {
  return chips.find((chip) => chip.value === valor)?.label ?? valor;
}
