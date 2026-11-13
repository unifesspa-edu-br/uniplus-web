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
import { RecusaDaLeituraComponent, recusaDe } from '../recusa-da-leitura';
import { ManifestacoesDaProtecaoComponent } from './manifestacoes-da-protecao.component';

/**
 * De onde o histórico é lido: da fila da proteção de dados, por quem aprova, consulta ou se
 * manifesta, ou da tela de cadastro do item, por quem a administra. Só se lê; não há ação.
 */
export type OrigemDoHistoricoDasManifestacoes = 'fila' | 'cadastro';

interface ItemDoHistorico {
  readonly cadastro: CadastroDoCatalogo;
  readonly id: string;
  readonly origem: OrigemDoHistoricoDasManifestacoes;
}

/** A rota do histórico de cada cadastro na tela de cadastro do item. */
const ROTA_NO_CADASTRO: Readonly<Record<CadastroDoCatalogo, string>> = {
  TIPO_DOCUMENTO: 'tipos-documento',
  FATO: 'fatos-candidato',
};

/** O caminho do histórico do item, a partir de `/api/configuracao/admin`. */
function caminhoDoHistorico(item: ItemDoHistorico): string {
  const id = encodeURIComponent(item.id);
  return item.origem === 'cadastro'
    ? `${ROTA_NO_CADASTRO[item.cadastro]}/${id}/protecao/manifestacoes`
    : `protecao-do-catalogo/${SEGMENTO_DO_CADASTRO[item.cadastro]}/${id}/manifestacoes`;
}

/**
 * Todas as manifestações técnicas do item, de todos os ciclos: parecer, texto, autor, instante e
 * situação. A leitura é registrada pela API: sem o registro ela responde 503, e a tela mostra a
 * falha sem nenhum dado e oferece nova tentativa. A recusa por permissão ou item inexistente não
 * se repete.
 */
@Component({
  selector: 'cfg-historico-das-manifestacoes',
  standalone: true,
  imports: [
    FalhaDeLeituraComponent,
    ManifestacoesDaProtecaoComponent,
    RecusaDaLeituraComponent,
    SpinnerComponent,
  ],
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
      <cfg-recusa-da-leitura naoEncontrado="Item não encontrado" [recusa]="recusa()">
        Feche o painel e confira a lista.
      </cfg-recusa-da-leitura>
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
  readonly origem = input<OrigemDoHistoricoDasManifestacoes>('fila');

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
  /** Sem permissão ou item inexistente: repetir a leitura não muda a resposta. */
  protected readonly recusa = computed(() =>
    recusaDe(this.consulta.problem(), this.textoDaFalha() ?? ''),
  );
  protected readonly leitura = acompanharLeitura({
    assunto: 'manifestações',
    falha: computed(() => (this.recusa() ? null : this.textoDaFalha())),
    recusada: computed(() => this.recusa() !== null),
    pendente: this.consulta.isLoading,
    recarregar: () => this.consulta.reload(),
    destino: () => document.getElementById('cfg-historico-das-manifestacoes'),
  });

  constructor() {
    effect(() => {
      const item = { cadastro: this.cadastro(), id: this.id(), origem: this.origem() };
      this.versao();
      untracked(() => this.ler(item));
    });
  }

  private ler(item: ItemDoHistorico): void {
    const atual = this.item();
    const mesmo = atual?.id === item.id && atual.cadastro === item.cadastro;
    if (mesmo && atual.origem === item.origem) this.consulta.reload();
    else this.item.set(item);
  }

  private textoDaFalha(): string | null {
    const problema = this.consulta.problem();
    if (problema !== null) return this.problemas.resolve(problema).title;
    return this.consulta.error() ? 'Erro inesperado ao carregar as manifestações.' : null;
  }

  private url(item: ItemDoHistorico): string {
    return `${this.basePath}/api/configuracao/admin/${caminhoDoHistorico(item)}`;
  }
}
