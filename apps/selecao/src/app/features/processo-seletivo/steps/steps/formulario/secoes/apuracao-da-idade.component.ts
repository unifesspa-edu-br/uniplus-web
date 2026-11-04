import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { desempateIdosoSemApuracao, PASSO_DESEMPATE } from '../../desempate/desempate-por-idade';
import { ancoraEmFase, ANCORAS_DA_IDADE } from '../apuracao-da-idade';
import { fatosCitadosPelasExigencias } from '../fatos-coletados-da-inscricao';

/**
 * A apuração da idade: uma política do processo, e não de um formulário. A idade não é respondida
 * pelo candidato, é apurada contra um instante, e uma única política vale para todo o certame.
 */
@Component({
  selector: 'sel-apuracao-da-idade',
  imports: [ValorEmConsultaComponent, DateBrPipe],
  templateUrl: './apuracao-da-idade.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host { display: block; }'],
})
export class ApuracaoDaIdadeComponent {
  protected readonly store = inject(ProcessoSeletivoStore);

  protected readonly ancoras = ANCORAS_DA_IDADE;

  protected readonly referencia = computed(() => this.store.draft().formulario.referenciaTemporal);

  /** A âncora da apuração como o seletor a nomeia. */
  protected readonly rotuloDaAncora = computed(
    () => this.ancoras.find((opcao) => opcao.valor === this.referencia().tipo)?.rotulo ?? null,
  );

  /** Se a apuração da idade precisa de fase — só então o seletor de fase aparece. */
  protected readonly precisaDeFase = computed(() => ancoraEmFase(this.referencia().tipo));

  /** O desempate por idoso declarado sem apuração da idade neste formulário. */
  protected readonly desempateIdosoSemApuracao = computed(() => {
    if (this.store.emConsulta()) return false;
    const draft = this.store.draft();
    return desempateIdosoSemApuracao(draft.desempate, draft.formulario.referenciaTemporal);
  });

  /** Se alguma exigência condiciona por idade — é o que torna a política obrigatória. */
  protected readonly exigeApuracaoDeIdade = computed(() =>
    fatosCitadosPelasExigencias(this.store.draft().documentos).has('FAIXA_ETARIA'),
  );

  /** As fases do cronograma, para ancorar a apuração da idade. */
  protected readonly fasesEscolhiveis = computed(() =>
    this.store.draft().cronograma.fases.map((fase) => fase.codigo),
  );

  protected irParaDesempate(): void {
    this.store.goTo(PASSO_DESEMPATE);
  }

  protected escreverReferencia(
    patch: Partial<{ tipo: string; data: string; faseCodigo: string }>,
  ): void {
    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      referenciaTemporal: { ...formulario.referenciaTemporal, ...patch },
    });
  }
}
