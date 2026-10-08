import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, type ParamMap } from '@angular/router';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { AvaliacoesDeFormularioApi, ModelosFormularioApi } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  SegmentedComponent,
  SelectComponent,
  SimulacaoDeFormularioComponent,
  SpinnerComponent,
  lerArquivoDoFormulario,
  type ArquivoDoFormulario,
  type ConferenciaComOServidor,
  type FormularioDoCandidato,
  type UiSegmentedOption,
  type UiSelectOption,
} from '@uniplus/shared-ui/components';
import { Subscription } from 'rxjs';
import { ENDERECO_NO_GEO } from '../../shared/endereco';

type Origem = 'modelo' | 'arquivo';

const ORIGENS: readonly UiSegmentedOption<Origem>[] = [
  { value: 'modelo', label: 'Modelo de formulário' },
  { value: 'arquivo', label: 'Arquivo' },
];

/**
 * O simulador de formulário: o formulário como o candidato o veria, a partir de um modelo gravado,
 * montado pela API com o catálogo vivo, ou de um arquivo — um formulário renderizável exportado de um
 * modelo ou de um processo, ou um caso do corpus compartilhado com a API. Nada é gravado ao responder,
 * e o arquivo não é enviado ao abri-lo. Confere com a avaliação sem cadastro da API, que é a
 * autoridade. A origem e o modelo ficam na URL (`?modelo=<id>`), para que um link abra o modelo.
 */
