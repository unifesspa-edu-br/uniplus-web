import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ChaveDeSubstituicao, ProblemI18nService, comChave } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ConcessoesApi,
  type ConcessaoDto,
  type EventoDaTrilhaDto,
  type SituacaoDaConcessao,
} from '@uniplus/shared-data/autorizacao';
import {
  AlertComponent,
  DrawerComponent,
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { FALHA_INESPERADA, textoDaRecusa } from './mensagens-de-acesso';
import { RevogarConcessaoDialogComponent } from './revogar-concessao-dialog.component';
import { nomesDeEscopo } from './nomes-de-escopo';
import { PaginaPorCursor } from './pagina-por-cursor';
import { autorDoEvento, TrilhaDeAcessoComponent } from './trilha-de-acesso.component';

/** Recusa da API ao e-mail que não é o do beneficiário; aparece no campo, não no topo do diálogo. */
const CODIGO_EMAIL_DIVERGENTE = 'uniplus.autorizacao.concessao.confirmacao_divergente';

const SITUACOES: readonly { readonly value: SituacaoDaConcessao; readonly label: string }[] = [
  { value: 'ativa', label: 'Ativas' },
  { value: 'vencida', label: 'Vencidas' },
  { value: 'revogada', label: 'Revogadas' },
  { value: 'todas', label: 'Todas' },
];

/** Concessões de acesso: consulta, trilha e revogação, que vale na hora e dispensa aprovação. */
@Component({
  selector: 'cfg-concessoes-page',
  standalone: true,
  imports: [
    FormsModule,
    AlertComponent,
    DrawerComponent,
    EmptyStateComponent,
    IconButtonComponent,
    RevogarConcessaoDialogComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
    TrilhaDeAcessoComponent,
    DateBrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Concessões de acesso</h1>
        <p class="page-header__desc">
          Quem tem acesso a quê, a trilha de cada concessão e a revogação, que tem efeito imediato.
        </p>
      </div>
    </div>

    @if (mensagemDeErro(); as mensagem) {
      <ui-alert variant="danger" heading="Não foi possível carregar as concessões">
        {{ mensagem }}
        <div>
          <button type="button" class="btn btn--secondary btn--sm" (click)="pagina.carregar()">
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }

    <section
      class="panel"
      aria-labelledby="cfg-concessoes-titulo"
      [attr.aria-busy]="pagina.carregando()"
    >
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-concessoes-titulo">Concessões</h2>
          @if (pagina.carregando()) {
            <span><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <label class="field">
          <span class="field__label">Situação</span>
          <select class="select" [ngModel]="situacao()" (ngModelChange)="filtrarPor($event)">
            @for (opcao of situacoes; track opcao.value) {
              <option [value]="opcao.value">{{ opcao.label }}</option>
            }
          </select>
        </label>
      </div>

      @if (pagina.itens().length > 0) {
        <div class="table-responsive">
          <table>
            <caption class="sr-only">
              Concessões de acesso
            </caption>
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col">Perfil</th>
                <th scope="col">Escopo</th>
                <th scope="col">Concedida em</th>
                <th scope="col">Válida até</th>
                <th scope="col">Situação</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (concessao of pagina.itens(); track concessao.id) {
                <tr>
                  <td data-label="Pessoa">
                    {{ pessoa(concessao) }}
                  </td>
                  <td data-label="Perfil">{{ concessao.perfil.nome }}</td>
                  <td data-label="Escopo">{{ escopo.nome(concessao.escopo) }}</td>
                  <td data-label="Concedida em">
                    {{ concessao.concedidaEm | dateBr: 'datetime' }}
                  </td>
                  <td data-label="Válida até">
                    {{
                      concessao.validaAte ? (concessao.validaAte | dateBr: 'datetime') : 'Sem prazo'
                    }}
                  </td>
                  <td data-label="Situação">
                    <ui-tag [variant]="situacaoDe(concessao).variante">{{
                      situacaoDe(concessao).texto
                    }}</ui-tag>
                  </td>
                  <td class="table-responsive__actions" data-label="Ações">
                    @if (concessao.origem.tipo === 'pedido') {
                      <ui-icon-button
                        icon="pi-eye"
                        [link]="['/acessos/pedidos', concessao.origem.id]"
                        [accessibleName]="
                          'Visualizar o pedido da concessão de ' + pessoa(concessao)
                        "
                        tooltip="Visualizar pedido"
                      />
                    }
                    <ui-icon-button
                      icon="pi-list"
                      [accessibleName]="'Ver a trilha da concessão de ' + concessao.perfil.nome"
                      tooltip="Ver trilha"
                      (triggered)="abrirTrilha(concessao)"
                    />
                    @if (concessao.ativa) {
                      <ui-icon-button
                        icon="pi-ban"
                        [accessibleName]="'Revogar a concessão de ' + concessao.perfil.nome"
                        tooltip="Revogar concessão"
                        (triggered)="pedirRevogacao(concessao)"
                      />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!pagina.carregando() && !mensagemDeErro()) {
        <ui-empty-state
          heading="Nenhuma concessão"
          description="Nenhuma concessão corresponde a este filtro."
        />
      }

      @if (pagina.anterior() !== null || pagina.proximo() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de concessões"
          [hasPrevious]="pagina.anterior() !== null"
          [hasNext]="pagina.proximo() !== null"
          [isDisabled]="pagina.carregando()"
          (previous)="pagina.voltar()"
          (next)="pagina.proxima()"
        />
      }
    </section>

    <ui-drawer
      class="cfg-detail-drawer cfg-detail-drawer--ampla"
      [(visible)]="trilhaAberta"
      heading="Trilha da concessão"
      ariaLabel="Trilha da concessão"
      position="right"
    >
      @if (carregandoTrilha()) {
        <p role="status"><ui-spinner size="sm" /> Carregando a trilha…</p>
      }
      @if (erroDaTrilha()) {
        <ui-alert variant="danger" heading="Não foi possível carregar a trilha">{{
          erroDaTrilha()
        }}</ui-alert>
      }
      <cfg-trilha-de-acesso [eventos]="trilha()" legenda="Trilha da concessão" />
    </ui-drawer>

    <cfg-revogar-concessao-dialog
      [(visible)]="revogando"
      [concessao]="concessaoARevogar()"
      [escopoDaConcessao]="escopoDaRevogacao()"
      [erro]="erroDaRevogacao()"
      [erroDoEmail]="erroDoEmail()"
      [enviando]="enviando()"
      (confirmado)="revogar($event.motivo, $event.confirmacaoEmail)"
    />
  `,
})
export class ConcessoesPage implements OnInit {
  private readonly api = inject(ConcessoesApi);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly chave = new ChaveDeSubstituicao();

  protected readonly escopo = nomesDeEscopo();
  protected readonly situacoes = SITUACOES;
  protected readonly situacao = signal<SituacaoDaConcessao>('ativa');

  protected readonly pagina = new PaginaPorCursor(
    (pagina) =>
      this.api.listar({
        situacao: this.situacao(),
        cursor: pagina?.cursor,
        direction: pagina?.direction,
      }),
    inject(DestroyRef),
  );

  protected readonly mensagemDeErro = computed(() => {
    const problema = this.pagina.problema();
    return problema === null ? null : textoDaRecusa(this.problemas.resolve(problema));
  });

  protected readonly trilhaAberta = signal(false);
  protected readonly trilha = signal<readonly EventoDaTrilhaDto[]>([]);
  protected readonly carregandoTrilha = signal(false);
  protected readonly erroDaTrilha = signal<string | null>(null);

  protected readonly revogando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroDaRevogacao = signal<string | null>(null);
  protected readonly erroDoEmail = signal<string | null>(null);
  protected readonly concessaoARevogar = signal<ConcessaoDto | null>(null);
  protected readonly escopoDaRevogacao = computed(() => {
    const concessao = this.concessaoARevogar();
    return concessao === null ? '' : this.escopo.nome(concessao.escopo);
  });
  private concessaoDaTrilha: string | null = null;

  ngOnInit(): void {
    this.pagina.carregar();
  }

  protected filtrarPor(situacao: SituacaoDaConcessao): void {
    this.situacao.set(situacao);
    this.pagina.carregar();
  }

  /** O nome gravado na concessão; sem ele, o início do `sub`. Nunca o CPF. */
  protected pessoa(concessao: ConcessaoDto): string {
    return autorDoEvento(concessao.beneficiario);
  }

  protected situacaoDe(concessao: ConcessaoDto): {
    readonly texto: string;
    readonly variante: 'success' | 'neutral' | 'warning';
  } {
    if (concessao.revogadaEm !== null) return { texto: 'Revogada', variante: 'neutral' };
    return concessao.ativa
      ? { texto: 'Ativa', variante: 'success' }
      : { texto: 'Vencida', variante: 'warning' };
  }

  protected async abrirTrilha(concessao: ConcessaoDto): Promise<void> {
    this.trilha.set([]);
    this.erroDaTrilha.set(null);
    this.carregandoTrilha.set(true);
    this.trilhaAberta.set(true);
    this.concessaoDaTrilha = concessao.id;
    try {
      const resultado = await firstValueFrom(this.api.trilha(concessao.id));
      if (this.concessaoDaTrilha !== concessao.id) return;
      if (resultado.ok) this.trilha.set(resultado.data);
      else this.erroDaTrilha.set(textoDaRecusa(this.problemas.resolve(resultado.problem)));
    } catch {
      if (this.concessaoDaTrilha === concessao.id) this.erroDaTrilha.set(FALHA_INESPERADA);
    } finally {
      if (this.concessaoDaTrilha === concessao.id) this.carregandoTrilha.set(false);
    }
  }

  protected pedirRevogacao(concessao: ConcessaoDto): void {
    this.concessaoARevogar.set(concessao);
    this.erroDaRevogacao.set(null);
    this.erroDoEmail.set(null);
    this.revogando.set(true);
  }

  protected async revogar(motivo: string, confirmacaoEmail: string): Promise<void> {
    const concessao = this.concessaoARevogar();
    if (concessao === null || this.enviando()) return;
    this.enviando.set(true);
    this.erroDaRevogacao.set(null);
    this.erroDoEmail.set(null);
    try {
      const corpo = { motivo, confirmacaoEmail };
      const { resultado } = await comChave(this.chave, { id: concessao.id, ...corpo }, (contexto) =>
        this.api.revogar(concessao.id, corpo, contexto),
      );
      if (!resultado.ok) {
        const texto = textoDaRecusa(this.problemas.resolve(resultado.problem));
        if (resultado.problem.code === CODIGO_EMAIL_DIVERGENTE) this.erroDoEmail.set(texto);
        else this.erroDaRevogacao.set(texto);
        return;
      }
      this.revogando.set(false);
      this.notificacoes.success('Concessão revogada');
      this.pagina.carregar();
    } catch {
      this.erroDaRevogacao.set(FALHA_INESPERADA);
    } finally {
      this.enviando.set(false);
    }
  }
}
