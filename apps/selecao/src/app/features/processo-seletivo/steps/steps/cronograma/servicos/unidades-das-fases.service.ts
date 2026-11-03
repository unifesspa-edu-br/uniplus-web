import { computed, inject, Injectable, signal } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { rotuloDaUnidade } from '@uniplus/shared-data/organizacao';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  opcoesComAsGravadas,
  UNIDADE_EM_CARGA,
  UNIDADE_FORA_DO_CADASTRO,
  UNIDADE_SEM_CADASTRO_CARREGADO,
  type UnidadeGravada,
} from '../../../shared/unidades-do-cadastro';
import { CatalogosDoCronogramaService } from '../catalogos-do-cronograma.service';
import type { FaseForm } from '../cronograma-form';

/** As unidades que respondem pelas fases: o que o cadastro oferece, o que o processo gravou e o que o servidor recusou. */
@Injectable()
export class UnidadesDasFases {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDoCronogramaService);

  /**
   * Unidades oferecidas a cada fase: o cadastro e, quando faltar, a unidade que o processo
   * guardou — uma unidade que saiu do cadastro continua sendo a da fase gravada.
   */
  readonly unidadesParaEscolha = computed(() =>
    opcoesComAsGravadas(
      this.catalogos.opcoesDeUnidade(),
      (this.store.remoteSnapshot()?.cronogramaFases ?? []).flatMap((fase) =>
        fase.unidadeResponsavel === null ? [] : [fase.unidadeResponsavel],
      ),
    ),
  );

  /** A unidade que o servidor recusou em cada fase; vale enquanto a fase continua com ela. */
  private readonly unidadesRecusadas = signal<ReadonlyMap<FormGroup<FaseForm>, string>>(new Map());

  /** A cópia da unidade que o processo gravou em cada fase, pelo código da fase. */
  private readonly gravadaPorFase = computed<ReadonlyMap<string, UnidadeGravada>>(
    () =>
      new Map(
        (this.store.remoteSnapshot()?.cronogramaFases ?? []).flatMap((fase) =>
          fase.unidadeResponsavel === null ? [] : [[fase.codigo, fase.unidadeResponsavel] as const],
        ),
      ),
  );

  private readonly rotuloNoCadastro = computed<ReadonlyMap<string, string>>(
    () => new Map(this.unidadesParaEscolha().map((opcao) => [opcao.id, opcao.rotulo] as const)),
  );

  unidadeRecusada(grupo: FormGroup<FaseForm>): boolean {
    return this.unidadesRecusadas().get(grupo) === grupo.controls.unidadeResponsavelId.value;
  }

  /** Guarda a unidade de cada fase enviada que o servidor não encontrou. */
  recusar(enviadas: readonly FormGroup<FaseForm>[], indices: readonly number[]): void {
    const recusadas = indices.flatMap((indice) => {
      const grupo = enviadas[indice];
      return grupo === undefined
        ? []
        : [[grupo, grupo.controls.unidadeResponsavelId.value] as const];
    });
    this.unidadesRecusadas.set(new Map(recusadas));
  }

  limparRecusadas(): void {
    this.unidadesRecusadas.set(new Map());
  }

  /**
   * O rótulo da unidade da fase, ou `null` quando a fase está sem unidade. A cópia gravada na
   * própria fase prevalece sobre o cadastro, que só nomeia a unidade escolhida e ainda não
   * gravada nela. Só afirma que a unidade não está no cadastro depois que o cadastro
   * carregou; antes disso o texto é neutro.
   */
  rotuloDaUnidade(grupo: FormGroup<FaseForm>): string | null {
    const id = grupo.controls.unidadeResponsavelId.value;
    if (id === '') return null;
    const gravada = this.gravadaPorFase().get(grupo.controls.codigo.value);
    const rotulo =
      gravada?.origemId === id ? rotuloDaUnidade(gravada) : this.rotuloNoCadastro().get(id);
    if (rotulo !== undefined) return rotulo;
    if (this.catalogos.unidadesCarregadas()) return UNIDADE_FORA_DO_CADASTRO;
    return this.catalogos.erroDeUnidades() === null
      ? UNIDADE_EM_CARGA
      : UNIDADE_SEM_CADASTRO_CARREGADO;
  }

  /**
   * A unidade que a fase canônica sugere, quando está entre as unidades carregadas; senão a
   * unidade administradora do processo.
   */
  unidadeInicialDaFase(faseCanonicaId: string): string | null {
    const sugerida = this.catalogos.fasePorId().get(faseCanonicaId)?.unidadeSugerida?.origemId;
    if (
      sugerida !== undefined &&
      this.catalogos.opcoesDeUnidade().some((opcao) => opcao.id === sugerida)
    )
      return sugerida;
    return this.store.draft().identificacao.unidadeAdministradoraId || null;
  }
}
