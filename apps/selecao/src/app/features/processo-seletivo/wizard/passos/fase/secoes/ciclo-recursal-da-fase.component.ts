import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ControlContainer, ReactiveFormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { PAPEL_DEFINITIVO } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import { FaseEmEdicao, type FaseNoSeletor } from '../fase-em-edicao';

/** A conclusão do ciclo recursal da matéria e a promessa de parecer individual. */
@Component({
  selector: 'sel-ciclo-recursal-da-fase',
  imports: [
    ValorLegivelDirective,
    ReactiveFormsModule,
    ValorEmConsultaComponent,
    RecusasDoCampoComponent,
  ],
  templateUrl: './ciclo-recursal-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
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
  protected readonly problemaLocal = this.faseEmEdicao.problemaLocal;
  protected readonly recusasDoCampo = this.faseEmEdicao.recusasDoCampo;
  protected readonly temMensagem = this.faseEmEdicao.temMensagem;
  protected readonly publicaPreliminar = this.faseEmEdicao.publicaPreliminar;

  /** Fases que podem concluir o ciclo desta: publicam definitiva e vêm depois. */
  protected readonly concluintesPossiveis = computed<readonly FaseNoSeletor[]>(() => {
    const fase = this.faseEmEdicao.faseDoRascunho();
    if (fase === null) return [];

    return this.faseEmEdicao
      .fasesNoSeletor()
      .filter(
        (outra) =>
          outra.faseCanonicaId !== fase.faseCanonicaId &&
          outra.ordem > fase.ordem &&
          this.publicaDefinitiva(outra.faseCanonicaId),
      );
  });

  private publicaDefinitiva(faseCanonicaId: string): boolean {
    const declarada = this.faseEmEdicao
      .fasesDoCronograma()
      .find((candidata) => candidata.faseCanonicaId === faseCanonicaId);
    return declarada?.produtos.some((produto) => produto.papel === PAPEL_DEFINITIVO) === true;
  }

  /** A leitura da consulta: o ciclo e o parecer em texto, sem o controle que os edita. */
  protected faseLida() {
    const form = this.espelho.formulario();
    if (form === null) return null;
    this.espelho.versao();

    return {
      publicaPreliminar: this.publicaPreliminar(),
      faseQueConclui: this.nomeDaFaseQueConclui(form.controls.faseConcluinteCodigo.value),
      parecerIndividual: form.controls.emiteParecerIndividual.value,
    };
  }

  private nomeDaFaseQueConclui(concluinte: string): string {
    if (concluinte === '') return 'Esta fase conclui a si mesma';
    const fase = this.faseEmEdicao
      .fasesNoSeletor()
      .find((candidata) => candidata.codigo === concluinte);
    return fase ? `${fase.ordem}. ${fase.nome}` : concluinte;
  }
}
