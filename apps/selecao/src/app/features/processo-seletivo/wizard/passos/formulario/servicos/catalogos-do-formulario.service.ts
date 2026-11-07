import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  FatoCandidatoView,
  FatosCandidatoApi,
  TermosConsentimentoApi,
} from '@uniplus/shared-data/configuracao';
import {
  acompanharLeitura,
  termoDisponivelDe,
  type TermoDisponivel,
} from '@uniplus/shared-ui/components';

import { tituloDoPasso } from '../../../shared/titulo-do-passo';

const CONSEQUENCIA_DO_CATALOGO =
  'Sem esses dados não é possível acrescentar campos nem declarar condições.';
const MENSAGEM_DOS_TERMOS =
  'Não foi possível carregar os termos de consentimento. Sem eles não é possível exigir um termo novo nem trocar a versão.';

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
  readonly termosCarregando = signal(true);
  readonly termosErro = signal<string | null>(null);

  readonly leituraDoCatalogo = acompanharLeitura({
    falha: this.catalogoErro,
    pendente: this.catalogoCarregando,
    recarregar: () => this.carregarCatalogo(),
    destino: tituloDoPasso,
  });

  readonly leituraDosTermos = acompanharLeitura({
    falha: this.termosErro,
    pendente: this.termosCarregando,
    recarregar: () => this.carregarTermos(),
    destino: tituloDoPasso,
  });

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
          this.catalogoErro.set(
            `${this.problemI18n.resolve(resultado.problem).title} ${CONSEQUENCIA_DO_CATALOGO}`,
          );
          return;
        }
        this.catalogo.set(resultado.data);
      });
  }

  /** Os termos de consentimento com as versões promovidas. */
  carregarTermos(): void {
    this.termosCarregando.set(true);
    this.termosErro.set(null);
    this.termosApi
      .listarComVersoes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((termos) => {
        this.termosCarregando.set(false);
        if (!termos.ok) {
          this.termosErro.set(MENSAGEM_DOS_TERMOS);
          return;
        }
        this.termosDisponiveis.set(termos.data.map(termoDisponivelDe));
      });
  }
}
