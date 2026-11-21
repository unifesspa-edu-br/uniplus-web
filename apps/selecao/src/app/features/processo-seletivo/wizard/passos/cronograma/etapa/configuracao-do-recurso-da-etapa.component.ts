import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import type { RecursoDaEtapa } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { ParametrosDoRecursoEmConsultaComponent } from '../../../shared/configuracao-do-recurso/parametros-do-recurso-em-consulta.component';
import { ParametrosDoRecursoComponent } from '../../../shared/configuracao-do-recurso/parametros-do-recurso.component';
import { RecusasDaConfiguracaoDoRecursoComponent } from '../../../shared/configuracao-do-recurso/recusas-da-configuracao-do-recurso.component';
import type { AlteracaoDosParametros } from '../../../shared/configuracao-do-recurso/parametros-do-recurso';
import {
  ehParametroDoRecurso,
  type ControleDoRecurso,
} from '../../../shared/recusas/controle-do-recurso';
import { haRecusaAtiva, type RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import { CatalogoDeAtos } from '../catalogos/catalogo-de-atos.service';
import { etapaDoFormulario, type EtapaForm } from '../cronograma-form';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { ProcedimentosDoRecursoComponent } from '../procedimentos-do-recurso/procedimentos-do-recurso.component';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';
import { RecusasDoServidorNasEtapas } from '../servicos/recusas-do-servidor-nas-etapas.service';
import {
  alvosDaRecusaDaEtapa,
  blocoDasRecusasDoRecursoDaEtapa,
  prefixoDoRecursoDaEtapa,
} from './alvo-da-recusa-da-etapa';

/** O que a tela liga a uma recusa do recurso: um controle dele, ou o recurso inteiro. */
type ControleComRecusa = ControleDoRecurso | 'recurso';

/** A configuração de um recurso da etapa: de onde corre o prazo, os parâmetros e os procedimentos. */
@Component({
  selector: 'sel-configuracao-do-recurso-da-etapa',
  imports: [
    NgTemplateOutlet,
    ParametrosDoRecursoComponent,
    ParametrosDoRecursoEmConsultaComponent,
    ProcedimentosDoRecursoComponent,
    RecusasDaConfiguracaoDoRecursoComponent,
    RecusasDoCampoComponent,
  ],
  templateUrl: './configuracao-do-recurso-da-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguracaoDoRecursoDaEtapaComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  readonly recursoDaEtapa = input.required<RecursoDaEtapa>();
  readonly indiceDoRecurso = input.required<number>();
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly catalogoDeAtos = inject(CatalogoDeAtos);
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  private readonly recusas = inject(RecusasDoServidorNasEtapas);

  protected readonly prefixoDosParametros = computed(() =>
    prefixoDoRecursoDaEtapa(this.indiceDaEtapa(), this.indiceDoRecurso()),
  );

  protected readonly blocoDasRecusas = computed(() =>
    blocoDasRecusasDoRecursoDaEtapa(this.indiceDaEtapa(), this.indiceDoRecurso()),
  );

  /** Todas as recusas ao recurso, na ordem em que se leem. */
  protected readonly recusasDoRecurso = computed(() =>
    this.recusas.recusasDoRecurso(this.grupo(), this.indiceDoRecurso()),
  );

  /** As recusas aos parâmetros, cada uma no nome que o componente comum dá ao campo. */
  protected readonly recusasDosParametros = computed<readonly RecusaOrdenada[]>(() =>
    this.recusasDoRecurso().flatMap((recusa) => {
      const campo = recusa.campo.split('.')[2];
      return ehParametroDoRecurso(campo) ? [{ ...recusa, campo }] : [];
    }),
  );

  /** Onde o foco vai para o campo recusado: o mesmo da gravação recusada. */
  protected readonly alvosDoCampo = (campo: string): readonly string[] =>
    alvosDaRecusaDaEtapa(campo, etapaDoFormulario(this.grupo()), this.indiceDaEtapa(), []);

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

  protected alterarParametro(alteracao: AlteracaoDosParametros): void {
    this.edicao.alterarRecursoDaEtapa(this.grupo(), this.indiceDoRecurso(), alteracao);
  }

  protected escolherOrigemDoPrazo(valor: string): void {
    this.edicao.alterarRecursoDaEtapa(this.grupo(), this.indiceDoRecurso(), {
      campo: 'ancora',
      valor,
    });
  }

  protected escolherPublicacao(valor: string): void {
    this.edicao.alterarRecursoDaEtapa(this.grupo(), this.indiceDoRecurso(), {
      campo: 'atoAncoraCodigo',
      valor,
    });
  }

  protected retirarOPrazoDaSegundaInstancia(): void {
    this.edicao.retirarPrazoDaSegundaInstanciaDaEtapa(this.grupo(), this.indiceDoRecurso());
  }
}
