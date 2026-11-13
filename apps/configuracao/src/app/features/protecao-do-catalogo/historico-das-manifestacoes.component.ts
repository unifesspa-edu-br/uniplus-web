import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  SEGMENTO_DO_CADASTRO,
  type CadastroDoCatalogo,
  type ManifestacaoDaProtecaoDto,
} from '@uniplus/shared-data/configuracao';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { ManifestacoesDaProtecaoComponent } from './manifestacoes-da-protecao.component';

interface ItemDoHistorico {
  readonly cadastro: CadastroDoCatalogo;
  readonly id: string;
}

/**
 * Todas as manifestações do item, de todos os ciclos, para quem aprova ou consulta. A leitura é
 * registrada pela API: sem o registro ela responde 503, e a tela mostra a falha sem nenhum dado.
 */
@Component({
  selector: 'cfg-historico-das-manifestacoes',
  standalone: true,
  imports: [FalhaDeLeituraComponent, ManifestacoesDaProtecaoComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cfg-detalhe-secao" aria-labelledby="cfg-historico-das-manifestacoes">
      <h3 class="cfg-detalhe-secao__titulo" id="cfg-historico-das-manifestacoes" tabindex="-1">
        Histórico das manifestações
      </h3>
      @if (consulta.isLoading()) {
        <span class="list-state__loading"><ui-spinner spinnerSize="sm" /> Carregando</span>
      }
      <ui-falha-de-leitura
        titulo="Não foi possível carregar as manifestações"
        [leitura]="leitura"
      />
      @if (manifestacoes(); as lista) {
        <cfg-manifestacoes-da-protecao
          [manifestacoes]="lista"
          [comSituacao]="true"
          ariaLabel="Histórico das manifestações técnicas"
          textoVazio="O item ainda não recebeu manifestação técnica."
        />
      }
    </section>
  `,
})
export class HistoricoDasManifestacoesComponent {
  readonly cadastro = input.required<CadastroDoCatalogo>();
  readonly id = input.required<string>();
  /** Cresce a cada manifestação registrada na tela: o histórico é relido. */
  readonly versao = input(0);

  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly item = signal<ItemDoHistorico | null>(null);
  protected readonly consulta = useApiResource<readonly ManifestacaoDaProtecaoDto[]>(() => {
    const item = this.item();
    return item === null
      ? undefined
      : { url: this.url(item), context: withVendorMime('protecao-do-catalogo-manifestacao', 1) };
  });
  /** Com falha não há dado à vista, nem o da leitura anterior. */
  protected readonly manifestacoes = computed(() =>
    this.consulta.problem() === null && !this.consulta.error() ? this.consulta.data() : undefined,
  );
  protected readonly leitura = acompanharLeitura({
    assunto: 'manifestações',
    falha: computed(() => this.textoDaFalha()),
    pendente: this.consulta.isLoading,
    recarregar: () => this.consulta.reload(),
    destino: () => document.getElementById('cfg-historico-das-manifestacoes'),
  });

  constructor() {
    effect(() => {
      const item = { cadastro: this.cadastro(), id: this.id() };
      this.versao();
      untracked(() => this.ler(item));
    });
  }

  private ler(item: ItemDoHistorico): void {
    const atual = this.item();
    if (atual?.id === item.id && atual.cadastro === item.cadastro) this.consulta.reload();
    else this.item.set(item);
  }

  private textoDaFalha(): string | null {
    const problema = this.consulta.problem();
    if (problema !== null) return this.problemas.resolve(problema).title;
    return this.consulta.error() ? 'Erro inesperado ao carregar as manifestações.' : null;
  }

  private url(item: ItemDoHistorico): string {
    const segmento = SEGMENTO_DO_CADASTRO[item.cadastro];
    return `${this.basePath}/api/configuracao/admin/protecao-do-catalogo/${segmento}/${item.id}/manifestacoes`;
  }
}
