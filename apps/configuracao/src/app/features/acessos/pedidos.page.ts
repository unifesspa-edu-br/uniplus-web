import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import {
  PedidosDeConcessaoApi,
  type FilaDePedidos,
  type PedidoResumoDto,
} from '@uniplus/shared-data/autorizacao';
import {
  AlertComponent,
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { nomesDeEscopo } from './nomes-de-escopo';
import { PaginaPorCursor } from './pagina-por-cursor';
import { OPCOES_DE_SITUACAO_DO_PEDIDO, situacaoDoPedido } from './rotulos-de-acesso';
import { textoDaRecusa } from './mensagens-de-acesso';

interface Apresentacao {
  readonly titulo: string;
  readonly descricao: string;
  readonly vazio: string;
}

const APRESENTACAO: Readonly<Record<FilaDePedidos, Apresentacao>> = {
  meus: {
    titulo: 'Meus pedidos de acesso',
    descricao: 'Pedidos que você fez ou que pedem o seu aceite como beneficiário.',
    vazio: 'Você ainda não tem pedidos de acesso.',
  },
  gestor: {
    titulo: 'Fila do gestor de acessos',
    descricao: 'Pedidos que aguardam a sua aprovação da adequação funcional.',
    vazio: 'Nenhum pedido aguarda a sua aprovação.',
  },
  protecao_de_dados: {
    titulo: 'Fila da proteção de dados',
    descricao:
      'Pedidos de perfil com dado pessoal ou sensível, já aprovados pelo gestor de acessos, que aguardam a adequação à proteção de dados.',
    vazio: 'Nenhum pedido aguarda a sua aprovação.',
  },
  todos: {
    titulo: 'Histórico de pedidos',
    descricao:
      'Todos os pedidos de acesso, em qualquer situação, inclusive os que você já decidiu ou que foram cancelados.',
    vazio: 'Nenhum pedido encontrado.',
  },
};

/** Lista de pedidos de concessão: os de quem pergunta, a fila de uma etapa de aprovação ou o histórico de todos. */
@Component({
  selector: 'cfg-pedidos-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    AlertComponent,
    EmptyStateComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
    DateBrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">{{ texto().titulo }}</h1>
        <p class="page-header__desc">{{ texto().descricao }}</p>
      </div>
      @if (fila() === 'meus') {
        <div class="page-header__actions">
          <a class="btn btn--primary" routerLink="/acessos/pedidos/novo">Pedir acesso</a>
        </div>
      }
    </div>

    @if (mensagemDeErro(); as mensagem) {
      <ui-alert variant="danger" heading="Não foi possível carregar os pedidos">
        {{ mensagem }}
        <div>
          <button type="button" class="btn btn--secondary btn--sm" (click)="recarregar()">
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }

    <section
      class="panel"
      [attr.aria-labelledby]="'cfg-pedidos-titulo'"
      [attr.aria-busy]="pagina.carregando()"
    >
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-pedidos-titulo">Pedidos</h2>
          @if (pagina.carregando()) {
            <span><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        @if (filtraPorSituacao()) {
          <label class="field">
            <span class="field__label">Situação</span>
            <select class="select" [ngModel]="situacao()" (ngModelChange)="filtrarPor($event)">
              <option value="">Todas</option>
              @for (opcao of situacoes; track opcao.value) {
                <option [value]="opcao.value">{{ opcao.label }}</option>
              }
            </select>
          </label>
        }
      </div>

      @if (pagina.itens().length > 0) {
        <div class="table-responsive">
          <table>
            <caption class="sr-only">
              {{
                texto().titulo
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">Beneficiário</th>
                <th scope="col">Perfil</th>
                <th scope="col">Escopo</th>
                <th scope="col">Situação</th>
                <th scope="col">Pedido em</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (pedido of pagina.itens(); track pedido.id) {
                <tr
                  class="table-responsive__row--clickable"
                  [attr.tabindex]="pagina.carregando() ? null : 0"
                  (click)="abrir(pedido)"
                  (keydown.enter)="abrirPeloTeclado(pedido, $event)"
                  (keydown.space)="abrirPeloTeclado(pedido, $event)"
                >
                  <td data-label="Beneficiário">
                    {{ pedido.beneficiario.nome ?? pedido.beneficiario.email }}
                  </td>
                  <td data-label="Perfil">{{ pedido.perfil.nome }}</td>
                  <td data-label="Escopo">{{ escopo.nome(pedido.escopo) }}</td>
                  <td data-label="Situação">
                    <ui-tag [variant]="rotulo(pedido.situacao).variante">{{
                      rotulo(pedido.situacao).texto
                    }}</ui-tag>
                  </td>
                  <td data-label="Pedido em">{{ pedido.criadoEm | dateBr: 'datetime' }}</td>
                  <td
                    class="table-responsive__actions"
                    data-label="Ações"
                    (click)="$event.stopPropagation()"
                    (keydown.enter)="$event.stopPropagation()"
                    (keydown.space)="$event.stopPropagation()"
                  >
                    <ui-icon-button
                      icon="pi-eye"
                      [link]="['/acessos/pedidos', pedido.id]"
                      [queryParams]="origemDoLink()"
                      [accessibleName]="
                        'Visualizar o pedido de ' +
                        pedido.perfil.nome +
                        ' para ' +
                        (pedido.beneficiario.nome ?? pedido.beneficiario.email)
                      "
                      tooltip="Visualizar pedido"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!pagina.carregando() && !mensagemDeErro()) {
        <ui-empty-state heading="Nada por aqui" [description]="texto().vazio" />
      }

      @if (pagina.anterior() !== null || pagina.proximo() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de pedidos"
          [hasPrevious]="pagina.anterior() !== null"
          [hasNext]="pagina.proximo() !== null"
          [isDisabled]="pagina.carregando()"
          (previous)="pagina.voltar()"
          (next)="pagina.proxima()"
        />
      }
    </section>
  `,
})
export class PedidosPage implements OnInit {
  /** A fila vem da rota (`data.fila`). */
  readonly fila = input<FilaDePedidos>('meus');

  private readonly api = inject(PedidosDeConcessaoApi);
  private readonly problemas = inject(ProblemI18nService);
  private readonly router = inject(Router);

  protected readonly escopo = nomesDeEscopo();
  protected readonly situacoes = OPCOES_DE_SITUACAO_DO_PEDIDO;
  protected readonly situacao = signal('');
  protected readonly texto = computed(() => APRESENTACAO[this.fila()]);
  /** As filas das etapas já são uma situação só; a lista dos próprios pedidos e o histórico têm todas. */
  protected readonly filtraPorSituacao = computed(
    () => this.fila() === 'meus' || this.fila() === 'todos',
  );

  protected readonly pagina = new PaginaPorCursor(
    (pagina) =>
      this.api.listar({
        fila: this.fila(),
        situacao: this.situacao() || undefined,
        cursor: pagina?.cursor,
        direction: pagina?.direction,
      }),
    inject(DestroyRef),
  );

  protected readonly mensagemDeErro = computed(() => {
    const problema = this.pagina.problema();
    return problema === null ? null : textoDaRecusa(this.problemas.resolve(problema));
  });

  protected readonly rotulo = situacaoDoPedido;
  /** O detalhe sabe de onde a pessoa veio pelo parâmetro; os próprios pedidos são o padrão. */
  protected readonly origemDoLink = computed(() =>
    this.fila() === 'meus' ? null : { origem: this.fila() },
  );

  ngOnInit(): void {
    this.pagina.carregar();
  }

  /** A linha inteira abre o detalhe, como nas demais listas; o ícone da linha segue para quem navega por ele. */
  protected abrir(pedido: PedidoResumoDto): void {
    if (this.pagina.carregando()) return;
    void this.router.navigate(['/acessos/pedidos', pedido.id], {
      queryParams: this.origemDoLink(),
    });
  }

  /** Enter e Espaço na linha abrem o detalhe; o Espaço não rola a página nem o Enter envia formulário. */
  protected abrirPeloTeclado(pedido: PedidoResumoDto, evento: Event): void {
    if (evento.target !== evento.currentTarget) return;
    evento.preventDefault();
    this.abrir(pedido);
  }

  protected filtrarPor(situacao: string): void {
    this.situacao.set(situacao);
    this.pagina.carregar();
  }

  protected recarregar(): void {
    this.pagina.carregar();
  }
}
