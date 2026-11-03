import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ControlContainer, ReactiveFormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { PAPEL_DEFINITIVO } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { FaseEmEdicao, type FaseNoSeletor } from '../fase-em-edicao';

/** A conclusão do ciclo recursal da matéria e a promessa de parecer individual. */
@Component({
  selector: 'div[selCicloRecursalDaFase]',
  imports: [ValorLegivelDirective, ReactiveFormsModule, ValorEmConsultaComponent],
  templateUrl: './ciclo-recursal-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) },
  ],
})
export class CicloRecursalDaFaseComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly espelho = this.faseEmEdicao.espelho;

  protected readonly idDaFase = this.faseEmEdicao.idDaFase;
  protected readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  protected readonly publicaPreliminar = this.faseEmEdicao.publicaPreliminar;

  /** Fases que podem concluir o ciclo desta: publicam definitiva e vêm depois. */
  protected readonly concluintesPossiveis = computed<readonly FaseNoSeletor[]>(() => {
    const fase = this.faseEmEdicao.faseDoRascunho();
    if (fase === null) return [];

    const declaradaPorId = new Map(
      this.faseEmEdicao
        .fasesDoCronograma()
        .map((candidata) => [candidata.faseCanonicaId, candidata]),
    );

    return this.faseEmEdicao.fasesNoSeletor().filter((outra) => {
      if (outra.faseCanonicaId === fase.faseCanonicaId || outra.ordem <= fase.ordem) return false;
      const declarada = declaradaPorId.get(outra.faseCanonicaId);
      return declarada?.produtos.some((produto) => produto.papel === PAPEL_DEFINITIVO) === true;
    });
  });

  /** A leitura da consulta: o ciclo e o parecer em texto, sem o controle que os edita. */
  protected faseLida() {
    const form = this.espelho.formulario();
    if (form === null) return null;
    this.espelho.versao();

    const concluinte = form.controls.faseConcluinteCodigo.value;
    const faseConcluinte = this.faseEmEdicao
      .fasesNoSeletor()
      .find((fase) => fase.codigo === concluinte);
    return {
      publicaPreliminar: this.publicaPreliminar(),
      faseQueConclui:
        concluinte === ''
          ? 'Esta fase conclui a si mesma'
          : faseConcluinte
            ? `${faseConcluinte.ordem}. ${faseConcluinte.nome}`
            : concluinte,
      parecerIndividual: form.controls.emiteParecerIndividual.value,
    };
  }
}
