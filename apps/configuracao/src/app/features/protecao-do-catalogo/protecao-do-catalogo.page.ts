import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap } from 'rxjs';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { deveRotacionarIdempotencyKey, idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  FatosCandidatoApi,
  ProtecaoDoCatalogoApi,
  type DecidirProtecaoDoCatalogoCommand,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { DetalheDaProtecaoComponent } from '../../shared/detalhe-do-catalogo';
import {
  CLASSIFICACOES_DE_PROTECAO,
  HIPOTESES_LEGAIS,
  hipotesesDaClassificacao,
  nomeDoCadastro,
  rotuloDe,
} from '../../shared/protecao-do-catalogo';
import { classificacoesDoDominio } from '../fatos-candidato/fato-candidato.regras';

/** O item que a proteção de dados está negando: o diálogo pede a classificação recomendada. */
interface NegativaEmCurso {
  readonly item: ItemDaProtecaoDoCatalogoDto;
}

/** Código da API para o item que já saiu da solicitação (decidido por outra pessoa ou editado). */
const ITEM_FORA_DE_SOLICITACAO = 'uniplus.configuracao.protecao_do_catalogo.item_fora_de_solicitacao';

/**
 * A aprovação da proteção de dados do catálogo: lista o que o administrador
 * enviou na solicitação e deixa a proteção de dados aprovar ou negar cada item. A decisão vale
 * sobre a proteção que a tela mostrou: se o item foi editado depois, a API recusa e a lista é relida.
 */
@Component({
  selector: 'cfg-protecao-do-catalogo-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TemPermissaoDirective,
    AlertComponent,
    DetalheDaProtecaoComponent,
    DialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Proteção de Dados do Catálogo</h1>
        <p class="page-header__desc">
          Os tipos de documento e os fatos do catálogo que aguardam a sua decisão sobre a proteção de dados.
        </p>
      </div>
    </div>

    @if (erroDeCarga()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os itens">
        {{ erroDeCarga() }}
        <div class="cfg-list__retry">
          <button type="button" class="btn btn--secondary btn--sm" [disabled]="carregando()" (click)="carregar()">
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }

    @if (erroDaDecisao()) {
      <ui-alert variant="danger" heading="A decisão não foi registrada">{{ erroDaDecisao() }}</ui-alert>
    }

    <section class="panel" aria-labelledby="cfg-protecao-titulo">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 #titulo id="cfg-protecao-titulo" tabindex="-1">Itens aguardando a sua decisão</h2>
          @if (carregando()) {
            <span class="cfg-list__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
      </div>

      @if (itens().length > 0) {
        <div class="table-responsive" role="region" tabindex="0" aria-label="Itens aguardando a decisão">
          <table>
            <caption class="sr-only">
              Itens do catálogo aguardando a decisão da proteção de dados. Use o nome para abrir o detalhe.
            </caption>
            <thead>
              <tr>
                <th scope="col">Cadastro</th>
                <th scope="col">Item</th>
                <th scope="col">Sensibilidade</th>
              </tr>
            </thead>
            <tbody>
              @for (item of itens(); track item.id) {
                <tr>
                  <td data-label="Cadastro" class="u-nowrap-desktop">{{ cadastro(item) }}</td>
                  <td data-label="Item" class="u-nowrap-desktop">
                    <button
                      type="button"
                      class="table-responsive__alvo"
                      [attr.aria-label]="'Ver o detalhe de ' + item.nome"
                      (click)="abrirDetalhe(item)"
                    >
                      {{ item.nome }}
                    </button>
                  </td>
                  <td data-label="Sensibilidade" class="u-nowrap-desktop">
                    {{ rotulo(classificacoes, item.classificacaoProtecao) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!carregando() && !erroDeCarga()) {
        <ui-empty-state
          heading="Nenhum item aguardando a sua decisão"
          description="Quando o administrador do catálogo enviar uma solicitação, os itens aparecem aqui."
        />
      }
    </section>

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="detalheAberto"
      [heading]="detalhe()?.nome ?? 'Item do catálogo'"
      ariaLabel="Detalhe do item aguardando a decisão"
      focoInicial="titulo"
      position="right"
    >
      @if (detalheAberto() && detalhe(); as item) {
        <div class="cfg-form" role="region" tabindex="0" aria-label="Dados do item">
          <cfg-detalhe-da-protecao titulo="Proposta de proteção" [protecao]="item" />
          <p class="u-caption">
            Código no sistema: <code>{{ item.codigo }}</code>
          </p>
        </div>
        <div class="cfg-form-footer">
          <button type="button" class="btn btn--tertiary btn--rect" [disabled]="decidindo()" (click)="detalheAberto.set(false)">
            Fechar
          </button>
          <ng-container *authTemPermissao="permissaoDeAprovar">
            <button type="button" class="btn btn--secondary" [disabled]="decidindo()" (click)="abrirNegativa(item)">
              Negar
            </button>
            <button type="button" class="btn btn--primary" [disabled]="decidindo()" (click)="aprovar(item)">
              Aprovar
            </button>
          </ng-container>
        </div>
      }
    </ui-drawer>

    <ui-dialog
      [(visible)]="negativaAberta"
      heading="Negar a proteção de dados do item"
      [dismissible]="!decidindo()"
    >
      @if (negativa(); as n) {
        @if (erroDaNegativa()) {
          <ui-alert variant="danger" heading="Não foi possível negar o item">{{ erroDaNegativa() }}</ui-alert>
        }
        <p id="cfg-negativa-item">
          {{ cadastro(n.item) }}: <strong>{{ n.item.nome }}</strong> (<code>{{ n.item.codigo }}</code>). A
          classificação declarada é {{ rotulo(classificacoes, n.item.classificacaoProtecao) }}.
        </p>
        <label class="field" [class.is-error]="tentouNegar() && recomendada.invalid">
          <span class="field__label is-required">Classificação recomendada</span>
          <select
            #campoDaRecomendacao
            class="select"
            [formControl]="recomendada"
            [attr.aria-invalid]="tentouNegar() && recomendada.invalid ? 'true' : null"
            [attr.aria-describedby]="tentouNegar() && recomendada.invalid ? 'cfg-negativa-ajuda cfg-negativa-erro' : 'cfg-negativa-ajuda'"
          >
            <option value="">Selecione…</option>
            @for (opcao of opcoesDaRecomendacao(); track opcao.valor) {
              <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
            }
          </select>
          <span class="field__hint" id="cfg-negativa-ajuda">
            O administrador vê a classificação recomendada e escolhe aceitá-la ou editar o item. Ela
            deve combinar com a hipótese legal declarada.
          </span>
          @if (opcoesDaRecomendacao().length === 0) {
            <span class="field__error">
              Nenhuma outra classificação combina com a hipótese legal declarada. Cancele e deixe o item
              com o administrador, que pode editar a hipótese.
            </span>
          }
          @if (tentouNegar() && recomendada.invalid) {
            <span class="field__error" id="cfg-negativa-erro">Indique a classificação recomendada.</span>
          }
        </label>
      }
      <ng-container uiDialogFooter>
        <button type="button" class="btn btn--tertiary btn--rect" [disabled]="decidindo()" (click)="negativaAberta.set(false)">
          Cancelar
        </button>
        <button type="button" class="btn btn--danger" [disabled]="decidindo()" (click)="negar()">
          @if (decidindo()) {
            <ui-spinner size="sm" />
          }
          Negar item
        </button>
      </ng-container>
    </ui-dialog>
  `,
  host: { class: 'cfg-page' },
})
export class ProtecaoDoCatalogoPage {
  private readonly api = inject(ProtecaoDoCatalogoApi);
  private readonly fatosApi = inject(FatosCandidatoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly permissaoDeAprovar = PERMISSAO.configuracao.protecaoDoCatalogoAprovar;
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly hipoteses = HIPOTESES_LEGAIS;
  protected readonly rotulo = rotuloDe;

  protected readonly itens = signal<readonly ItemDaProtecaoDoCatalogoDto[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erroDeCarga = signal<string | null>(null);
  protected readonly erroDaDecisao = signal<string | null>(null);
  protected readonly decidindo = signal(false);

  protected readonly detalheAberto = signal(false);
  private readonly detalheId = signal<string | null>(null);
  /** O item aberto no detalhe, lido da lista: a releitura depois de uma decisão o tira. */
  protected readonly detalhe = computed(() => {
    const id = this.detalheId();
    return id === null ? null : (this.itens().find((item) => item.id === id) ?? null);
  });

  protected readonly negativaAberta = signal(false);
  protected readonly negativa = signal<NegativaEmCurso | null>(null);
  protected readonly erroDaNegativa = signal<string | null>(null);
  protected readonly tentouNegar = signal(false);
  protected readonly recomendada = new FormControl('', { nonNullable: true });

  /** A chave acompanha a intenção da decisão: repetir a mesma (rede, 5xx) reusa a chave; outra decisão ganha chave nova. */
  private chaveDaDecisao = idempotencyKey.create();
  private intencaoDaDecisao: string | null = null;

  private readonly dominiosDosFatos = signal<ReadonlyMap<string, string>>(new Map());
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');
  private readonly campoDaRecomendacao = viewChild<ElementRef<HTMLSelectElement>>('campoDaRecomendacao');

  /**
   * Só a classificação que a API aceitaria: não a que o item já tem, só a que admite a hipótese legal
   * declarada (art. 7º ou art. 11 da LGPD) e, no fato, só a que o tipo de dado comporta (texto, data e
   * endereço nunca ficam abaixo de pessoal) — as mesmas regras do cadastro. Sem o tipo de dado conhecido,
   * a API confere.
   */
  protected readonly opcoesDaRecomendacao = computed(() => {
    const item = this.negativa()?.item;
    if (item === undefined) return [];
    const dominio = item.tipo === 'FATO' ? this.dominiosDosFatos().get(item.codigo) : undefined;
    const doDominio = dominio === undefined ? null : new Set(classificacoesDoDominio(dominio).map((opcao) => opcao.valor));
    return CLASSIFICACOES_DE_PROTECAO.filter(
      (opcao) =>
        opcao.valor !== item.classificacaoProtecao &&
        (doDominio === null || doDominio.has(opcao.valor)) &&
        hipotesesDaClassificacao(opcao.valor).some((hipotese) => hipotese.valor === item.hipoteseLegal),
    );
  });

  /** Cada leitura cancela a anterior: a resposta velha que chega depois não sobrescreve a nova. */
  private readonly leituras = new Subject<void>();

  constructor() {
    this.leituras
      .pipe(
        switchMap(() => {
          this.carregando.set(true);
          this.erroDeCarga.set(null);
          return this.api.listar('SOLICITADA');
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        this.carregando.set(false);
        if (resultado.ok) {
          this.itens.set(resultado.data);
          return;
        }
        this.itens.set([]);
        this.erroDeCarga.set(this.problemI18n.resolve(resultado.problem).title);
      });
    // O tipo de dado do fato não vem na lista; o catálogo público o informa para a regra do mínimo por domínio.
    this.fatosApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (resultado.ok) this.dominiosDosFatos.set(new Map(resultado.data.map((fato) => [fato.codigo, fato.dominio])));
      });
    this.carregar();
  }

  protected cadastro(item: ItemDaProtecaoDoCatalogoDto): string {
    return nomeDoCadastro(item.tipo);
  }

  protected abrirDetalhe(item: ItemDaProtecaoDoCatalogoDto): void {
    this.detalheId.set(item.id);
    this.detalheAberto.set(true);
  }

  protected carregar(): void {
    this.leituras.next();
  }

  protected aprovar(item: ItemDaProtecaoDoCatalogoDto): void {
    this.decidir(item, { ...this.comando(item), decisao: 'APROVADA' }, 'Item aprovado', null);
  }

  protected abrirNegativa(item: ItemDaProtecaoDoCatalogoDto): void {
    this.negativa.set({ item });
    this.erroDaNegativa.set(null);
    this.tentouNegar.set(false);
    this.recomendada.reset('');
    this.negativaAberta.set(true);
  }

  protected negar(): void {
    const negativa = this.negativa();
    if (negativa === null || this.decidindo()) return;
    this.tentouNegar.set(true);
    const recomendada = this.recomendada.value;
    if (recomendada === '') {
      this.recomendada.setErrors({ required: true });
      // O foco vai ao campo com o erro associado: sem isso, o leitor de tela não sabe por que nada aconteceu.
      afterNextRender(() => this.campoDaRecomendacao()?.nativeElement.focus(), { injector: this.injector });
      return;
    }
    this.decidir(
      negativa.item,
      { ...this.comando(negativa.item), decisao: 'NEGADA', classificacaoRecomendada: recomendada },
      'Item negado',
      (mensagem) => this.erroDaNegativa.set(mensagem),
    );
  }

  /** O comando leva a proteção que a tela mostrou, para a API recusar a decisão sobre uma proteção que já mudou. */
  private comando(item: ItemDaProtecaoDoCatalogoDto): DecidirProtecaoDoCatalogoCommand {
    return {
      cadastro: item.tipo,
      itemId: item.id,
      decisao: null,
      classificacaoProtecao: item.classificacaoProtecao,
      hipoteseLegal: item.hipoteseLegal,
      finalidadeTratamento: item.finalidadeTratamento,
    };
  }

  /**
   * Registra a decisão. No sucesso o item sai da lista e o foco vai ao título, porque o botão que o
   * tinha desaparece com a linha. Na recusa a mensagem da API fica junto de onde a decisão foi
   * tomada; quando a proteção mudou ou outra gravação venceu, a lista é relida, porque repetir a
   * mesma decisão não dá certo.
   */
  private decidir(
    item: ItemDaProtecaoDoCatalogoDto,
    comando: DecidirProtecaoDoCatalogoCommand,
    sucesso: string,
    naNegativa: ((mensagem: string) => void) | null,
  ): void {
    if (this.decidindo()) return;
    this.decidindo.set(true);
    this.erroDaDecisao.set(null);
    this.api
      .decidir(comando, withIdempotencyKey(this.chaveDaIntencao(comando)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.decidindo.set(false);
        if (resultado.ok) {
          this.intencaoDaDecisao = null;
          this.notifications.success(sucesso, item.codigo);
          this.negativaAberta.set(false);
          this.detalheAberto.set(false);
          this.carregar();
          afterNextRender(() => this.titulo()?.nativeElement.focus(), { injector: this.injector });
          return;
        }
        if (deveRotacionarIdempotencyKey(resultado.problem)) this.intencaoDaDecisao = null;
        this.recusar(resultado.problem, naNegativa);
      });
  }

  private chaveDaIntencao(comando: DecidirProtecaoDoCatalogoCommand): string {
    const intencao = JSON.stringify(comando);
    if (intencao !== this.intencaoDaDecisao) {
      this.chaveDaDecisao = idempotencyKey.create();
      this.intencaoDaDecisao = intencao;
    }
    return this.chaveDaDecisao;
  }

  private recusar(problem: ProblemDetails, naNegativa: ((mensagem: string) => void) | null): void {
    const mensagem = this.problemI18n.resolve(problem).title;
    if (problem.status === 409 || problem.status === 422) {
      // A situação do item não é a que a tela mostrava (proteção editada, decisão de outra pessoa, item fora da solicitação): a lista relida traz a atual ou tira o item. Repetir a mesma decisão não dá certo.
      if (problem.status === 422 && problem.code !== ITEM_FORA_DE_SOLICITACAO) return this.mostrarRecusa(mensagem, problem, naNegativa);
      this.negativaAberta.set(false);
      this.detalheAberto.set(false);
      this.erroDaDecisao.set(`${mensagem}. A lista foi atualizada; confira o item e decida de novo.`);
      this.carregar();
      return;
    }
    this.mostrarRecusa(mensagem, problem, naNegativa);
  }

  private mostrarRecusa(mensagem: string, problem: ProblemDetails, naNegativa: ((mensagem: string) => void) | null): void {
    if (naNegativa === null) {
      this.erroDaDecisao.set(mensagem);
    } else {
      naNegativa(mensagem);
    }
    if (problem.status >= 500) this.notifications.errorFromProblem(problem, { title: mensagem });
  }
}
