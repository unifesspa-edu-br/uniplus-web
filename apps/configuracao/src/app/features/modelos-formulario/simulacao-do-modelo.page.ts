import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { AvaliacoesDeFormularioApi, ModelosFormularioApi } from '@uniplus/shared-data/configuracao';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import {
  AlertComponent,
  BUSCA_DE_MUNICIPIOS,
  SimulacaoDeFormularioComponent,
  SpinnerComponent,
  type ConferenciaComOServidor,
  type FormularioDoCandidato,
} from '@uniplus/shared-ui/components';

/**
 * A simulação de um modelo de formulário: o modelo como o candidato o veria, montado pela API com o
 * catálogo vivo, para responder antes de aplicar o modelo a um processo. Nada é gravado. As opções que
 * só o processo oferta — as modalidades, os municípios do bônus — ainda não existem no modelo.
 */
@Component({
  selector: 'cfg-simulacao-do-modelo-page',
  standalone: true,
  imports: [AlertComponent, RouterLink, SimulacaoDeFormularioComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // O campo de município escolhe o município pela busca no Geo, limitada à UF respondida.
  providers: [{ provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo }],
  template: `
    <div class="page-header page-header--form">
      <a
        class="btn btn--tertiary btn--sm btn--rect cfg-voltar"
        [routerLink]="['/modelos-formulario', id]"
      >
        <i class="pi pi-chevron-left" aria-hidden="true"></i>
        Voltar ao modelo
      </a>
      <div class="page-header__content">
        <h1 class="page-header__title">Simulação do modelo de formulário</h1>
        <p class="page-header__desc">
          Responda como o candidato responderia. Simula o modelo gravado; as opções que só o
          processo oferta aparecem pelo código.
        </p>
      </div>
    </div>

    @if (carregando()) {
      <div class="cfg-form__loading" role="status">
        <ui-spinner size="md" /> Carregando o modelo...
      </div>
    } @else if (erroAoCarregar()) {
      <ui-alert variant="danger" heading="Não foi possível carregar o modelo">
        {{ erroAoCarregar() }}
        <div class="cfg-list__retry">
          <button type="button" class="btn btn--secondary btn--sm" (click)="carregar()">
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
  `,
})
export class SimulacaoDoModeloPage {
  private readonly modelos = inject(ModelosFormularioApi);
  private readonly avaliacoes = inject(AvaliacoesDeFormularioApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  protected readonly carregando = signal(true);
  protected readonly erroAoCarregar = signal<string | null>(null);
  /** O renderizável do contrato é o formulário que o candidato vê: o compilador acusa se divergirem. */
  protected readonly formulario = signal<FormularioDoCandidato | null>(null);

  protected readonly conferir: ConferenciaComOServidor = (simulacao) =>
    this.avaliacoes.avaliar(simulacao);

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.erroAoCarregar.set(null);
    this.modelos
      .obterRenderizavel(this.id)
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
}
