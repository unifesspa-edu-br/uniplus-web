import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { deveRotacionarIdempotencyKey, idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ProtecaoDoCatalogoApi,
  type ItemDaProtecaoDoCatalogoDto,
  type SolicitacaoDaProtecaoDto,
} from '@uniplus/shared-data/configuracao';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { CLASSIFICACOES_DE_PROTECAO, nomeDoCadastro, rotuloDe } from './protecao-de-dados';

/**
 * A solicitação de aprovação da proteção de dados (UNI-REQ-0205): mostra os itens pendentes que
 * seguem juntos e os envia de uma vez. Só depois do envio a proteção de dados é avisada.
 *
 * Ao cancelar o foco volta ao botão que abriu o diálogo; com a solicitação enviada o botão some, e
 * quem hospeda leva o foco ao título da lista pelo evento `enviada`.
 */
@Component({
  selector: 'cfg-solicitacao-da-protecao-dialog',
  standalone: true,
  imports: [AlertComponent, DialogComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
        {{ pendentes().length === 1 ? 'O item abaixo vai' : 'Os ' + pendentes().length + ' itens abaixo vão' }}
        para a proteção de dados, que aprova, recomenda ajuste ou reprova cada um. O item que não for
        aprovado não pode ser usado na configuração de um processo seletivo.
      </p>
      <div class="table-responsive">
        <table aria-describedby="cfg-solicitacao-descricao">
          <caption class="sr-only">Itens que vão na solicitação, com a sensibilidade de cada um</caption>
          <thead>
            <tr>
              <th scope="col">Cadastro</th>
              <th scope="col">Item</th>
              <th scope="col">Sensibilidade</th>
            </tr>
          </thead>
          <tbody>
            @for (item of pendentes(); track item.id) {
              <tr>
                <td data-label="Cadastro">{{ cadastro(item) }}</td>
                <td data-label="Item">{{ item.nome }}</td>
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
        <button type="button" class="btn btn--primary" [disabled]="enviando()" (click)="enviar()">
          @if (enviando()) {
            <ui-spinner size="sm" />
          }
          Enviar solicitação
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
  /** Os itens pendentes que a solicitação leva; a API envia todos os que a pessoa pode manter. */
  readonly pendentes = input.required<readonly ItemDaProtecaoDoCatalogoDto[]>();
  readonly enviada = output<SolicitacaoDaProtecaoDto>();

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
      });
    });
  }

  protected cadastro(item: ItemDaProtecaoDoCatalogoDto): string {
    return nomeDoCadastro(item.tipo);
  }

  protected classificacao(item: ItemDaProtecaoDoCatalogoDto): string {
    return rotuloDe(CLASSIFICACOES_DE_PROTECAO, item.classificacaoProtecao);
  }

  protected enviar(): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.api
      .solicitar(withIdempotencyKey(this.chave))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.enviando.set(false);
        if (resultado.ok) {
          const { tiposDeDocumento, fatos } = resultado.data;
          this.notifications.success('Solicitação enviada', `${Number(tiposDeDocumento) + Number(fatos)} item(ns) aguardam a proteção de dados.`);
          this.visible.set(false);
          this.enviada.emit(resultado.data);
          return;
        }
        if (deveRotacionarIdempotencyKey(resultado.problem)) this.chave = idempotencyKey.create();
        const titulo = this.problemI18n.resolve(resultado.problem).title;
        this.erro.set(titulo);
        if (resultado.problem.status >= 500) this.notifications.errorFromProblem(resultado.problem, { title: titulo });
      });
  }
}
