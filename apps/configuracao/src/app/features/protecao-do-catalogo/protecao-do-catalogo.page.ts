import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, map, switchMap } from 'rxjs';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { deveRotacionarIdempotencyKey, idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ProtecaoDoCatalogoApi,
  type CadastroDoCatalogo,
  type DecidirProtecaoDoCatalogoRequest,
  type DecisaoDaProtecao,
  type DetalheDaProtecaoDoCatalogoDto,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  SegmentedComponent,
  SpinnerComponent,
  type UiSegmentedOption,
} from '@uniplus/shared-ui/components';
import { CatalogoCategoriasDocumento } from '../../shared/categorias-documento';
import { DetalheDaProtecaoComponent, LeituraDoDetalhe } from '../../shared/detalhe-do-catalogo';
import {
  CLASSIFICACOES_DE_PROTECAO,
  SituacaoDaAprovacaoComponent,
  hipotesesDaClassificacao,
  nomeDoCadastro,
  rotuloDe,
} from '../../shared/protecao-do-catalogo';
import { DecisoesDaProtecaoComponent } from './decisoes-da-protecao.component';
import {
  CARDINALIDADES,
  COMPONENTES_DE_EXIBICAO,
  DOMINIOS,
  ROTULO_DO_COMPONENTE_PADRAO,
  classificacoesDoDominio,
} from '../fatos-candidato/fato-candidato.regras';

/** Código da API para o item que já saiu da solicitação (decidido por outra pessoa ou editado). */
const ITEM_FORA_DE_SOLICITACAO = 'uniplus.configuracao.protecao_do_catalogo.item_fora_de_solicitacao';

type Aba = 'aguardando' | 'decisoes';

const ABAS: readonly UiSegmentedOption<Aba>[] = [
  { value: 'aguardando', label: 'Aguardando decisão' },
  { value: 'decisoes', label: 'Decisões' },
];

/** O tamanho máximo da justificativa que a API aceita. */
const JUSTIFICATIVA_MAXIMA = 2000;

/** A justificativa em branco conta como ausente: a API apara o texto antes de conferir. */
function justificativaPreenchida(controle: AbstractControl<string>): ValidationErrors | null {
  return controle.value.trim().length > 0 ? null : { required: true };
}

/**
 * A aprovação da proteção de dados do catálogo: lista o que o administrador enviou na solicitação e
 * abre cada item num drawer com o que ele é, para a proteção de dados aprovar, recomendar ajuste ou
 * reprovar. A decisão vale sobre a proteção que a tela mostrou: se o item foi editado depois, a API
 * recusa e a lista é relida.
 */
