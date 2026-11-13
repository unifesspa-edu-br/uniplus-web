import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { FormGroup } from '@angular/forms';
import { merge, Subscription, take, type Observable } from 'rxjs';

import type { EtapaForm } from '../cronograma-form';
import {
  campoDaRecusa,
  localDoErroDaEtapa,
  recusaDaBancaDaEtapa,
  recusaDoCampoDaEtapa,
  type CampoComRecusa,
} from '../recusas-do-servidor-da-etapa';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';

type ErroDaEtapa = { readonly field: string; readonly code: string; readonly message?: string };

/** Onde o erro do servidor aparece na etapa e o que diz, ou `null` quando não tem campo. */
function alvoDaRecusa(
  erro: ErroDaEtapa,
): { readonly indice: number; readonly campo: CampoComRecusa; readonly texto: string } | null {
  const daBanca = recusaDaBancaDaEtapa(erro);
  if (daBanca !== null) return daBanca;
  const local = localDoErroDaEtapa(erro.field);
  const texto = recusaDoCampoDaEtapa(erro.code);
  const campo = campoDaRecusa(local);
  return local === null || campo === null || texto === null
    ? null
    : { indice: local.indice, campo, texto };
}

const ehDaBanca = (campo: CampoComRecusa): boolean => campo.startsWith('bancas.');

/** Os campos da avaliação se explicam entre si: a mudança de qualquer um desfaz a recusa de todos. */
function mudancasDaAvaliacao({ controls }: FormGroup<EtapaForm>): Observable<unknown> {
  return merge(
    controls.notaMinima.valueChanges,
    controls.notaMaxima.valueChanges,
    controls.passoDoLancamento.valueChanges,
    controls.formaDeAvaliacao.valueChanges,
    controls.regraConsolidacaoCodigo.valueChanges,
    controls.itensDeAvaliacao.valueChanges,
    controls.escalaDeAtendimento.valueChanges,
  );
}

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
   * recusa de todos da etapa. As recusas das bancas têm ciclo próprio: duram até `bancas` mudar, e
   * uma edição da nota não as apaga.
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
  aplicar(enviadas: readonly FormGroup<EtapaForm>[], erros: readonly ErroDaEtapa[]): void {
    for (const [grupo, recusas] of this.recusasDosErros(enviadas, erros)) {
      this.descartar(grupo);
      const assinatura = this.esquecerNaPrimeiraMudancaDe(grupo);
      this.recusasPorEtapa.set(grupo, { recusas, assinatura });
    }
    this.cronograma.versao.update((versao) => versao + 1);
  }

  private recusasDosErros(
    enviadas: readonly FormGroup<EtapaForm>[],
    erros: readonly ErroDaEtapa[],
  ): ReadonlyMap<FormGroup<EtapaForm>, ReadonlyMap<CampoComRecusa, string>> {
    const porEtapa = new Map<FormGroup<EtapaForm>, Map<CampoComRecusa, string>>();
    for (const erro of erros) {
      const alvo = alvoDaRecusa(erro);
      const grupo = alvo === null ? undefined : enviadas[alvo.indice];
      if (alvo === null || grupo === undefined) continue;
      if (!this.cronograma.etapas.controls.includes(grupo)) continue;
      porEtapa.set(grupo, (porEtapa.get(grupo) ?? new Map()).set(alvo.campo, alvo.texto));
    }
    return porEtapa;
  }

  private esquecerNaPrimeiraMudancaDe(grupo: FormGroup<EtapaForm>): Subscription {
    const assinatura = new Subscription();
    assinatura.add(this.esquecerQuandoMudar(grupo, mudancasDaAvaliacao(grupo), false));
    assinatura.add(this.esquecerQuandoMudar(grupo, grupo.controls.bancas.valueChanges, true));
    return assinatura;
  }

  private esquecerQuandoMudar(
    grupo: FormGroup<EtapaForm>,
    mudancas: Observable<unknown>,
    daBanca: boolean,
  ): Subscription {
    return mudancas
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.esquecerAsRecusasDe(grupo, daBanca));
  }

  /** Apaga as recusas das bancas, ou as demais, da etapa; sem nenhuma sobrando, solta a etapa. */
  private esquecerAsRecusasDe(grupo: FormGroup<EtapaForm>, daBanca: boolean): void {
    const atual = this.recusasPorEtapa.get(grupo);
    if (atual === undefined) return;
    const restantes = new Map([...atual.recusas].filter(([campo]) => ehDaBanca(campo) !== daBanca));
    if (restantes.size === 0) this.descartar(grupo);
    else this.recusasPorEtapa.set(grupo, { ...atual, recusas: restantes });
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
