import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { explicarRegra } from '../../../shared/regra-explicada/regra-em-linguagem-clara';
import { RegraExplicadaComponent } from '../../../shared/regra-explicada/regra-explicada.component';
import { CatalogosDeDistribuicaoService } from '../catalogos-de-distribuicao.service';
import { AlteracaoDoPadraoService } from '../servicos/alteracao-do-padrao.service';
import { PadraoDoEditalService } from '../servicos/padrao-do-edital.service';

/** A regra de distribuição de vagas do edital e o que ela passa a exigir do resto do formulário. */
@Component({
  selector: 'div[selRegraDaDistribuicao]',
  imports: [ValorLegivelDirective, ValorEmConsultaComponent, FormsModule, RegraExplicadaComponent],
  templateUrl: './regra-da-distribuicao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegraDaDistribuicaoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly catalogos = inject(CatalogosDeDistribuicaoService);
  protected readonly padraoDoEdital = inject(PadraoDoEditalService);
  protected readonly alteracao = inject(AlteracaoDoPadraoService);

  /**
   * O `<select>` de regra, só para o cancelamento: `NgModel` só reescreve o `<select>` nativo quando
   * o valor do binding muda, e entre a interação do operador e o cancelamento o modelo interno do
   * `NgModel` já ficou sincronizado com a escolha rejeitada. O Angular não vê mudança nenhuma, e a
   * reescrita do DOM nunca acontece; corrige-se escrevendo o `value` do elemento nativo.
   */
  private readonly campoDeRegra = viewChild<ElementRef<HTMLSelectElement>>('campoRegra');

  /** O que a regra escolhida estabelece. Sem isto, o operador escolhe entre dois códigos sem saber o que cada um faz. */
  protected readonly regraExplicada = computed(() =>
    explicarRegra(this.padraoDoEdital.regraDistribuicaoEscolhida()),
  );

  /** O que a regra escolhida passa a exigir do resto do formulário. */
  protected readonly exigenciasDaRegra = computed<readonly string[]>(() =>
    this.padraoDoEdital.ehFederal()
      ? [
          'referência de reserva demográfica',
          'regra de ajuste (art. 11, § único)',
          'as oito modalidades federais e a ampla concorrência',
        ]
      : ['a quantidade de vagas de cada modalidade, fixada pelo edital'],
  );

  restaurarSelect(): void {
    const elemento = this.campoDeRegra()?.nativeElement;
    if (elemento) elemento.value = this.alteracao.valorDoSelectDeRegra();
  }
}
