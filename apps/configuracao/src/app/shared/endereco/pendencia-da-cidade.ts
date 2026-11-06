import { DestroyRef, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { AbstractControl } from '@angular/forms';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';

const INICIO_DA_PENDENCIA = 'Selecione a cidade do endereço';

/**
 * A recusa local do endereço barrado por falta de cidade, ou `null` quando a cidade não é o
 * problema a mostrar: com o CEP digitado e ainda sem resolver, é o campo do CEP que comunica a
 * pendência e recebe o foco.
 *
 * @param entidade Quem exige a cidade, com artigo (`o campus`).
 */
export function pendenciaDaCidade(endereco: AbstractControl, entidade: string): string | null {
  if (!endereco.hasError('cidadeObrigatoria') || endereco.hasError('cepNaoResolvido')) {
    return null;
  }
  return `${INICIO_DA_PENDENCIA} (obrigatória para ${entidade}).`;
}

/** A pendência da cidade sai da tela quando a busca do CEP ou a escolha manual preenche a cidade. */
export function limparPendenciaDaCidadeAoPreencher(
  endereco: AbstractControl<EnderecoEstruturado | null>,
  erro: WritableSignal<string | null>,
  destroyRef: DestroyRef,
): void {
  endereco.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((valor) => {
    if (valor?.cidade && erro()?.startsWith(INICIO_DA_PENDENCIA)) {
      erro.set(null);
    }
  });
}
