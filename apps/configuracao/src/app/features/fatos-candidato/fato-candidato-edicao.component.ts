import { ChangeDetectionStrategy, Component, DestroyRef, Injector, afterNextRender, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  FatoCandidatoDto,
  FatoCandidatoView,
  FatosCandidatoApi,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  EditorDeCondicoesComponent,
  RecolhivelComponent,
  SpinnerComponent,
  TagComponent,
  deClausulasDoWire,
  fatosEscolhiveis,
  paraClausulasDoWire,
  problemaDaCondicao,
  type CondicaoEmClausula,
} from '@uniplus/shared-ui/components';
import {
  CARDINALIDADES,
  CLASSIFICACOES_DE_PROTECAO,
  DOMINIOS,
  ESCOPOS,
  FONTES_DE_VALORES,
  FORMATOS_DE_TEXTO,
  HIPOTESES_LEGAIS,
  ORIGENS,
  campoDaRecusa,
  fatosCitaveisPelaRegra,
  indiceDaRegra,
  podeTerRegras,
  podeTerValores,
  rotuloDe,
} from './fato-candidato.regras';

type AcaoComChave = 'descritivo' | 'valor' | 'regras' | 'reativacao' | 'correcao' | 'ordem';

/** Uma regra padrão em edição: o valor que contribui (nulo no booleano) e o predicado na forma do editor. */
interface RegraEmEdicao {
  readonly contribui: string | null;
  readonly condicoes: readonly CondicaoEmClausula[];
}

/** Os `code` que a API emite quando a escrita perde para outra: o global e o do fato do catálogo. */
const CODIGOS_DE_CONCORRENCIA: readonly string[] = [
  'uniplus.concorrencia.conflito',
  'uniplus.configuracao.fato_candidato.conflito_de_concorrencia',
];

/**
 * A edição de um fato do catálogo: nome e descrição sempre; os valores de domínio e as regras
 * padrão quando o fato os tem (o derivado categórico precisa dos valores antes das regras, porque
 * a regra contribui um deles). O fato de sistema mostra tudo, mas só deixa mudar nome e descrição.
 *
 * Cada ação tem a própria Idempotency-Key: a API identifica a escrita por método, caminho e chave,
 * e reaproveitar a chave entre duas intenções devolveria a resposta guardada da primeira.
 */
