import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import {
  VocabulariosDeConfiguracaoApi,
  type VocabulariosDeConfiguracao,
} from '@uniplus/shared-data/configuracao';

@Injectable()
export class VocabulariosDaModalidade {
  private readonly api = inject(VocabulariosDeConfiguracaoApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly falhou = signal(false);
  readonly carregando = signal(false);
  private pendentes = 0;
  readonly naturezas = signal<readonly VocabulariosDeConfiguracao['naturezas-legais'][]>([]);
  readonly composicoes = signal<readonly VocabulariosDeConfiguracao['composicoes-vagas'][]>([]);
  readonly regras = signal<readonly VocabulariosDeConfiguracao['regras-remanejamento'][]>([]);
  readonly acoes = signal<readonly VocabulariosDeConfiguracao['acoes-quando-indeferido'][]>([]);

  constructor() {
    this.recarregar();
  }

  recarregar(): void {
    if (this.carregando()) return;
    this.falhou.set(false);
    this.pendentes = 4;
    this.carregando.set(true);
    this.carregar('naturezas-legais', this.naturezas);
    this.carregar('composicoes-vagas', this.composicoes);
    this.carregar('regras-remanejamento', this.regras);
    this.carregar('acoes-quando-indeferido', this.acoes);
  }

  private carregar<K extends keyof VocabulariosDeConfiguracao>(
    nome: K,
    destino: { set(valor: readonly VocabulariosDeConfiguracao[K][]): void },
  ): void {
    this.api
      .listar(nome)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.concluirLeitura()),
      )
      .subscribe({
        next: (resultado) => (resultado.ok ? destino.set(resultado.data) : this.falhou.set(true)),
        error: () => this.falhou.set(true),
      });
  }

  private concluirLeitura(): void {
    this.pendentes--;
    if (this.pendentes === 0) this.carregando.set(false);
  }
}
