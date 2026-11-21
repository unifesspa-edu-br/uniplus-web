import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import type { RecursoDaEtapa } from '../../../processo-seletivo.models';
import type { ControleDoRecurso } from '../../../shared/recusas/controle-do-recurso';
import { haRecusaAtiva, type RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import {
  UNIDADES_DA_INTERPOSICAO,
  UNIDADES_DA_SUSPENSIVIDADE,
} from '../../../shared/unidades-de-prazo-do-recurso';
import { CatalogoDeAtos } from '../catalogos/catalogo-de-atos.service';
import type { EtapaForm } from '../cronograma-form';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { ProcedimentosDoRecursoComponent } from '../procedimentos-do-recurso/procedimentos-do-recurso.component';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';
import { RecusasDoServidorNasEtapas } from '../servicos/recusas-do-servidor-nas-etapas.service';

/** O que a tela liga a uma recusa do recurso: um controle dele, ou o recurso inteiro. */
type ControleComRecusa = ControleDoRecurso | 'recurso';

@Component({
  selector: 'sel-janela-recursal',
  imports: [
    NgTemplateOutlet,
    ProcedimentosDoRecursoComponent,
    RecusasDoCampoComponent,
    ValorLegivelDirective,
  ],
  templateUrl: './janela-recursal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JanelaRecursalComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  readonly recursoDaEtapa = input.required<RecursoDaEtapa>();
  readonly indiceDoRecurso = input.required<number>();
  protected readonly unidadesDaInterposicao = UNIDADES_DA_INTERPOSICAO;
  protected readonly unidadesDaSuspensividade = UNIDADES_DA_SUSPENSIVIDADE;
  protected readonly catalogoDeAtos = inject(CatalogoDeAtos);
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  private readonly recusas = inject(RecusasDoServidorNasEtapas);

  /** As recusas do servidor a um controle deste recurso, ativas e a conferir, na ordem em que se leem. */
  protected recusasDe(controle: ControleComRecusa): readonly RecusaOrdenada[] {
    const campo = `recursos.${this.indiceDoRecurso()}.${controle}` as const;
    return this.recusas.recusasDoCampo(this.grupo(), campo);
  }

  /** O `id` do bloco das recusas do controle, que o foco da gravação recusada também alcança. */
  protected idDaRecusa(controle: ControleComRecusa): string {
    return `cr-rec-recusa-${controle}-${this.indiceDaEtapa()}-${this.indiceDoRecurso()}`;
  }

  protected invalido(controle: ControleComRecusa): 'true' | null {
    return haRecusaAtiva(this.recusasDe(controle)) ? 'true' : null;
  }

  /** Os `id` que descrevem o controle: o que ele já tinha (`''` não conta) e as recusas dele, só dele. */
  protected descritoPor(controle: ControleComRecusa, ...outros: readonly string[]): string | null {
    const recusas = this.recusasDe(controle).length > 0 ? [this.idDaRecusa(controle)] : [];
    const ids = [...outros, ...recusas].filter((id) => id !== '');
    return ids.length === 0 ? null : ids.join(' ');
  }
}
