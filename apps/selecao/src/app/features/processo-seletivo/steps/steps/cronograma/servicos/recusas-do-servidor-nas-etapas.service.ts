import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { FormGroup } from '@angular/forms';
import { merge, take, type Subscription } from 'rxjs';

import type { EtapaForm } from '../cronograma-form';
import {
  campoDaRecusa,
  localDoErroDaEtapa,
  recusaDoCampoDaEtapa,
  type CampoComRecusa,
} from '../recusas-do-servidor-da-etapa';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';

const SEM_RECUSAS: ReadonlyMap<CampoComRecusa, string> = new Map();

/** O que o servidor recusou em cada campo da etapa, e que dura até o campo mudar. */
@Injectable()
export class RecusasDoServidorNasEtapas {
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly destroyRef = inject(DestroyRef);

  /** Todas as recusas do servidor à etapa, por campo; o editor dos itens lê as que são dele. */
  recusasDaEtapa(grupo: FormGroup<EtapaForm>): ReadonlyMap<CampoComRecusa, string> {
    this.cronograma.versao();
    return this.recusasPorEtapa.get(grupo)?.recusas ?? SEM_RECUSAS;
  }

  /** A recusa do servidor a um campo da escala da etapa, ou `null`. */
  recusaDoCampo(grupo: FormGroup<EtapaForm>, campo: CampoComRecusa): string | null {
    this.cronograma.versao();
    return this.recusasPorEtapa.get(grupo)?.recusas.get(campo) ?? null;
  }

  /**
   * Os campos da escala e da avaliação se explicam entre si (a nota máxima fora do passo se
   * resolve em qualquer um dos dois; a regra recusada depende da forma): mexer em um apaga a
   * recusa de todos da etapa.
   */
  esquecer(grupo: FormGroup<EtapaForm>): void {
    if (this.descartar(grupo)) this.cronograma.versao.update((versao) => versao + 1);
  }

  private descartar(grupo: FormGroup<EtapaForm>): boolean {
    const atual = this.recusasPorEtapa.get(grupo);
    atual?.assinatura.unsubscribe();
    return this.recusasPorEtapa.delete(grupo);
  }

  /**
   * A recusa fica na etapa que a recebeu, e não na posição: remover ou mover etapas durante a
   * gravação não a leva para outra. Etapa que já saiu do formulário a perde. Ela dura até o
   * valor de um dos campos dela mudar, por digitação ou não.
   */
  aplicar(
    enviadas: readonly FormGroup<EtapaForm>[],
    erros: readonly { readonly field: string; readonly code: string }[],
  ): void {
    const aplicadas = new Map<FormGroup<EtapaForm>, Map<CampoComRecusa, string>>();
    for (const erro of erros) {
      const local = localDoErroDaEtapa(erro.field);
      const texto = recusaDoCampoDaEtapa(erro.code);
      const campo = campoDaRecusa(local);
      const grupo = local === null ? undefined : enviadas[local.indice];
      if (campo === null || texto === null || grupo === undefined) continue;
      if (!this.cronograma.etapas.controls.includes(grupo)) continue;
      aplicadas.set(grupo, (aplicadas.get(grupo) ?? new Map()).set(campo, texto));
    }
    for (const [grupo, recusas] of aplicadas) {
      this.descartar(grupo);
      const assinatura = merge(
        grupo.controls.notaMinima.valueChanges,
        grupo.controls.notaMaxima.valueChanges,
        grupo.controls.passoDoLancamento.valueChanges,
        grupo.controls.formaDeAvaliacao.valueChanges,
        grupo.controls.regraConsolidacaoCodigo.valueChanges,
        grupo.controls.itensDeAvaliacao.valueChanges,
        grupo.controls.escalaDeAtendimento.valueChanges,
      )
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.esquecer(grupo));
      this.recusasPorEtapa.set(grupo, { recusas, assinatura });
    }
    this.cronograma.versao.update((versao) => versao + 1);
  }

  private readonly recusasPorEtapa = new WeakMap<
    FormGroup<EtapaForm>,
    { readonly recusas: ReadonlyMap<CampoComRecusa, string>; readonly assinatura: Subscription }
  >();

  limpar(): void {
    const algumaApagada = this.cronograma.etapas.controls
      .map((grupo) => this.descartar(grupo))
      .some(Boolean);
    if (algumaApagada) this.cronograma.versao.update((versao) => versao + 1);
  }
}
