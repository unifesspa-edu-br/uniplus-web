import { DestroyRef, inject, signal, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import {
  VocabulariosDeConfiguracaoApi,
  type VocabulariosDeConfiguracao,
} from '@uniplus/shared-data/configuracao';

export function carregarVocabulario<K extends keyof VocabulariosDeConfiguracao>(nome: K) {
  const api = inject(VocabulariosDeConfiguracaoApi);
  const destroyRef = inject(DestroyRef);
  const estado = criarEstado<VocabulariosDeConfiguracao[K]>();
  const recarregar = (): void => {
    if (estado.carregando()) return;
    estado.carregando.set(true);
    lerOpcoes(api.listar(nome), destroyRef, estado);
  };
  recarregar();
  return { ...somenteLeitura(estado), recarregar };
}

function criarEstado<T>() {
  return { opcoes: signal<readonly T[]>([]), falhou: signal(false), carregando: signal(false) };
}

function somenteLeitura<T>(estado: EstadoDoVocabulario<T>) {
  return {
    opcoes: estado.opcoes.asReadonly(),
    falhou: estado.falhou.asReadonly(),
    carregando: estado.carregando.asReadonly(),
  };
}

interface EstadoDoVocabulario<T> {
  opcoes: WritableSignal<readonly T[]>;
  falhou: WritableSignal<boolean>;
  carregando: WritableSignal<boolean>;
}

function lerOpcoes<T>(
  leitura: ReturnType<VocabulariosDeConfiguracaoApi['listar']>,
  destroyRef: DestroyRef,
  estado: EstadoDoVocabulario<T>,
): void {
  estado.falhou.set(false);
  leitura
    .pipe(takeUntilDestroyed(destroyRef), finalize(() => estado.carregando.set(false)))
    .subscribe({
      next: (resultado) =>
        resultado.ok ? estado.opcoes.set(resultado.data as readonly T[]) : estado.falhou.set(true),
      error: () => estado.falhou.set(true),
    });
}