@Component({
  selector: 'cfg-protecao-do-catalogo-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TemPermissaoDirective,
    AlertComponent,
    DecisoesDaProtecaoComponent,
    DetalheDaProtecaoComponent,
    DialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    SegmentedComponent,
    SituacaoDaAprovacaoComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Proteção de Dados do Catálogo</h1>
        <p class="page-header__desc">
          {{
            aba() === 'decisoes'
              ? 'As decisões já registradas sobre a proteção de dados dos tipos de documento e dos fatos do catálogo.'
              : 'Os tipos de documento e os fatos do catálogo que aguardam a sua decisão sobre a proteção de dados.'
          }}
        </p>
      </div>
    </div>

    <ui-segmented
      class="cfg-abas"
      accessibleName="Mostrar"
      [choices]="abas"
      [selectedValue]="aba()"
      (selectedValueChange)="trocarAba($event)"
    />

    @if (aba() === 'decisoes') {
      <cfg-decisoes-da-protecao />
    } @else {

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
                  <td data-label="Cadastro" class="u-nowrap-desktop">{{ cadastro(item.tipo) }}</td>
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
      [heading]="itemAberto()?.nome ?? 'Item do catálogo'"
      ariaLabel="Detalhe do item aguardando a decisão"
      focoInicial="titulo"
      position="right"
    >
      @if (detalheAberto()) {
        <div class="cfg-form" role="region" tabindex="0" aria-label="Dados do item" [attr.aria-busy]="carregandoDetalhe()">
          @if (carregandoDetalhe()) {
            <span class="cfg-list__loading"><ui-spinner size="sm" /> Carregando o item</span>
          }
          @if (erroDaDecisaoNoDrawer()) {
            <ui-alert variant="danger" heading="A decisão não foi registrada">{{ erroDaDecisaoNoDrawer() }}</ui-alert>
          }
          @if (erroDoDetalhe(); as erro) {
            <ui-alert variant="danger" [heading]="naoEncontrado() ? 'Item não encontrado' : 'Não foi possível carregar o item'">
              {{ erro }}
              @if (!naoEncontrado()) {
                <div class="cfg-list__retry">
                  <button type="button" class="btn btn--secondary btn--sm" (click)="recarregarDetalhe()">Tentar novamente</button>
                </div>
              }
            </ui-alert>
          }
          @if (detalhe(); as d) {
            <cfg-situacao-da-aprovacao
              [situacao]="d.aprovacao.situacao"
              [classificacaoRecomendada]="d.aprovacao.classificacaoRecomendada"
              [justificativa]="d.aprovacao.justificativa"
            />
            <cfg-detalhe-da-protecao titulo="Proposta de proteção" [protecao]="d" />
            <section class="cfg-detalhe-secao">
              <h3 class="cfg-detalhe-secao__titulo">O que é o item</h3>
              <dl class="cfg-detalhe">
                <div>
                  <dt>Cadastro</dt>
                  <dd>{{ cadastro(d.tipo) }}</dd>
                </div>
                <div>
                  <dt>Descrição</dt>
                  <dd>{{ d.descricao || '—' }}</dd>
                </div>
                @if (d.fato; as fato) {
                  <div>
                    <dt>Tipo do dado</dt>
                    <dd>{{ rotulo(dominios, fato.dominio) }}</dd>
                  </div>
                  <div>
                    <dt>Cardinalidade</dt>
                    <dd>{{ rotulo(cardinalidades, fato.cardinalidade) }}</dd>
                  </div>
                  <div>
                    <dt>Componente de exibição</dt>
                    <dd>{{ fato.componenteExibicao ? rotulo(componentes, fato.componenteExibicao) : rotuloDoPadrao }}</dd>
                  </div>
                }
                @if (d.tipoDocumento; as documento) {
                  <div>
                    <dt>Categoria</dt>
                    <dd>{{ categoriaDe(documento.categoria) }}</dd>
                  </div>
                  <div>
                    <dt>Formatos aceitos</dt>
                    <dd>{{ documento.formatosAceitos || '—' }}</dd>
                  </div>
                  <div>
                    <dt>Tamanho máximo</dt>
                    <dd>{{ documento.tamanhoMaximoMb ? documento.tamanhoMaximoMb + ' MB' : '—' }}</dd>
                  </div>
                }
              </dl>
            </section>
            @if (d.fato?.valores?.length) {
              <section class="cfg-detalhe-secao">
                <h3 class="cfg-detalhe-secao__titulo">Valores possíveis</h3>
                <ul class="cfg-detalhe-valores">
                  @for (valor of d.fato?.valores; track valor.codigo) {
                    <li>
                      <div>{{ valor.descricao || valor.codigo }}</div>
                      @if (valor.orientacao) {
                        <p class="cfg-detalhe-valores__orientacao">{{ valor.orientacao }}</p>
                      }
                    </li>
                  }
                </ul>
              </section>
            }
            <p class="u-caption">
              Código no sistema: <code>{{ d.codigo }}</code>
            </p>
          }
        </div>
        <div class="cfg-form-footer">
          <button type="button" class="btn btn--tertiary btn--rect" [disabled]="decidindo()" (click)="detalheAberto.set(false)">
            Fechar
          </button>
          @if (detalhe(); as d) {
            <ng-container *authTemPermissao="permissaoDeAprovar">
              @if (d.aprovacao.situacao === 'SOLICITADA') {
                <button type="button" class="btn btn--danger" [disabled]="decidindo()" (click)="abrirDecisao('REPROVAR')">
                  Reprovar
                </button>
                <button type="button" class="btn btn--secondary" [disabled]="decidindo()" (click)="abrirDecisao('RECOMENDAR_AJUSTE')">
                  Recomendar ajuste
                </button>
                <button type="button" class="btn btn--primary" [disabled]="decidindo()" (click)="aprovar()">
                  @if (decidindo() && decisaoEmCurso() === 'APROVAR') {
                    <ui-spinner size="sm" />
                  }
                  Aprovar
                </button>
              }
            </ng-container>
          }
        </div>
      }
    </ui-drawer>

    <ui-dialog
      [(visible)]="decisaoAberta"
      [heading]="decisaoEmCurso() === 'REPROVAR' ? 'Reprovar a proteção de dados do item' : 'Recomendar ajuste da proteção de dados'"
      [dismissible]="!decidindo()"
    >
      @if (detalhe(); as d) {
        @if (erroDaDecisaoNoDialogo()) {
          <ui-alert variant="danger" heading="A decisão não foi registrada">{{ erroDaDecisaoNoDialogo() }}</ui-alert>
        }
        <p>
          {{ cadastro(d.tipo) }}: <strong>{{ d.nome }}</strong>. A classificação proposta é
          {{ rotulo(classificacoes, d.classificacaoProtecao) }}.
        </p>
        @if (decisaoEmCurso() === 'RECOMENDAR_AJUSTE') {
          <label class="field" [class.is-error]="tentouDecidir() && recomendada.invalid">
            <span class="field__label is-required">Classificação recomendada</span>
            <select
              #campoDaRecomendacao
              class="select"
              [formControl]="recomendada"
              [attr.aria-invalid]="tentouDecidir() && recomendada.invalid ? 'true' : null"
              [attr.aria-describedby]="tentouDecidir() && recomendada.invalid ? 'cfg-ajuste-ajuda cfg-ajuste-erro' : 'cfg-ajuste-ajuda'"
            >
              <option value="">Selecione…</option>
              @for (opcao of opcoesDaRecomendacao(); track opcao.valor) {
                <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
              }
            </select>
            <span class="field__hint" id="cfg-ajuste-ajuda">
              O administrador vê a classificação recomendada e escolhe aceitá-la ou editar o item. Ela
              deve combinar com a hipótese legal declarada.
            </span>
            @if (opcoesDaRecomendacao().length === 0) {
              <span class="field__error">
                Nenhuma outra classificação combina com a hipótese legal declarada. Cancele e reprove o item
                ou deixe-o com o administrador, que pode editar a hipótese.
              </span>
            }
            @if (tentouDecidir() && recomendada.invalid) {
              <span class="field__error" id="cfg-ajuste-erro">Indique a classificação recomendada.</span>
            }
          </label>
        }
        <label class="field" [class.is-error]="erroDaJustificativa()">
          <span class="field__label" [class.is-required]="decisaoEmCurso() === 'REPROVAR'">Justificativa</span>
          <textarea
            #campoDaJustificativa
            class="textarea"
            rows="4"
            [maxlength]="justificativaMaxima"
            [formControl]="justificativa"
            [attr.aria-required]="decisaoEmCurso() === 'REPROVAR' ? 'true' : null"
            [attr.aria-invalid]="erroDaJustificativa() ? 'true' : null"
            [attr.aria-describedby]="
              erroDaJustificativa()
                ? 'cfg-justificativa-ajuda cfg-justificativa-contador cfg-justificativa-erro'
                : 'cfg-justificativa-ajuda cfg-justificativa-contador'
            "
          ></textarea>
          <span class="field__hint" id="cfg-justificativa-ajuda">
            {{
              decisaoEmCurso() === 'REPROVAR'
                ? 'Obrigatória. Explique o motivo da reprovação; o administrador a lê ao editar o item.'
                : 'Opcional. Explique ao administrador por que a classificação deve mudar.'
            }}
          </span>
          <span class="field__hint" id="cfg-justificativa-contador">{{ tamanhoDaJustificativa() }} de 2.000</span>
          @if (erroDaJustificativa(); as erro) {
            <span class="field__error" id="cfg-justificativa-erro">{{ erro }}</span>
          }
        </label>
      }
      <ng-container uiDialogFooter>
        <button type="button" class="btn btn--tertiary btn--rect" [disabled]="decidindo()" (click)="decisaoAberta.set(false)">
          Cancelar
        </button>
        <button
          type="button"
          class="btn"
          [class.btn--danger]="decisaoEmCurso() === 'REPROVAR'"
          [class.btn--primary]="decisaoEmCurso() !== 'REPROVAR'"
          [disabled]="decidindo()"
          (click)="confirmarDecisao()"
        >
          @if (decidindo()) {
            <ui-spinner size="sm" />
          }
          {{ decisaoEmCurso() === 'REPROVAR' ? 'Reprovar item' : 'Recomendar ajuste' }}
        </button>
      </ng-container>
    </ui-dialog>
    }
  `,
  host: { class: 'cfg-page' },
})
export class ProtecaoDoCatalogoPage {
  private readonly api = inject(ProtecaoDoCatalogoApi);
  private readonly categorias = inject(CatalogoCategoriasDocumento);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly abas = ABAS;
  /** A aba ativa fica na query string: o link e o botão de voltar levam à mesma aba. */
  protected readonly aba = toSignal(
    this.route.queryParamMap.pipe(map((params): Aba => (params.get('aba') === 'decisoes' ? 'decisoes' : 'aguardando'))),
    { initialValue: this.route.snapshot.queryParamMap.get('aba') === 'decisoes' ? 'decisoes' : 'aguardando' },
  );

  protected readonly permissaoDeAprovar = PERMISSAO.configuracao.protecaoDoCatalogoAprovar;
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly dominios = DOMINIOS;
  protected readonly cardinalidades = CARDINALIDADES;
  protected readonly componentes = COMPONENTES_DE_EXIBICAO;
  protected readonly rotuloDoPadrao = ROTULO_DO_COMPONENTE_PADRAO;
  protected readonly rotulo = rotuloDe;
  protected readonly justificativaMaxima = JUSTIFICATIVA_MAXIMA;

  protected readonly itens = signal<readonly ItemDaProtecaoDoCatalogoDto[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erroDeCarga = signal<string | null>(null);
  protected readonly erroDaDecisao = signal<string | null>(null);
  protected readonly decidindo = signal(false);

  protected readonly detalheAberto = signal(false);
  private readonly itemAbertoId = signal<string | null>(null);
  /** O item da lista que o drawer abriu: dá o título enquanto o detalhe carrega. */
  protected readonly itemAberto = computed(() => {
    const id = this.itemAbertoId();
    return id === null ? null : (this.itens().find((item) => item.id === id) ?? null);
  });
  private readonly leituraDoDetalhe = new LeituraDoDetalhe(this.api, this.problemI18n, this.destroyRef);
  protected readonly detalhe = this.leituraDoDetalhe.detalhe;
  protected readonly carregandoDetalhe = this.leituraDoDetalhe.carregando;
  protected readonly erroDoDetalhe = this.leituraDoDetalhe.erro;
  protected readonly naoEncontrado = this.leituraDoDetalhe.naoEncontrado;

  protected readonly decisaoAberta = signal(false);
  protected readonly decisaoEmCurso = signal<DecisaoDaProtecao>('APROVAR');
  protected readonly erroDaDecisaoNoDialogo = signal<string | null>(null);
  protected readonly erroDaDecisaoNoDrawer = signal<string | null>(null);
  protected readonly tentouDecidir = signal(false);
  protected readonly recomendada = new FormControl('', { nonNullable: true });
  protected readonly justificativa = new FormControl('', { nonNullable: true });
  protected readonly tamanhoDaJustificativa = toSignal(
    this.justificativa.valueChanges.pipe(map((texto) => texto.length)),
    { initialValue: 0 },
  );

  /** A chave acompanha a intenção da decisão: repetir a mesma (rede, 5xx) reusa a chave; outra decisão ganha chave nova. */
  private chaveDaDecisao = idempotencyKey.create();
  private intencaoDaDecisao: string | null = null;

  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');
  private readonly campoDaRecomendacao = viewChild<ElementRef<HTMLSelectElement>>('campoDaRecomendacao');
  private readonly campoDaJustificativa = viewChild<ElementRef<HTMLTextAreaElement>>('campoDaJustificativa');

  /**
   * Só a classificação que a API aceitaria: não a que o item já tem, só a que admite a hipótese legal
   * declarada (art. 7º ou art. 11 da LGPD) e, no fato, só a que o tipo de dado comporta (texto, data e
   * endereço nunca ficam abaixo de pessoal) — as mesmas regras do cadastro.
   */
  protected readonly opcoesDaRecomendacao = computed(() => {
    const item = this.detalhe();
    if (item === null) return [];
    const doDominio = item.fato === null ? null : new Set(classificacoesDoDominio(item.fato.dominio).map((opcao) => opcao.valor));
    return CLASSIFICACOES_DE_PROTECAO.filter(
      (opcao) =>
        opcao.valor !== item.classificacaoProtecao &&
        (doDominio === null || doDominio.has(opcao.valor)) &&
        hipotesesDaClassificacao(opcao.valor).some((hipotese) => hipotese.valor === item.hipoteseLegal),
    );
  });

  /** O erro da justificativa só aparece depois da tentativa de decidir ou quando passa do limite digitado. */
  protected readonly erroDaJustificativa = computed<string | null>(() => {
    const tamanho = this.tamanhoDaJustificativa();
    if (tamanho > JUSTIFICATIVA_MAXIMA) return 'A justificativa aceita até 2.000 caracteres.';
    if (this.tentouDecidir() && this.decisaoEmCurso() === 'REPROVAR' && this.justificativa.invalid) {
      return 'Informe a justificativa da reprovação.';
    }
    return null;
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
    // A lista só é lida com a aba aberta, e relida ao voltar a ela: a decisão pode ter saído pelo drawer da outra aba.
    effect(() => {
      if (this.aba() === 'aguardando') untracked(() => this.carregar());
    });
  }

  /** Cada aba abre no seu estado inicial: trocar de aba tira da URL os filtros da outra. */
  protected trocarAba(aba: Aba | null): void {
    if (aba === null || aba === this.aba()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aba: aba === 'decisoes' ? 'decisoes' : null, ato: null, cadastro: null, de: null, ate: null, busca: null, minhas: null },
      queryParamsHandling: 'merge',
    });
  }

  protected cadastro(tipo: string): string {
    return nomeDoCadastro(tipo);
  }

  protected categoriaDe(codigo: string): string {
    return this.categorias.porCodigo().get(codigo)?.nome ?? codigo;
  }

  protected carregar(): void {
    this.leituras.next();
  }

  protected abrirDetalhe(item: ItemDaProtecaoDoCatalogoDto): void {
    this.itemAbertoId.set(item.id);
    this.erroDaDecisaoNoDrawer.set(null);
    if (item.tipo === 'TIPO_DOCUMENTO') this.categorias.garantirCarregado();
    this.detalheAberto.set(true);
    this.leituraDoDetalhe.ler(item.tipo as CadastroDoCatalogo, item.id);
  }

  protected recarregarDetalhe(): void {
    this.leituraDoDetalhe.recarregar();
  }

  protected aprovar(): void {
    const item = this.detalhe();
    if (item === null) return;
    this.decisaoEmCurso.set('APROVAR');
    this.decidir(item, { ...this.comando(item), decisao: 'APROVAR' }, 'Item aprovado', (mensagem) =>
      this.erroDaDecisaoNoDrawer.set(mensagem),
    );
  }

  protected abrirDecisao(decisao: Exclude<DecisaoDaProtecao, 'APROVAR'>): void {
    this.decisaoEmCurso.set(decisao);
    this.erroDaDecisaoNoDialogo.set(null);
    this.tentouDecidir.set(false);
    this.recomendada.reset('');
    this.justificativa.reset('');
    this.justificativa.setValidators(decisao === 'REPROVAR' ? [justificativaPreenchida] : []);
    this.justificativa.updateValueAndValidity();
    this.decisaoAberta.set(true);
  }

  protected confirmarDecisao(): void {
    const item = this.detalhe();
    if (item === null || this.decidindo()) return;
    this.tentouDecidir.set(true);
    const decisao = this.decisaoEmCurso();
    const justificativa = this.justificativa.value.trim();
    if (justificativa.length > JUSTIFICATIVA_MAXIMA) {
      this.focarDepois(this.campoDaJustificativa);
      return;
    }
    if (decisao === 'RECOMENDAR_AJUSTE' && this.recomendada.value === '') {
      this.recomendada.setErrors({ required: true });
      // O foco vai ao campo com o erro associado: sem isso, o leitor de tela não sabe por que nada aconteceu.
      this.focarDepois(this.campoDaRecomendacao);
      return;
    }
    if (decisao === 'REPROVAR' && justificativa.length === 0) {
      this.focarDepois(this.campoDaJustificativa);
      return;
    }
    const comando: DecidirProtecaoDoCatalogoRequest =
      decisao === 'REPROVAR'
        ? { ...this.comando(item), decisao, justificativa }
        : {
            ...this.comando(item),
            decisao,
            classificacaoRecomendada: this.recomendada.value,
            justificativa: justificativa.length > 0 ? justificativa : null,
          };
    this.decidir(item, comando, decisao === 'REPROVAR' ? 'Item reprovado' : 'Ajuste recomendado', (mensagem) =>
      this.erroDaDecisaoNoDialogo.set(mensagem),
    );
  }

  private focarDepois(campo: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => campo()?.nativeElement.focus(), { injector: this.injector });
  }

  /** O comando leva a proteção que a tela mostrou, para a API recusar a decisão sobre uma proteção que já mudou. */
  private comando(item: DetalheDaProtecaoDoCatalogoDto): DecidirProtecaoDoCatalogoRequest {
    return {
      cadastro: item.tipo as CadastroDoCatalogo,
      itemId: item.id,
      decisao: 'APROVAR',
      classificacaoProtecao: item.classificacaoProtecao,
      hipoteseLegal: item.hipoteseLegal,
      finalidadeTratamento: item.finalidadeTratamento,
    };
  }

  /**
   * Registra a decisão. No sucesso o item sai da lista, o drawer fecha e o foco vai ao título, porque o
   * botão que o tinha desaparece com a linha. Na recusa a mensagem da API fica junto de onde a decisão
   * foi tomada; quando a proteção mudou ou outra gravação venceu, a lista é relida, porque repetir a
   * mesma decisão não dá certo.
   */
  private decidir(
    item: DetalheDaProtecaoDoCatalogoDto,
    comando: DecidirProtecaoDoCatalogoRequest,
    sucesso: string,
    aoRecusar: (mensagem: string) => void,
  ): void {
    if (this.decidindo()) return;
    this.decidindo.set(true);
    this.erroDaDecisao.set(null);
    this.erroDaDecisaoNoDrawer.set(null);
    this.erroDaDecisaoNoDialogo.set(null);
    this.api
      .decidir(comando, withIdempotencyKey(this.chaveDaIntencao(comando)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.decidindo.set(false);
        if (resultado.ok) {
          this.intencaoDaDecisao = null;
          this.notifications.success(sucesso, item.nome);
          this.decisaoAberta.set(false);
          this.detalheAberto.set(false);
          this.carregar();
          afterNextRender(() => this.titulo()?.nativeElement.focus(), { injector: this.injector });
          return;
        }
        if (deveRotacionarIdempotencyKey(resultado.problem)) this.intencaoDaDecisao = null;
        this.recusar(resultado.problem, aoRecusar);
      });
  }

  private chaveDaIntencao(comando: DecidirProtecaoDoCatalogoRequest): string {
    const intencao = JSON.stringify(comando);
    if (intencao !== this.intencaoDaDecisao) {
      this.chaveDaDecisao = idempotencyKey.create();
      this.intencaoDaDecisao = intencao;
    }
    return this.chaveDaDecisao;
  }

  private recusar(problem: ProblemDetails, aoRecusar: (mensagem: string) => void): void {
    const mensagem = this.problemI18n.resolve(problem).title;
    if (problem.status === 409 || problem.status === 422) {
      // A situação do item não é a que a tela mostrava (proteção editada, decisão de outra pessoa, item fora da solicitação): a lista relida traz a atual ou tira o item. Repetir a mesma decisão não dá certo.
      if (problem.status === 422 && problem.code !== ITEM_FORA_DE_SOLICITACAO) return this.mostrarRecusa(mensagem, problem, aoRecusar);
      this.decisaoAberta.set(false);
      this.detalheAberto.set(false);
      this.erroDaDecisao.set(`${mensagem}. A lista foi atualizada; confira o item e decida de novo.`);
      this.carregar();
      return;
    }
    this.mostrarRecusa(mensagem, problem, aoRecusar);
  }

  private mostrarRecusa(mensagem: string, problem: ProblemDetails, aoRecusar: (mensagem: string) => void): void {
    aoRecusar(mensagem);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem, { title: mensagem });
  }
}
