import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { deveRotacionarIdempotencyKey, idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ProtecaoDoCatalogoApi,
  type CadastroDoCatalogo,
  type ItemDaProtecaoDoCatalogoDto,
  type SolicitacaoDaProtecaoDto,
} from '@uniplus/shared-data/configuracao';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { CLASSIFICACOES_DE_PROTECAO, nomeDoCadastro, rotuloDe } from './protecao-de-dados';

const chaveDe = (item: ItemDaProtecaoDoCatalogoDto): string => `${item.tipo}:${item.id}`;

/**
 * A solicitação de aprovação da proteção de dados (UNI-REQ-0205): mostra os itens pendentes, todos marcados, e envia só os que a
 * pessoa deixar marcados. Só depois do envio a proteção de dados é avisada.
 *
 * Ao cancelar o foco volta ao botão que abriu o diálogo; com a solicitação enviada o botão some, e
 * quem hospeda leva o foco ao título da lista pelo evento `enviada`.
 */
@Component({
  selector: 'cfg-solicitacao-da-protecao-dialog',
  standalone: true,
  imports: [AlertComponent, DialogComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './solicitacao-da-protecao.dialog.css',
  template: `
    <ui-dialog
      [(visible)]="visible"
      heading="Enviar solicitação de aprovação"
      size="largo"
      [dismissible]="!enviando()"
    >
      @if (erro()) {
        <ui-alert variant="danger" heading="Não foi possível enviar a solicitação">{{ erro() }}</ui-alert>
      }
      <p id="cfg-solicitacao-descricao">
        Os itens marcados vão para a proteção de dados, que aprova, recomenda ajuste ou reprova cada um. O
        item que não for aprovado não pode ser usado na configuração de um processo seletivo.
      </p>
      <label class="checkbox cfg-marcar-todos-cartao">
        <input
          type="checkbox"
          aria-label="Marcar todos os itens"
          [checked]="todosMarcados()"
          [indeterminate]="algunsMarcados()"
          [disabled]="enviando()"
          (change)="marcarTodos($any($event.target).checked)"
        />
        <span class="checkbox__box" aria-hidden="true"></span>
        Marcar todos
      </label>
      <div class="table-responsive">
        <table aria-describedby="cfg-solicitacao-descricao">
          <caption class="sr-only">Itens que vão na solicitação, com a sensibilidade de cada um</caption>
          <thead>
            <tr>
              <th scope="col" class="cfg-selecao">
                <span class="sr-only">Enviar</span>
                <label class="checkbox">
                  <input
                    type="checkbox"
                    aria-label="Marcar todos os itens"
                    [checked]="todosMarcados()"
                    [indeterminate]="algunsMarcados()"
                    [disabled]="enviando()"
                    (change)="marcarTodos($any($event.target).checked)"
                  />
                  <span class="checkbox__box" aria-hidden="true"></span>
                </label>
              </th>
              @if (variosCadastros()) {
                <th scope="col">Cadastro</th>
              }
              <th scope="col">Item</th>
              <th scope="col">Sensibilidade</th>
            </tr>
          </thead>
          <tbody>
            @for (item of pendentes(); track chaveDe(item)) {
              <tr>
                <td data-label="Enviar" class="cfg-selecao">
                  <label class="checkbox">
                    <input
                      type="checkbox"
                      [attr.aria-label]="'Enviar ' + item.nome"
                      [attr.aria-invalid]="recusaDe(item) ? 'true' : null"
                      [attr.aria-describedby]="recusaDe(item) ? idDaRecusa(item) : null"
                      [checked]="marcado(item)"
                      [disabled]="enviando()"
                      (change)="marcar(item, $any($event.target).checked)"
                    />
                    <span class="checkbox__box" aria-hidden="true"></span>
                  </label>
                </td>
                @if (variosCadastros()) {
                  <td data-label="Cadastro">{{ cadastro(item) }}</td>
                }
                <td data-label="Item">
                  {{ item.nome }}
                  @if (recusaDe(item); as recusa) {
                    <div class="field__error" [id]="idDaRecusa(item)">{{ recusa }}</div>
                  }
                </td>
                <td data-label="Sensibilidade">{{ classificacao(item) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <ng-container uiDialogFooter>
        <button type="button" class="btn btn--tertiary btn--rect" [disabled]="enviando()" (click)="visible.set(false)">
          Cancelar
        </button>
        <button type="button" class="btn btn--primary" [disabled]="enviando() || marcados().length === 0" (click)="enviar()">
          @if (enviando()) {
            <ui-spinner spinnerSize="sm" />
          }
          {{ rotuloDoEnvio() }}
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class SolicitacaoDaProtecaoDialogComponent {
  private readonly api = inject(ProtecaoDoCatalogoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = model(false);
  /** Os itens pendentes que a pessoa pode escolher para a solicitação: só dos cadastros que ela mantém. */
  readonly pendentes = input.required<readonly ItemDaProtecaoDoCatalogoDto[]>();
  readonly enviada = output<SolicitacaoDaProtecaoDto>();
  /** A API recusou itens que já não estão pendentes: quem hospeda relê a situação, e o item sai da lista. */
  readonly desatualizada = output<void>();

  /** O que a API recusou em cada item da última tentativa, pela chave do item. */
  private readonly recusas = signal<ReadonlyMap<string, string>>(new Map());

  /** As chaves dos itens que a pessoa deixou marcados; a cada abertura todos voltam marcados. */
  private readonly chavesMarcadas = signal<ReadonlySet<string>>(new Set());
  protected readonly marcados = computed(() => this.pendentes().filter((item) => this.chavesMarcadas().has(chaveDe(item))));
  /** A coluna Cadastro só distingue os itens quando a solicitação mistura tipos de documento e fatos. */
  protected readonly variosCadastros = computed(() => new Set(this.pendentes().map((item) => item.tipo)).size > 1);
  protected readonly todosMarcados = computed(() => this.pendentes().length > 0 && this.marcados().length === this.pendentes().length);
  protected readonly algunsMarcados = computed(() => this.marcados().length > 0 && !this.todosMarcados());
  protected readonly rotuloDoEnvio = computed(() => {
    const total = this.marcados().length;
    return total === 1 ? 'Enviar 1 item' : `Enviar ${total} itens`;
  });

  protected readonly chaveDe = chaveDe;
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  private chave = idempotencyKey.create();

  constructor() {
    // Cada abertura é uma intenção nova: não herda o erro nem a chave da anterior.
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        this.erro.set(null);
        this.chave = idempotencyKey.create();
        this.chavesMarcadas.set(new Set(this.pendentes().map(chaveDe)));
        this.recusas.set(new Map());
      });
    });
  }

  protected recusaDe(item: ItemDaProtecaoDoCatalogoDto): string | null {
    return this.recusas().get(chaveDe(item)) ?? null;
  }

  protected idDaRecusa(item: ItemDaProtecaoDoCatalogoDto): string {
    return `cfg-recusa-${chaveDe(item)}`;
  }

  protected marcado(item: ItemDaProtecaoDoCatalogoDto): boolean {
    return this.chavesMarcadas().has(chaveDe(item));
  }

  protected marcar(item: ItemDaProtecaoDoCatalogoDto, marcado: boolean): void {
    this.chave = idempotencyKey.create();
    this.chavesMarcadas.update((chaves) => {
      const proximas = new Set(chaves);
      if (marcado) proximas.add(chaveDe(item));
      else proximas.delete(chaveDe(item));
      return proximas;
    });
  }

  protected marcarTodos(marcado: boolean): void {
    this.chave = idempotencyKey.create();
    this.chavesMarcadas.set(marcado ? new Set(this.pendentes().map(chaveDe)) : new Set());
  }

  protected cadastro(item: ItemDaProtecaoDoCatalogoDto): string {
    return nomeDoCadastro(item.tipo);
  }

  protected classificacao(item: ItemDaProtecaoDoCatalogoDto): string {
    return rotuloDe(CLASSIFICACOES_DE_PROTECAO, item.classificacaoProtecao);
  }

  protected enviar(): void {
    const itens = this.marcados().map((item) => ({ cadastro: item.tipo as CadastroDoCatalogo, id: item.id }));
    if (this.enviando() || itens.length === 0) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.recusas.set(new Map());
    const enviados = this.marcados();
    this.api
      .solicitar(itens, withIdempotencyKey(this.chave))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.enviando.set(false);
        if (resultado.ok) {
          const { tiposDeDocumento, fatos } = resultado.data;
          this.notifications.success('Solicitação enviada', `${tiposDeDocumento + fatos} item(ns) aguardam a proteção de dados.`);
          this.visible.set(false);
          this.enviada.emit(resultado.data);
          return;
        }
        if (deveRotacionarIdempotencyKey(resultado.problem)) this.chave = idempotencyKey.create();
        const titulo = this.problemI18n.resolve(resultado.problem).title;
        this.marcarRecusados(resultado.problem, enviados);
        this.erro.set(titulo);
        if (resultado.problem.status >= 500) this.notifications.errorFromProblem(resultado.problem, { title: titulo });
      });
  }

  /**
   * A API aponta o item recusado por `itens[i].id`, com `i` a posição dele na solicitação enviada. O item
   * recusado fica sinalizado na linha e sai da marcação, para a pessoa reenviar os demais.
   */
  private marcarRecusados(problem: ProblemDetails, enviados: readonly ItemDaProtecaoDoCatalogoDto[]): void {
    const recusas = new Map<string, string>();
    for (const erro of problem.errors ?? []) {
      const indice = /^itens\[(\d+)\]\.id$/u.exec(erro.field)?.[1];
      const item = indice === undefined ? undefined : enviados[Number(indice)];
      if (item !== undefined) recusas.set(chaveDe(item), erro.message);
    }
    if (recusas.size === 0) return;
    this.recusas.set(recusas);
    // O corpo mudou: a mesma chave com outro corpo seria recusada.
    this.chave = idempotencyKey.create();
    this.chavesMarcadas.update((chaves) => new Set([...chaves].filter((chave) => !recusas.has(chave))));
    this.desatualizada.emit();
  }
}