@Component({
  selector: 'cfg-simulador-de-formulario-page',
  standalone: true,
  imports: [
    AlertComponent,
    ReactiveFormsModule,
    SegmentedComponent,
    SelectComponent,
    SimulacaoDeFormularioComponent,
    SpinnerComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // O campo de município escolhe o município pela busca no Geo, limitada à UF respondida.
  providers: [ENDERECO_NO_GEO],
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Simulador de formulário</h1>
        <p class="page-header__desc">
          Escolha um modelo de formulário ou abra um formulário exportado de um modelo ou de um
          processo, ou um caso de teste do formulário, e responda como o candidato responderia.
        </p>
      </div>
    </div>

    <ui-segmented
      accessibleName="Origem do formulário"
      [choices]="origens"
      [selectedValue]="origem()"
      (selectedValueChange)="escolherOrigem($event)"
    />

    @if (origem() === 'modelo') {
      <div class="simulador-formulario__arquivo">
        <ui-select
          fieldLabel="Modelo de formulário"
          placeholderText="Selecione um modelo"
          [choices]="opcoesDeModelo()"
          [hint]="ajudaDoModelo"
          [formControl]="modeloEscolhido"
        />
        @if (modeloId()) {
          <a class="btn btn--link btn--sm" [routerLink]="['/modelos-formulario', modeloId()]"
            >Editar o modelo</a
          >
        }
      </div>

      @if (erroAoListar(); as erro) {
        <ui-alert variant="danger" heading="Não foi possível listar os modelos">
          {{ erro }}
          <div class="cfg-list__retry">
            <button type="button" class="btn btn--secondary btn--sm" (click)="listarModelos()">
              Tentar novamente
            </button>
          </div>
        </ui-alert>
      }

      @if (carregando()) {
        <div class="cfg-form__loading" role="status">
          <ui-spinner size="md" /> Carregando o modelo...
        </div>
      } @else if (erroAoCarregar()) {
        <ui-alert variant="danger" heading="Não foi possível carregar o modelo">
          {{ erroAoCarregar() }}
          <div class="cfg-list__retry">
            <button type="button" class="btn btn--secondary btn--sm" (click)="carregarModelo()">
              Tentar novamente
            </button>
          </div>
        </ui-alert>
      } @else if (formulario(); as renderizavel) {
        <ui-simulacao-de-formulario
          idBase="simulacao-modelo"
          nomeDoArquivo="modelo-de-formulario"
          [formulario]="renderizavel"
          [conferir]="conferir"
        />
      }
    } @else {
      <div class="field simulador-formulario__arquivo">
        <label class="field__label" for="simulador-arquivo">Arquivo JSON do formulário</label>
        <input
          id="simulador-arquivo"
          class="input"
          type="file"
          accept="application/json,.json"
          [attr.aria-invalid]="recusaDoArquivo() ? 'true' : null"
          [attr.aria-describedby]="
            recusaDoArquivo() ? 'simulador-arquivo-erro' : 'simulador-arquivo-ajuda'
          "
          (change)="importar($event)"
        />
        @if (recusaDoArquivo(); as recusa) {
          <span class="field__error" id="simulador-arquivo-erro"
            >{{ recusa.mensagem }} (em {{ recusa.caminho }})</span
          >
        } @else {
          <span class="field__hint" id="simulador-arquivo-ajuda"
            >O arquivo é lido só no navegador: nada é enviado ao abri-lo.</span
          >
        }
      </div>

      @if (arquivo(); as aberto) {
        @if (aberto.valido) {
          <ui-simulacao-de-formulario
            idBase="simulador"
            [formulario]="aberto.formulario"
            [inicial]="aberto.simulacao"
            [conferir]="conferir"
          />
        }
      }
    }
  `,
})
export class SimuladorDeFormularioPage {
  private readonly avaliacoes = inject(AvaliacoesDeFormularioApi);
  private readonly modelos = inject(ModelosFormularioApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly origens = ORIGENS;
  protected readonly origem = signal<Origem>('arquivo');

  protected readonly modeloEscolhido = new FormControl('', { nonNullable: true });
  protected readonly opcoesDeModelo = signal<readonly UiSelectOption[]>([]);
  protected readonly erroAoListar = signal<string | null>(null);
  private listaPedida = false;
  protected readonly ajudaDoModelo =
    'Simula o modelo gravado. Sem processo, a condição de atendimento, o tipo de deficiência e o ' +
    'município da área do bônus mostram todo o cadastro institucional; no processo, as opções são ' +
    'as que ele oferece. As demais opções que só o processo oferta aparecem pelo código.';

  protected readonly modeloId = signal('');
  private carregamento?: Subscription;
  protected readonly carregando = signal(false);
  protected readonly erroAoCarregar = signal<string | null>(null);
  /** O renderizável do contrato é o formulário que o candidato vê: o compilador acusa se divergirem. */
  protected readonly formulario = signal<FormularioDoCandidato | null>(null);

  protected readonly arquivo = signal<ArquivoDoFormulario | null>(null);
  protected readonly recusaDoArquivo = computed(() => {
    const arquivo = this.arquivo();
    return arquivo && !arquivo.valido ? arquivo : null;
  });

  protected readonly conferir: ConferenciaComOServidor = (simulacao) =>
    this.avaliacoes.avaliar(simulacao);

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((parametros) => this.aplicar(parametros));
    this.modeloEscolhido.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => this.navegar({ origem: 'modelo', modelo: id || null }));
  }

  protected escolherOrigem(origem: Origem | null): void {
    if (origem === null || origem === this.origem()) return;
    this.navegar({ origem, modelo: null });
  }

  protected carregarModelo(): void {
    this.carregamento?.unsubscribe();
    this.formulario.set(null);
    this.erroAoCarregar.set(null);
    if (this.modeloId() === '') {
      this.carregando.set(false);
      return;
    }
    this.carregando.set(true);
    this.carregamento = this.modelos
      .obterRenderizavel(this.modeloId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.carregando.set(false);
        if (!resultado.ok) {
          this.erroAoCarregar.set(this.problemI18n.resolve(resultado.problem).title);
          return;
        }
        this.formulario.set(resultado.data);
      });
  }

  /** A URL é a fonte da origem e do modelo: a escolha na tela navega, e a navegação carrega. */
  private aplicar(parametros: ParamMap): void {
    const modelo = parametros.get('modelo') ?? '';
    const origem: Origem =
      modelo !== '' || parametros.get('origem') === 'modelo' ? 'modelo' : 'arquivo';
    this.origem.set(origem);
    if (origem === 'modelo') {
      this.listarModelos();
      // O arquivo aberto antes, ou ainda em leitura, não volta ao retornar à origem arquivo.
      this.importacao++;
      this.arquivo.set(null);
    }
    this.modeloEscolhido.setValue(modelo, { emitEvent: false });
    if (modelo !== this.modeloId()) {
      this.modeloId.set(modelo);
      this.carregarModelo();
    }
  }

  private navegar(parametros: { origem: Origem; modelo: string | null }): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      // Com o modelo na URL, a origem já está dita; o arquivo é a origem sem parâmetro.
      queryParams: {
        origem: parametros.origem === 'modelo' && !parametros.modelo ? 'modelo' : null,
        modelo: parametros.modelo,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected listarModelos(): void {
    if (this.listaPedida) return;
    this.listaPedida = true;
    // Os desativados também: o Simular os oferece, e o modelo aberto precisa aparecer escolhido.
    this.modelos
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (!resultado.ok) {
          this.listaPedida = false;
          this.erroAoListar.set(this.problemI18n.resolve(resultado.problem).title);
          return;
        }
        this.erroAoListar.set(null);
        this.opcoesDeModelo.set(
          resultado.data.map((m) => ({
            value: m.id,
            label: `${m.codigo} — ${m.nome}${m.ativo ? '' : ' (desativado)'}`,
          })),
        );
      });
  }

  /** O arquivo escolhido por último: uma leitura mais lenta de um arquivo anterior não o substitui. */
  private importacao = 0;

  protected async importar(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    if (!arquivo) return;
    // Sem limpar a escolha, o mesmo arquivo, corrigido e escolhido de novo, não dispara outra leitura.
    entrada.value = '';
    const esta = ++this.importacao;
    let lido: ArquivoDoFormulario;
    try {
      lido = lerArquivoDoFormulario(await textoDo(arquivo));
    } catch {
      lido = {
        valido: false,
        caminho: '(arquivo)',
        mensagem: 'Não foi possível ler o arquivo escolhido.',
      };
    }
    if (esta === this.importacao) this.arquivo.set(lido);
  }
}

/** O texto do arquivo escolhido, lido no navegador. */
function textoDo(arquivo: Blob): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result ?? ''));
    leitor.onerror = () => rejeitar(leitor.error);
    leitor.readAsText(arquivo);
  });
}
