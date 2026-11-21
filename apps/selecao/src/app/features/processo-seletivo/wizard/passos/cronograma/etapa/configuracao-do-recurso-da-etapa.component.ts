import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import type { RecursoDaEtapa } from '../../../processo-seletivo.models';
import {
  PrazoDoRecursoComponent,
  type IdsDoPrazo,
} from '../../../shared/configuracao-do-recurso/prazo-do-recurso.component';
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

type InstanciaDaSuspensividade = 'PrimeiraInstancia' | 'SegundaInstancia';

const NUMERO_DA_INSTANCIA: Readonly<Record<InstanciaDaSuspensividade, string>> = {
  PrimeiraInstancia: 'susp1',
  SegundaInstancia: 'susp2',
};

/** A configuração de um recurso da etapa: de onde corre o prazo, o prazo, a instância superior e os procedimentos. */
@Component({
  selector: 'sel-configuracao-do-recurso-da-etapa',
  imports: [
    NgTemplateOutlet,
    PrazoDoRecursoComponent,
    ProcedimentosDoRecursoComponent,
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
  protected readonly unidadesDaInterposicao = UNIDADES_DA_INTERPOSICAO;
  protected readonly unidadesDaSuspensividade = UNIDADES_DA_SUSPENSIVIDADE;
  protected readonly catalogoDeAtos = inject(CatalogoDeAtos);
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  private readonly recusas = inject(RecusasDoServidorNasEtapas);
  private readonly sufixo = computed(() => `${this.indiceDaEtapa()}-${this.indiceDoRecurso()}`);

  protected readonly idsDaInterposicao = computed<IdsDoPrazo>(() => ({
    valor: `cr-rec-prazo-${this.sufixo()}`,
    unidade: `cr-rec-un-${this.sufixo()}`,
    recusasDoValor: this.idDaRecusa('prazoValor'),
    recusasDaUnidade: this.idDaRecusa('prazoUnidade'),
  }));
  protected readonly idsDaSuspensividadeDaPrimeiraInstancia = computed(() =>
    this.idsDaSuspensividade('PrimeiraInstancia'),
  );
  protected readonly idsDaSuspensividadeDaSegundaInstancia = computed(() =>
    this.idsDaSuspensividade('SegundaInstancia'),
  );

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

  private idsDaSuspensividade(instancia: InstanciaDaSuspensividade): IdsDoPrazo {
    const prefixo = `cr-rec-${NUMERO_DA_INSTANCIA[instancia]}`;
    return {
      valor: `${prefixo}-val-${this.sufixo()}`,
      unidade: `${prefixo}-un-${this.sufixo()}`,
      recusasDoValor: this.idDaRecusa(`suspensividade${instancia}Valor`),
      recusasDaUnidade: this.idDaRecusa(`suspensividade${instancia}Unidade`),
      ajuda: `cr-rec-susp-ajuda-${this.sufixo()}`,
    };
  }
}
