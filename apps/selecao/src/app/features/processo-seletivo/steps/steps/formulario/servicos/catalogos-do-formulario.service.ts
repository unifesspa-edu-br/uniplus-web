import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  FatoCandidatoView,
  FatosCandidatoApi,
  TermosConsentimentoApi,
} from '@uniplus/shared-data/configuracao';
import { termoDisponivelDe, type TermoDisponivel } from '@uniplus/shared-ui/components';

/** O vocabulário de fatos do candidato e os termos de consentimento que o formulário pode exigir. */
@Injectable()
export class CatalogosDoFormulario {
  private readonly fatosApi = inject(FatosCandidatoApi);
  private readonly termosApi = inject(TermosConsentimentoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly catalogo = signal<readonly FatoCandidatoView[]>([]);
  readonly catalogoCarregando = signal(true);
  readonly catalogoErro = signal<string | null>(null);

  readonly termosDisponiveis = signal<readonly TermoDisponivel[]>([]);
  readonly termosComErro = signal(false);

  /**
   * Busca o vocabulário de fatos. A tela oferece nova tentativa: sem ela, uma falha passageira
   * deixava o catálogo vazio pelo resto da sessão, e não havia como acrescentar campo.
   */
  carregarCatalogo(): void {
    this.catalogoCarregando.set(true);
    this.catalogoErro.set(null);
    this.fatosApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.catalogoCarregando.set(false);
        if (!isApiOk(resultado)) {
          this.catalogoErro.set(this.problemI18n.resolve(resultado.problem).title);
          return;
        }
        this.catalogo.set(resultado.data);
      });
  }

  /** Os termos de consentimento com as versões promovidas. */
  carregarTermos(): void {
    this.termosComErro.set(false);
    this.termosApi
      .listarComVersoes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((termos) => {
        if (!termos.ok) {
          this.termosComErro.set(true);
          return;
        }
        this.termosDisponiveis.set(termos.data.map(termoDisponivelDe));
      });
  }
}
