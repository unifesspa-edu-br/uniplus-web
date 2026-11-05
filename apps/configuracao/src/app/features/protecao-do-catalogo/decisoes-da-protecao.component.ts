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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { type AtoDeDecisao, type DecisaoDaProtecaoDto } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  FilterBarComponent,
  FilterChipsComponent,
  type UiFilterChipOption,
  type UiFiltroAtivo,
} from '@uniplus/shared-ui/components';
import { formatarDataBr } from '@uniplus/shared-utils';
import { DecisoesDaProtecaoListaComponent } from './decisoes-da-protecao-lista.component';
import { DecisaoDaProtecaoDetalheComponent } from './decisao-da-protecao-detalhe.component';
import { DecisoesDaProtecaoStore } from './decisoes-da-protecao.store';
import {
  DECISOES_FILTRAVEIS,
  nomeDoCadastro,
  rotuloDoAto,
} from '../../shared/protecao-do-catalogo';
import {
  ATOS_DE_DECISAO,
  CADASTROS,
  SEM_FILTROS,
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
    DecisaoDaProtecaoDetalheComponent,
    DecisoesDaProtecaoListaComponent,
    FilterBarComponent,
    FilterChipsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decisoes-da-protecao.component.html',
  providers: [DecisoesDaProtecaoStore],
})
export class DecisoesDaProtecaoComponent {
  protected readonly pagina = inject(DecisoesDaProtecaoStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly decisoes = DECISOES_FILTRAVEIS;
  protected readonly cadastros = OPCOES_DE_CADASTRO;
  protected readonly filtros = this.pagina.filtros;
  protected readonly limite = this.pagina.limite;
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

  protected readonly mensagemDeErro = this.pagina.mensagemDeErro;
  protected readonly drawerAberto = signal(false);
  protected readonly selecionada = signal<DecisaoDaProtecaoDto | null>(null);
  protected readonly historico = this.pagina.historico;
  protected readonly carregandoHistorico = this.pagina.carregandoHistorico;
  protected readonly erroDoHistorico = this.pagina.erroDoHistorico;
  protected readonly itemInexistente = this.pagina.itemInexistente;

  /** A busca que a tela mandou para a URL: a que volta dela não reescreve o campo enquanto a pessoa digita. */
  private buscaEnviada = this.filtros().busca;

  constructor() {
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

  protected carregar(): void {
    this.pagina.carregar();
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
    this.pagina.lerHistorico(decisao);
  }
}