@Component({
  selector: 'cfg-fato-candidato-edicao',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, EditorDeCondicoesComponent, RecolhivelComponent, SpinnerComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // O corpo do drawer não rola: o host ocupa a altura dele e o .cfg-form de dentro é o único
  // container de rolagem, com o recuo do conteúdo.
  styles: [
    ':host { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; }',
    // No drawer a lista da definição não tem o recuo do card; as colunas se ajustam ao rótulo mais longo.
    '.cfg-fato-definicao { padding: 0; grid-template-columns: minmax(8rem, max-content) 1fr; }',
    '.cfg-fato-definicao dd { overflow-wrap: anywhere; }',
    '.cfg-fato-descritivo { display: grid; gap: var(--space-4); }',
    // Cada valor tem até cinco ações: em 320 px e com zoom de 200% elas quebram linha em vez de vazar.
    '.table-responsive__actions { flex-wrap: wrap; }',
  ],
  template: `
    <div class="cfg-form">
    @if (fato(); as f) {
      @if (f.sistema) {
        <ui-alert variant="info" heading="Fato de sistema">
          Este fato é resolvido pelo próprio sistema. Só o nome e a descrição podem ser alterados.
        </ui-alert>
      }

      <form class="cfg-fato-descritivo" [formGroup]="descritivo" id="cfg-fato-descritivo" (ngSubmit)="salvarDescritivo()" novalidate>
        <label class="field" [class.is-error]="erroDescritivo('nome')">
          <span class="field__label is-required">Nome</span>
          <input class="input" type="text" formControlName="nome" [readonly]="somenteLeitura()" [attr.aria-invalid]="erroDescritivo('nome') ? 'true' : null" [attr.aria-describedby]="erroDescritivo('nome') ? 'cfg-fato-ed-nome-erro' : null" />
          @if (erroDescritivo('nome')) {
            <span class="field__error" id="cfg-fato-ed-nome-erro">{{ erroDescritivo('nome') }}</span>
          }
        </label>
        <label class="field" [class.is-error]="erroDescritivo('descricao')">
          <span class="field__label">Descrição</span>
          <textarea class="textarea" rows="3" formControlName="descricao" [readonly]="somenteLeitura()" [attr.aria-invalid]="erroDescritivo('descricao') ? 'true' : null" [attr.aria-describedby]="erroDescritivo('descricao') ? 'cfg-fato-ed-descricao-erro' : null"></textarea>
          @if (erroDescritivo('descricao')) {
            <span class="field__error" id="cfg-fato-ed-descricao-erro">{{ erroDescritivo('descricao') }}</span>
          }
        </label>
        @if (!somenteLeitura()) {
          <div class="cfg-form-actions">
            <button type="submit" class="btn btn--primary btn--sm" [disabled]="ocupado()">Salvar nome e descrição</button>
          </div>
        }
      </form>

      <ui-recolhivel titulo="Definição" [aberto]="somenteLeitura()">
        <dl class="cfg-detail-list cfg-fato-definicao">
          <dt>Código</dt>
          <dd><code>{{ f.codigo }}</code></dd>
          <dt>Origem</dt>
          <dd>{{ rotulo(origens, f.origem) }}</dd>
          <dt>Tipo de dado</dt>
          <dd>{{ rotulo(dominios, f.dominio) }} ({{ rotulo(cardinalidades, f.cardinalidade) }})</dd>
          @if (f.fonteValores) {
            <dt>Fonte dos valores</dt>
            <dd>{{ rotulo(fontes, f.fonteValores) }}</dd>
          }
          @if (f.formato) {
            <dt>Formato</dt>
            <dd>{{ rotulo(formatos, f.formato) }}</dd>
          }
          <dt>Escopo</dt>
          <dd>{{ rotulo(escopos, f.escopo) }}</dd>
          <dt>Conhecido a partir da fase</dt>
          <dd><code>{{ f.pontoResolucao }}</code></dd>
          <dt>Proteção de dados</dt>
          <dd>{{ rotulo(classificacoes, f.classificacaoProtecao) }}</dd>
          <dt>Base legal</dt>
          <dd>{{ rotulo(hipoteses, f.hipoteseLegal) }}</dd>
          <dt>Finalidade do tratamento</dt>
          <dd>{{ f.finalidadeTratamento }}</dd>
        </dl>
      </ui-recolhivel>

      @if (temValores() || f.valores.length > 0) {
        <ui-recolhivel titulo="Valores" [aberto]="somenteLeitura()">
          @if (f.valores.length > 0) {
            <div class="table-responsive">
              <table>
                <caption class="sr-only">Valores do fato, com a situação de cada um</caption>
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Situação</th>
                    <th scope="col"><span class="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (valor of f.valores; track valor.codigo) {
                    <tr>
                      <td data-label="Código"><code>{{ valor.codigo }}</code></td>
                      <td data-label="Descrição">
                        @if (editando() === valor.codigo) {
                          <form class="cfg-fato-valor-edicao" [formGroup]="edicaoDoValor" [id]="idDoValor(valor.codigo, 'form')" (ngSubmit)="salvarEdicaoDoValor(valor.codigo)" novalidate>
                            <label class="field" [class.is-error]="erroEdicao('descricao')">
                              <span class="field__label" [class.is-required]="f.origem === 'DECLARADO'">Descrição<span class="sr-only"> do valor {{ valor.codigo }}</span></span>
                              <input class="input" type="text" formControlName="descricao" [id]="idDoValor(valor.codigo, 'descricao')" [attr.aria-invalid]="erroEdicao('descricao') ? 'true' : null" [attr.aria-describedby]="erroEdicao('descricao') ? idDoValor(valor.codigo, 'aviso') + ' ' + idDoValor(valor.codigo, 'descricao-erro') : idDoValor(valor.codigo, 'aviso')" />
                              @if (erroEdicao('descricao')) {
                                <span class="field__error" [id]="idDoValor(valor.codigo, 'descricao-erro')">{{ erroEdicao('descricao') }}</span>
                              }
                            </label>
                            <label class="field" [class.is-error]="erroEdicao('orientacao')">
                              <span class="field__label">Orientação ao candidato<span class="sr-only"> do valor {{ valor.codigo }}</span></span>
                              <textarea class="textarea" rows="2" formControlName="orientacao" [attr.aria-invalid]="erroEdicao('orientacao') ? 'true' : null" [attr.aria-describedby]="erroEdicao('orientacao') ? idDoValor(valor.codigo, 'orientacao-erro') : null"></textarea>
                              @if (erroEdicao('orientacao')) {
                                <span class="field__error" [id]="idDoValor(valor.codigo, 'orientacao-erro')">{{ erroEdicao('orientacao') }}</span>
                              }
                            </label>
                            <p class="field__hint" [id]="idDoValor(valor.codigo, 'aviso')">
                              A descrição é texto de catálogo: corrija a redação, não o sentido da opção. Para mudar o sentido, desative este valor e acrescente um valor novo.
                              A correção vale para os rascunhos e para a próxima retificação dos processos publicados.
                            </p>
                          </form>
                        } @else {
                          {{ valor.descricao || '—' }}
                          @if (valor.orientacao) {
                            <p class="cfg-muted">{{ valor.orientacao }}</p>
                          }
                        }
                      </td>
                      <td data-label="Situação">
                        <ui-tag [variant]="valor.ativo ? 'success' : 'neutral'">{{ valor.ativo ? 'Ativo' : 'Desativado' }}</ui-tag>
                      </td>
                      <td class="table-responsive__actions" data-label="Ações">
                        @if (temValores() && !somenteLeitura()) {
                          @if (editando() === valor.codigo) {
                            <button type="submit" class="btn btn--primary btn--sm" [attr.form]="idDoValor(valor.codigo, 'form')" [disabled]="bloqueado()">
                              Salvar<span class="sr-only"> a correção do valor {{ valor.codigo }}</span>
                            </button>
                            <button type="button" class="btn btn--tertiary btn--sm" [disabled]="ocupado()" (click)="cancelarEdicaoDoValor(valor.codigo)">
                              Cancelar<span class="sr-only"> a correção do valor {{ valor.codigo }}</span>
                            </button>
                          } @else {
                            <button type="button" class="btn btn--tertiary btn--sm" [id]="idDoValor(valor.codigo, 'editar')" [disabled]="bloqueado() || editando() !== null" (click)="editarValor(valor.codigo)">
                              Editar<span class="sr-only"> o valor {{ valor.codigo }}</span>
                            </button>
                          }
                          <button type="button" class="btn btn--tertiary btn--sm" [id]="idDoValor(valor.codigo, 'subir')" [disabled]="bloqueado() || editando() !== null || $first" (click)="moverValor(valor.codigo, -1)">
                            Subir<span class="sr-only"> o valor {{ valor.codigo }}</span>
                          </button>
                          <button type="button" class="btn btn--tertiary btn--sm" [id]="idDoValor(valor.codigo, 'descer')" [disabled]="bloqueado() || editando() !== null || $last" (click)="moverValor(valor.codigo, 1)">
                            Descer<span class="sr-only"> o valor {{ valor.codigo }}</span>
                          </button>
                          @if (valor.ativo) {
                            <button type="button" class="btn btn--tertiary btn--sm" [id]="idDaAcaoDoValor(valor.codigo)" [disabled]="bloqueado() || editando() !== null" (click)="desativarValor(valor.codigo)">
                              Desativar<span class="sr-only"> o valor {{ valor.codigo }}</span>
                            </button>
                          } @else {
                            <button type="button" class="btn btn--tertiary btn--sm" [id]="idDaAcaoDoValor(valor.codigo)" [disabled]="bloqueado() || editando() !== null" (click)="reativarValor(valor.codigo)">
                              Reativar<span class="sr-only"> o valor {{ valor.codigo }}</span>
                            </button>
                          }
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="u-caption">Nenhum valor cadastrado.</p>
          }

          @if (temValores() && !somenteLeitura()) {
          <form [formGroup]="novoValor" (ngSubmit)="acrescentarValor()" novalidate>
            <div class="form-grid">
              <label class="field" [class.is-error]="erroNovoValor('codigo')">
                <span class="field__label is-required">Código do valor</span>
                <input class="input cfg-input-uppercase" type="text" formControlName="codigo" [attr.aria-invalid]="erroNovoValor('codigo') ? 'true' : null" [attr.aria-describedby]="erroNovoValor('codigo') ? 'cfg-fato-valor-codigo-erro' : null" />
                @if (erroNovoValor('codigo')) {
                  <span class="field__error" id="cfg-fato-valor-codigo-erro">{{ erroNovoValor('codigo') }}</span>
                }
              </label>
              <label class="field" [class.is-error]="erroNovoValor('descricao')">
                <span class="field__label" [class.is-required]="f.origem === 'DECLARADO'">Descrição</span>
                <input class="input" type="text" formControlName="descricao" [attr.aria-invalid]="erroNovoValor('descricao') ? 'true' : null" [attr.aria-describedby]="erroNovoValor('descricao') ? 'cfg-fato-valor-descricao-erro' : null" />
                @if (erroNovoValor('descricao')) {
                  <span class="field__error" id="cfg-fato-valor-descricao-erro">{{ erroNovoValor('descricao') }}</span>
                }
              </label>
              <label class="field form-grid__full" [class.is-error]="erroNovoValor('orientacao')">
                <span class="field__label">Orientação ao candidato</span>
                <textarea class="textarea" rows="2" formControlName="orientacao" [attr.aria-describedby]="erroNovoValor('orientacao') ? 'cfg-fato-valor-orientacao-ajuda cfg-fato-valor-orientacao-erro' : 'cfg-fato-valor-orientacao-ajuda'" [attr.aria-invalid]="erroNovoValor('orientacao') ? 'true' : null"></textarea>
                <span class="field__hint" id="cfg-fato-valor-orientacao-ajuda">Aparece abaixo da opção, no formulário. Use só quando o candidato precisa saber algo sobre ela.</span>
                @if (erroNovoValor('orientacao')) {
                  <span class="field__error" id="cfg-fato-valor-orientacao-erro">{{ erroNovoValor('orientacao') }}</span>
                }
              </label>
            </div>
            <div class="cfg-form-actions">
              <button type="submit" class="btn btn--secondary btn--sm" [disabled]="bloqueado()">Acrescentar valor</button>
            </div>
          </form>
          }
        </ui-recolhivel>
      }

      @if (temRegras()) {
        <section aria-labelledby="cfg-fato-regras">
          <h3 id="cfg-fato-regras" class="form-section__title">Regras padrão</h3>
          @if (catalogoComErro()) {
            <ui-alert variant="warning" heading="Catálogo de fatos não carregado">
              Sem o catálogo, as condições das regras não podem ser escritas nem conferidas.
              <div class="cfg-list__retry">
                <button type="button" class="btn btn--secondary btn--sm" (click)="catalogo.reload()">Tentar novamente</button>
              </div>
            </ui-alert>
          }
          <p class="u-caption">
            O processo copia estas regras ao citar o fato e pode alterá-las na cópia.
            @if (f.dominio === 'BOOLEANO') {
              O fato vale "sim" quando alguma regra se cumpre.
            } @else {
              Cada regra que se cumpre acrescenta o valor dela ao fato.
            }
          </p>
          @for (regra of regras(); track $index; let i = $index) {
            <fieldset class="field form-grid__full">
              <legend class="field__label">Regra {{ i + 1 }}</legend>
              @if (f.dominio === 'CATEGORICO') {
                <label class="field">
                  <span class="field__label is-required">Valor que a regra acrescenta</span>
                  <select
                    class="select"
                    [disabled]="somenteLeitura()"
                    [attr.aria-invalid]="contribuicoesFaltando().has(i) ? 'true' : null"
                    [attr.aria-describedby]="contribuicoesFaltando().has(i) ? 'cfg-fato-regra-' + i + '-erro' : null"
                    (change)="trocarContribuicao(i, valorDoSelect($event))"
                  >
                    <option value="" [selected]="!regra.contribui">Selecione…</option>
                    @for (opcao of opcoesDeContribuicao(regra.contribui); track opcao.valor) {
                      <option [value]="opcao.valor" [selected]="opcao.valor === regra.contribui">{{ opcao.rotulo }}</option>
                    }
                  </select>
                </label>
              }
              <ui-editor-de-condicoes
                [condicoes]="regra.condicoes"
                [fatos]="fatosDaRegra()"
                [idBase]="'cfg-fato-regra-' + i"
                legenda="Quando"
                [disabled]="ocupado() || somenteLeitura()"
                [erros]="errosDasCondicoes()[i] ?? {}"
                (condicoesChange)="trocarCondicoes(i, $event)"
              />
              @if (errosDasRegras()[i]; as erro) {
                <span class="field__error" role="alert" [id]="'cfg-fato-regra-' + i + '-erro'">{{ erro }}</span>
              }
              @if (!somenteLeitura()) {
                <button type="button" class="btn btn--tertiary btn--sm" [disabled]="ocupado()" (click)="removerRegra(i)">
                  Remover a regra {{ i + 1 }}
                </button>
              }
            </fieldset>
          }
          @if (!somenteLeitura()) {
            <div class="cfg-form-actions">
              <button type="button" class="btn btn--secondary btn--sm" [disabled]="ocupado()" (click)="acrescentarRegra()">Acrescentar regra</button>
              <button type="button" class="btn btn--primary btn--sm" [disabled]="ocupado()" (click)="salvarRegras()">Salvar regras</button>
            </div>
          }
        </section>
      }

      @if (erro()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ erro() }}</ui-alert>
      }
    } @else if (carregando()) {
      <p><ui-spinner size="sm" /> Carregando o fato…</p>
    } @else if (erroDeCarga()) {
      <ui-alert variant="danger" heading="Não foi possível carregar o fato">{{ erroDeCarga() }}</ui-alert>
    }
    </div>
  `,
})
export class FatoCandidatoEdicaoComponent {
  private readonly api = inject(FatosCandidatoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly injector = inject(Injector);

  /** O fato em edição. */
  readonly id = input.required<string>();
  /** Só para consultar: os campos não se editam, as ações somem e a definição chega aberta. */
  readonly somenteLeitura = input(false);
  /** Avisa a lista de que o fato mudou. */
  readonly alterado = output<void>();

  protected readonly origens = ORIGENS;
  protected readonly dominios = DOMINIOS;
  protected readonly cardinalidades = CARDINALIDADES;
  protected readonly fontes = FONTES_DE_VALORES;
  protected readonly formatos = FORMATOS_DE_TEXTO;
  protected readonly escopos = ESCOPOS;
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly hipoteses = HIPOTESES_LEGAIS;
  protected readonly rotulo = rotuloDe;

  private readonly recurso = useApiResource<FatoCandidatoDto>(() => ({
    url: `${this.basePath}/api/configuracao/admin/fatos-candidato/${encodeURIComponent(this.id())}`,
    context: withVendorMime('fato-candidato', 1),
  }));

  /** O catálogo que as regras padrão citam. */
  protected readonly catalogo = useApiResource<readonly FatoCandidatoView[]>(() => ({
    url: `${this.basePath}/api/configuracao/fatos-candidato`,
    context: withVendorMime('fato-candidato', 1),
  }));

  protected readonly fato = this.recurso.data;
  protected readonly catalogoComErro = computed(() => this.catalogo.problem() !== null || this.catalogo.error() !== undefined);
  protected readonly carregando = this.recurso.isLoading;
  protected readonly erroDeCarga = computed(() => {
    const problem = this.recurso.problem();
    return problem ? this.problemI18n.resolve(problem).title : null;
  });

  protected readonly temValores = computed(() => {
    const fato = this.fato();
    return fato !== null && podeTerValores(fato);
  });

  protected readonly temRegras = computed(() => {
    const fato = this.fato();
    return fato !== null && podeTerRegras(fato);
  });

  protected readonly valoresAtivos = computed(() =>
    (this.fato()?.valores ?? []).filter((valor) => valor.ativo).map((valor) => valor.codigo),
  );

  /**
   * Os fatos que as regras salvas já citam. A API recusa só a citação nova de fato desativado ou
   * fora do vocabulário; a regra que já citava continua valendo, e a tela não pode travá-la.
   */
  private readonly fatosJaCitados = computed(
    () => new Set((this.fato()?.regrasPadrao ?? []).flatMap((regra) => (regra.quando ?? []).flat().map((condicao) => condicao.fato))),
  );

  protected readonly fatosDaRegra = computed(() => {
    const fato = this.fato();
    if (fato === null) return [];
    const catalogo = this.catalogo.data() ?? [];
    const citaveis = new Set(fatosCitaveisPelaRegra(catalogo, fato.codigo).map((f) => f.codigo));
    const jaCitados = this.fatosJaCitados();
    return fatosEscolhiveis(catalogo.filter((f) => citaveis.has(f.codigo) || jaCitados.has(f.codigo)));
  });

  /** Os valores que a regra pode acrescentar: os ativos e, se for o caso, o desativado que ela já acrescentava. */
  protected opcoesDeContribuicao(contribui: string | null): readonly { readonly valor: string; readonly rotulo: string }[] {
    const ativos = this.valoresAtivos().map((valor) => ({ valor, rotulo: valor }));
    return contribui && !this.valoresAtivos().includes(contribui) ? [{ valor: contribui, rotulo: `${contribui} (desativado)` }, ...ativos] : ativos;
  }

  protected readonly ocupado = signal(false);
  /**
   * Uma escrita deu certo e o fato recarregado ainda não chegou: a lista na tela é a antiga, e
   * reordenar ou corrigir a partir dela reenviaria a ordem velha.
   */
  private readonly aguardandoRecarga = signal(false);
  protected readonly bloqueado = computed(() => this.ocupado() || this.aguardandoRecarga());
  protected readonly erro = signal<string | null>(null);
  protected readonly regras = signal<readonly RegraEmEdicao[]>([]);
  protected readonly errosDasRegras = signal<Readonly<Record<number, string>>>({});
  /** As regras sem o valor que acrescentam — o select delas é o controle inválido. */
  protected readonly contribuicoesFaltando = signal<ReadonlySet<number>>(new Set());
  /** O problema de cada condição, por regra, para o editor marcar a condição certa. */
  protected readonly errosDasCondicoes = signal<Readonly<Partial<Record<number, Readonly<Record<number, string>>>>>>({});

  /** Uma Idempotency-Key por ação; a de correção e a de ordem ainda variam com a intenção (alvo e corpo). */
  private readonly chaves: Record<AcaoComChave, string> = {
    descritivo: idempotencyKey.create(),
    valor: idempotencyKey.create(),
    regras: idempotencyKey.create(),
    reativacao: idempotencyKey.create(),
    correcao: idempotencyKey.create(),
    ordem: idempotencyKey.create(),
  };
  private readonly intencoes: Partial<Record<AcaoComChave, string>> = {};

  /**
   * A chave da ação para esta intenção: a repetição exata da tentativa (erro de rede, 5xx) reusa a
   * chave; outro alvo ou outro corpo ganha chave nova, senão a API devolveria a resposta guardada
   * da tentativa anterior ou body_mismatch.
   */
  private chaveDe(acao: AcaoComChave, intencao = ''): string {
    if (this.intencoes[acao] !== intencao) {
      this.chaves[acao] = idempotencyKey.create();
      this.intencoes[acao] = intencao;
    }
    return this.chaves[acao];
  }

  private rotacionar(acao: AcaoComChave): void {
    this.chaves[acao] = idempotencyKey.create();
    delete this.intencoes[acao];
  }

  /**
   * O botão que recebe o foco quando o fato recarregado chegar: desativar ou reativar um valor
   * troca o botão da linha, e o foco iria para o corpo da página.
   */
  private focoAposRecarga: string | null = null;

  protected readonly descritivo = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });

  /** O valor cuja descrição e orientação estão em edição na própria linha. */
  protected readonly editando = signal<string | null>(null);

  protected readonly edicaoDoValor = new FormGroup({
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    orientacao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  protected readonly novoValor = new FormGroup({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    orientacao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  /**
   * As seções que o formulário edita só se copiam do servidor quando o fato carregado é outro, ou
   * depois que a própria seção salvou: as demais escritas recarregam o fato, e copiar a cada
   * recarga apagaria o que ainda está em edição — as regras montadas enquanto se acrescenta o
   * valor que elas vão contribuir.
   */
  private secoesCopiadasDe: string | null = null;
  private recopiarDescritivo = false;
  private recopiarRegras = false;

  constructor() {
    effect(() => {
      const fato = this.fato();
      // A recarga falhou: não há lista nova a esperar.
      if (this.recurso.problem() !== null || this.recurso.error() !== undefined) untracked(() => this.aguardandoRecarga.set(false));
      if (fato === null) return;
      untracked(() => {
        this.aguardandoRecarga.set(false);
        const outroFato = this.secoesCopiadasDe !== fato.id;
        if (outroFato) {
          this.editando.set(null);
          this.edicaoDoValor.reset();
        }
        if (outroFato || this.recopiarDescritivo) {
          this.descritivo.reset({ nome: fato.nome, descricao: fato.descricao ?? '' });
        }
        if (outroFato || this.recopiarRegras) {
          this.regras.set(
            fato.regrasPadrao.map((regra) => ({ contribui: regra.contribui, condicoes: deClausulasDoWire(regra.quando) })),
          );
          this.errosDasRegras.set({});
        }
        this.secoesCopiadasDe = fato.id;
        this.recopiarDescritivo = false;
        this.recopiarRegras = false;
        this.focarAposRecarga();
      });
    });
  }

  protected salvarDescritivo(): void {
    // Só para consultar, nada se grava — nem pelo Enter que envia o formulário.
    if (this.somenteLeitura()) return;
    if (this.descritivo.invalid) {
      this.descritivo.markAllAsTouched();
      return;
    }
    const { nome, descricao } = this.descritivo.getRawValue();
    this.executar(
      this.api.atualizarDescritivo(this.id(), { nome: nome.trim(), descricao: descricao.trim() || null }, withIdempotencyKey(this.chaveDe('descritivo'))),
      'Nome e descrição salvos',
      () => {
        this.rotacionar('descritivo');
        this.recopiarDescritivo = true;
      },
      (problem) => this.aplicarErrosNoFormulario(this.descritivo, problem),
    );
  }

  protected acrescentarValor(): void {
    // A ordem sai do total de valores: com o fato recarregado ainda a caminho, o total está velho.
    if (this.somenteLeitura() || this.bloqueado()) return;
    // A descrição do valor é obrigatória no fato declarado: é o nome da opção que o candidato lê.
    this.exigirDescricaoDoDeclarado(this.novoValor.controls.descricao);
    if (this.novoValor.invalid) {
      this.novoValor.markAllAsTouched();
      return;
    }
    const { codigo, descricao, orientacao } = this.novoValor.getRawValue();
    const ordem = this.fato()?.valores.length ?? 0;
    this.executar(
      this.api.acrescentarValor(
        this.id(),
        {
          codigo: codigo.trim().toLocaleUpperCase('pt-BR'),
          descricao: descricao.trim() || null,
          ordem,
          orientacao: orientacao.trim() || null,
        },
        withIdempotencyKey(this.chaveDe('valor')),
      ),
      'Valor acrescentado',
      () => {
        this.rotacionar('valor');
        this.novoValor.reset();
      },
      (problem) => this.aplicarErrosNoFormulario(this.novoValor, problem),
    );
  }

  /** Descrição só com espaços não é descrição: no fato declarado vale como vazia. */
  private exigirDescricaoDoDeclarado(controle: FormControl<string>): void {
    if (this.fato()?.origem === 'DECLARADO' && controle.value.trim() === '') {
      controle.setErrors({ required: true });
      controle.markAsTouched();
    }
  }

  protected desativarValor(codigo: string): void {
    if (this.somenteLeitura() || this.bloqueado() || this.editando() !== null) return;
    this.executar(this.api.desativarValor(this.id(), codigo), `Valor ${codigo} desativado`, () => {
      this.focoAposRecarga = this.idDaAcaoDoValor(codigo);
    });
  }

  /** Reativa um valor desativado: condições novas voltam a poder citá-lo. */
  protected reativarValor(codigo: string): void {
    if (this.somenteLeitura() || this.bloqueado() || this.editando() !== null) return;
    this.executar(
      this.api.reativarValor(this.id(), codigo, withIdempotencyKey(this.chaveDe('reativacao', codigo))),
      `Valor ${codigo} reativado`,
      () => {
        this.rotacionar('reativacao');
        this.focoAposRecarga = this.idDaAcaoDoValor(codigo);
      },
    );
  }

  protected editarValor(codigo: string): void {
    const valor = this.fato()?.valores.find((item) => item.codigo === codigo);
    if (this.somenteLeitura() || valor === undefined || this.bloqueado() || this.editando() !== null) return;
    this.edicaoDoValor.reset({ descricao: valor.descricao ?? '', orientacao: valor.orientacao ?? '' });
    this.erro.set(null);
    this.editando.set(codigo);
    // O botão Editar sai do DOM: o foco vai para o campo, senão cairia no corpo da página.
    afterNextRender(() => document.getElementById(this.idDoValor(codigo, 'descricao'))?.focus(), { injector: this.injector });
  }

  protected cancelarEdicaoDoValor(codigo: string): void {
    this.editando.set(null);
    this.erro.set(null);
    this.focoAposRecarga = this.idDoValor(codigo, 'editar');
    this.focarAposRecarga();
  }

  protected salvarEdicaoDoValor(codigo: string): void {
    if (this.somenteLeitura() || this.bloqueado()) return;
    this.exigirDescricaoDoDeclarado(this.edicaoDoValor.controls.descricao);
    if (this.edicaoDoValor.invalid) {
      this.edicaoDoValor.markAllAsTouched();
      return;
    }
    const { descricao, orientacao } = this.edicaoDoValor.getRawValue();
    const corpo = { descricao: descricao.trim() || null, orientacao: orientacao.trim() || null };
    this.executar(
      this.api.corrigirValor(this.id(), codigo, corpo, withIdempotencyKey(this.chaveDe('correcao', JSON.stringify([codigo, corpo])))),
      `Valor ${codigo} corrigido`,
      () => {
        this.rotacionar('correcao');
        this.editando.set(null);
        this.focoAposRecarga = this.idDoValor(codigo, 'editar');
      },
      (problem) => this.aplicarErrosNoFormulario(this.edicaoDoValor, problem) || this.avisarConflito(problem),
    );
  }

  /**
   * Troca o valor de lugar com o vizinho e envia a lista completa — a API exige todos os códigos,
   * desativados inclusive, porque a ordem é do fato e não só do que aparece para o candidato.
   */
  protected moverValor(codigo: string, sentido: -1 | 1): void {
    if (this.somenteLeitura() || this.bloqueado() || this.editando() !== null) return;
    const codigos = (this.fato()?.valores ?? []).map((valor) => valor.codigo);
    const de = codigos.indexOf(codigo);
    const para = de + sentido;
    if (de < 0 || para < 0 || para >= codigos.length) return;
    [codigos[de], codigos[para]] = [codigos[para], codigos[de]];
    // Chegando à ponta o botão que moveu fica desabilitado; o foco vai para o oposto, que continua valendo.
    const ponta = para === 0 || para === codigos.length - 1;
    const botao = ponta ? (sentido === -1 ? 'descer' : 'subir') : sentido === -1 ? 'subir' : 'descer';
    this.executar(
      this.api.reordenarValores(this.id(), { codigos }, withIdempotencyKey(this.chaveDe('ordem', codigos.join(',')))),
      `Valor ${codigo} movido`,
      () => {
        this.rotacionar('ordem');
        this.focoAposRecarga = this.idDoValor(codigo, botao);
      },
      (problem) => this.avisarConflito(problem),
    );
  }

  /**
   * A escrita perdeu para outra: recarrega o fato e fecha a edição em linha, para refazer a
   * alteração sobre a versão atual. Só os códigos de concorrência valem: qualquer outro 409
   * (idempotência em curso, código repetido) segue com a mensagem da API e mantém a edição aberta.
   */
  private avisarConflito(problem: ProblemDetails): boolean {
    if (problem.status !== 409 || !CODIGOS_DE_CONCORRENCIA.includes(problem.code)) return false;
    // Fechar a edição tira do DOM o botão que tinha o foco: ele volta ao Editar da mesma linha.
    const emEdicao = this.editando();
    if (emEdicao !== null) this.focoAposRecarga = this.idDoValor(emEdicao, 'editar');
    this.editando.set(null);
    this.aguardandoRecarga.set(true);
    this.recurso.reload();
    this.erro.set('Outra pessoa alterou este fato enquanto você editava. A versão atual foi carregada: refaça a alteração.');
    return true;
  }

  protected idDoValor(codigo: string, parte: string): string {
    return `cfg-fato-valor-${codigo}-${parte}`;
  }

  protected idDaAcaoDoValor(codigo: string): string {
    return this.idDoValor(codigo, 'acao');
  }

  private focarAposRecarga(): void {
    const id = this.focoAposRecarga;
    if (id === null) return;
    this.focoAposRecarga = null;
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  protected acrescentarRegra(): void {
    const contribui = this.fato()?.dominio === 'CATEGORICO' ? '' : null;
    this.regras.update((regras) => [...regras, { contribui, condicoes: [] }]);
  }

  protected removerRegra(indice: number): void {
    this.regras.update((regras) => regras.filter((_, posicao) => posicao !== indice));
    this.errosDasRegras.set({});
    this.contribuicoesFaltando.set(new Set());
    this.errosDasCondicoes.set({});
  }

  protected trocarContribuicao(indice: number, valor: string): void {
    this.regras.update((regras) => regras.map((regra, posicao) => (posicao === indice ? { ...regra, contribui: valor } : regra)));
    this.esquecerErrosDaRegra(indice);
  }

  protected trocarCondicoes(indice: number, condicoes: readonly CondicaoEmClausula[]): void {
    this.regras.update((regras) => regras.map((regra, posicao) => (posicao === indice ? { ...regra, condicoes } : regra)));
    this.esquecerErrosDaRegra(indice);
  }

  /**
   * Os erros de uma regra valem para as posições que ela tinha ao salvar: editada, a regra
   * reposiciona as condições, e o erro marcaria o controle errado. A conferência volta no
   * próximo "Salvar regras".
   */
  private esquecerErrosDaRegra(indice: number): void {
    this.errosDasRegras.update(({ [indice]: _, ...resto }) => resto);
    this.errosDasCondicoes.update(({ [indice]: _, ...resto }) => resto);
    this.contribuicoesFaltando.update((faltando) => new Set([...faltando].filter((posicao) => posicao !== indice)));
  }

  protected salvarRegras(): void {
    if (this.somenteLeitura()) return;
    const fatosPorCodigo = new Map(this.fatosDaRegra().map((fato) => [fato.codigo, fato]));
    const problemas: Record<number, string> = {};
    const contribuicoesFaltando = new Set<number>();
    const condicoesComProblema: Record<number, Record<number, string>> = {};
    this.regras().forEach((regra, indice) => {
      if (regra.condicoes.length === 0) {
        problemas[indice] = 'Declare ao menos uma condição.';
        return;
      }
      if (regra.contribui === '') {
        problemas[indice] = 'Escolha o valor que a regra acrescenta.';
        contribuicoesFaltando.add(indice);
        return;
      }
      // O fato já citado que o editor não oferece (fonte de valores do processo) é conferido pela API.
      const conferidosPelaApi = new Set([...this.fatosJaCitados()].filter((codigo) => !fatosPorCodigo.has(codigo)));
      const porCondicao: Record<number, string> = {};
      regra.condicoes.forEach((condicao, posicao) => {
        if (conferidosPelaApi.has(condicao.fato)) return;
        const problema = problemaDaCondicao(condicao, fatosPorCodigo);
        if (problema !== null) porCondicao[posicao] = problema;
      });
      if (Object.keys(porCondicao).length > 0) {
        problemas[indice] = 'Há condição incompleta: corrija a condição marcada.';
        condicoesComProblema[indice] = porCondicao;
      }
    });
    this.errosDasRegras.set(problemas);
    this.contribuicoesFaltando.set(contribuicoesFaltando);
    this.errosDasCondicoes.set(condicoesComProblema);
    if (Object.keys(problemas).length > 0) return;

    const regras = this.regras().map((regra) => ({
      contribui: regra.contribui,
      quando: paraClausulasDoWire(regra.condicoes),
    }));
    this.executar(
      this.api.definirRegrasPadrao(this.id(), { regras }, withIdempotencyKey(this.chaveDe('regras'))),
      'Regras padrão salvas',
      () => {
        this.rotacionar('regras');
        this.recopiarRegras = true;
      },
      (problem) => this.aplicarErrosDasRegras(problem),
    );
  }

  protected erroDescritivo(campo: 'nome' | 'descricao'): string | null {
    return mensagemDoControle(this.descritivo.controls[campo]);
  }

  protected erroEdicao(campo: 'descricao' | 'orientacao'): string | null {
    return mensagemDoControle(this.edicaoDoValor.controls[campo]);
  }

  protected erroNovoValor(campo: 'codigo' | 'descricao' | 'orientacao'): string | null {
    return mensagemDoControle(this.novoValor.controls[campo]);
  }

  protected valorDoSelect(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }

  /**
   * Executa uma escrita: no sucesso recarrega o fato e avisa a lista; na falha mostra a recusa —
   * no campo quando a API diz qual — e troca a chave quando o próximo envio for outro comando.
   */
  private executar(
    escrita: Observable<ApiResult<void>>,
    mensagemDeSucesso: string,
    aoSalvar: () => void = () => undefined,
    aoRecusar: (problem: ProblemDetails) => boolean = () => false,
  ): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.erro.set(null);
    escrita.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado: ApiResult<void>) => {
      this.ocupado.set(false);
      if (resultado.ok) {
        this.aguardandoRecarga.set(true);
        aoSalvar();
        this.notifications.success(mensagemDeSucesso);
        this.recurso.reload();
        this.alterado.emit();
        return;
      }
      if (deveRotacionarIdempotencyKey(resultado.problem)) {
        for (const acao of Object.keys(this.chaves) as AcaoComChave[]) this.rotacionar(acao);
      }
      if (!aoRecusar(resultado.problem)) {
        this.erro.set(this.problemI18n.resolve(resultado.problem).title);
      }
      if (resultado.problem.status >= 500) {
        this.notifications.errorFromProblem(resultado.problem);
      }
    });
  }

  /** Põe as recusas de campo da API nos controles do formulário; diz se alguma coube. */
  private aplicarErrosNoFormulario(formulario: FormGroup, problem: ProblemDetails): boolean {
    let aplicou = false;
    for (const erro of problem.errors ?? []) {
      const controle = formulario.get(campoDaRecusa(erro.field));
      if (controle === null) continue;
      controle.setErrors({ backend: { message: erro.message } });
      controle.markAsTouched();
      aplicou = true;
    }
    return aplicou;
  }

  /** Põe cada recusa de regra junto da regra; diz se alguma coube. */
  private aplicarErrosDasRegras(problem: ProblemDetails): boolean {
    const porRegra: Record<number, string> = {};
    for (const erro of problem.errors ?? []) {
      const indice = indiceDaRegra(erro.field);
      if (indice !== null) porRegra[indice] = erro.message;
    }
    this.errosDasRegras.set(porRegra);
    return Object.keys(porRegra).length > 0;
  }
}

function mensagemDoControle(controle: FormControl<string>): string | null {
  if (!(controle.touched || controle.dirty) || controle.errors === null) return null;
  const backend = controle.errors['backend'] as { message: string } | undefined;
  if (backend) return backend.message;
  if (controle.errors['required']) return 'Campo obrigatório.';
  if (controle.errors['maxlength']) return 'Valor acima do tamanho permitido.';
  return 'Valor inválido.';
}
