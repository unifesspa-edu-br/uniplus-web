import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { FundamentoIsencaoDto, ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';

/** Um fundamento de isenção que o cadastro oferece como subclassificação. */
export interface FundamentoOferecido {
  readonly codigo: string;
  readonly nome: string;
}

/**
 * Os fundamentos de isenção que o cadastro de motivos oferece como subclassificação. Vêm do catálogo
 * do servidor, lido na primeira vez que o formulário precisa deles e relido enquanto falhar.
 */
@Injectable()
export class FundamentosOferecidos {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lidos = signal<readonly FundamentoIsencaoDto[] | null>(null);
  private readonly lendo = signal(false);

  readonly lista = this.lidos.asReadonly();
  readonly falha = signal<string | null>(null);

  garantir(): void {
    if (this.lidos() !== null || this.lendo()) return;
    this.lendo.set(true);
    this.falha.set(null);
    this.api
      .listarFundamentosIsencao()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.lendo.set(false);
        if (result.ok) this.lidos.set(result.data);
        else this.falha.set(this.problemI18n.resolve(result.problem).title);
      });
  }
}
