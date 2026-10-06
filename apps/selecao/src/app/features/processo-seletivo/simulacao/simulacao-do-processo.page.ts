import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { AvaliacoesDeFormularioApi } from '@uniplus/shared-data/configuracao';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import {
  ProcessosSeletivosApi,
  type FormularioRenderizavelDto,
} from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  BUSCA_DE_MUNICIPIOS,
  FINALIDADES,
  SimulacaoDeFormularioComponent,
  SpinnerComponent,
  type ConferenciaComOServidor,
  type DocumentoDoFormulario,
  type FormularioDoCandidato,
} from '@uniplus/shared-ui/components';

/**
 * A simulação de um formulário do processo: o formulário da finalidade como o candidato o veria,
 * montado pela API com a configuração gravada — a do rascunho inclusive —, para responder como o
 * candidato sem inscrição nenhuma. Nada é gravado; o que ainda não foi gravado no processo não entra.
 */
@Component({
  selector: 'sel-simulacao-do-processo-page',
  standalone: true,
  imports: [AlertComponent, RouterLink, SimulacaoDeFormularioComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // O campo de município escolhe o município pela busca no Geo, limitada à UF respondida.
  providers: [{ provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo }],
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Simulação do formulário de {{ nomeDaFinalidade() }}</h1>
        <p class="page-header__desc">
          Responda como o candidato responderia. Simula o processo gravado: o que foi alterado e
          ainda não foi gravado não entra.
        </p>
        <p><a [routerLink]="['/processo-seletivo', id]">Voltar ao processo</a></p>
      </div>
    </div>

    @if (carregando()) {
      <div role="status"><ui-spinner size="md" /> Carregando o formulário...</div>
    } @else if (erroAoCarregar()) {
      <ui-alert variant="danger" heading="Não foi possível carregar o formulário">
        {{ erroAoCarregar() }}
        <p>
          <button type="button" class="btn btn--secondary btn--sm" (click)="carregar()">
            Tentar novamente
          </button>
        </p>
      </ui-alert>
    } @else if (formulario(); as renderizavel) {
      <ui-simulacao-de-formulario
        idBase="simulacao-processo"
        [nomeDoArquivo]="'formulario-' + finalidade.toLocaleLowerCase('pt-BR')"
        [formulario]="renderizavel"
        [documentos]="documentos()"
        [conferir]="conferir"
      />
    }
  `,
})
export class SimulacaoDoProcessoPage {
  private readonly processos = inject(ProcessosSeletivosApi);
  private readonly avaliacoes = inject(AvaliacoesDeFormularioApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rota = inject(ActivatedRoute).snapshot.paramMap;

  protected readonly id = this.rota.get('id') ?? '';
  protected readonly finalidade = this.rota.get('finalidade') ?? '';
  protected readonly nomeDaFinalidade = computed(
    () =>
      FINALIDADES.find((f) => f.valor === this.finalidade)?.rotulo.toLocaleLowerCase('pt-BR') ??
      this.finalidade,
  );
  protected readonly carregando = signal(true);
  protected readonly erroAoCarregar = signal<string | null>(null);
  /** O formulário com a comprovação documental, que só o processo tem. */
  private readonly lido = signal<FormularioRenderizavelDto | null>(null);
  /** O renderizável do contrato é o formulário que o candidato vê: o compilador acusa se divergirem. */
  protected readonly formulario = computed<FormularioDoCandidato | null>(() => this.lido());
  /** A lista do bloco de comprovação documental; o rascunho não a tem, porque ela sai da publicação. */
  protected readonly documentos = computed<readonly DocumentoDoFormulario[] | null>(
    () =>
      this.lido()?.comprovacaoDocumental?.map((e) => ({
        nome: e.rotulo,
        descricao: e.obrigatorio ? 'Obrigatório' : 'Opcional',
      })) ?? null,
  );

  protected readonly conferir: ConferenciaComOServidor = (simulacao) =>
    this.avaliacoes.avaliar(simulacao);

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.erroAoCarregar.set(null);
    this.processos
      .obterFormularioRenderizavel(this.id, this.finalidade)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.carregando.set(false);
        if (!resultado.ok) {
          this.erroAoCarregar.set(this.problemI18n.resolve(resultado.problem).title);
          return;
        }
        this.lido.set(resultado.data);
      });
  }
}
