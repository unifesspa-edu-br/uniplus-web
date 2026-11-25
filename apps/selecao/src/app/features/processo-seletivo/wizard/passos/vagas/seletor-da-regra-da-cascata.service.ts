import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

@Injectable()
export class SeletorDaRegraDaCascata {
  private readonly store = inject(ProcessoSeletivoStore);
  readonly controle = new FormControl<string>('|', { nonNullable: true });
  private readonly valor = computed(() => {
    const selecao = this.store.draft().vagas.cascata;
    return selecao === null ? '|' : `${selecao.regraCodigo}|${selecao.regraVersao}`;
  });

  private readonly controleSegueORascunho = effect(() => {
    const valor = this.valor();
    untracked(() => {
      if (this.controle.value !== valor) this.controle.setValue(valor, { emitEvent: false });
    });
  });

  private readonly controleSegueAEdicaoLiberada = effect(() => {
    const habilitado = this.store.aceitaEdicao();
    untracked(() => {
      if (habilitado && this.controle.disabled) this.controle.enable({ emitEvent: false });
      if (!habilitado && this.controle.enabled) this.controle.disable({ emitEvent: false });
    });
  });

  private readonly mudancasDoControle = this.controle.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe((valor) => this.escolher(valor));

  private escolher(valor: string): void {
    const [codigo, versao] = valor.split('|');
    this.store.patchObjectSection('vagas', {
      cascata:
        codigo === '' || versao === undefined || versao === ''
          ? null
          : { regraCodigo: codigo, regraVersao: versao },
    });
  }
}
