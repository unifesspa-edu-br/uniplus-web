import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { explicarRegra } from '../../../shared/regra-explicada/regra-em-linguagem-clara';
import { RegraExplicadaComponent } from '../../../shared/regra-explicada/regra-explicada.component';
import { regraPorChave } from '../../../shared/regra-por-chave';
import { CatalogosDeDistribuicaoService } from '../catalogos-de-distribuicao.service';
import { AlteracaoDoPadraoService } from '../servicos/alteracao-do-padrao.service';
import { PadraoDoEditalService } from '../servicos/padrao-do-edital.service';

/** A regra de ajuste que a Lei 12.711 exige no ramo federal. */
@Component({
  selector: 'div[selRegraDeAjuste]',
  imports: [ValorLegivelDirective, ValorEmConsultaComponent, FormsModule, RegraExplicadaComponent],
  templateUrl: './regra-de-ajuste.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegraDeAjusteComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly catalogos = inject(CatalogosDeDistribuicaoService);
  protected readonly padraoDoEdital = inject(PadraoDoEditalService);
  protected readonly alteracao = inject(AlteracaoDoPadraoService);

  protected readonly ajusteExplicado = computed(() =>
    explicarRegra(
      regraPorChave(
        this.catalogos.regrasAjuste(),
        this.padraoDoEdital.padrao().regraAjusteCodigo,
        this.padraoDoEdital.padrao().regraAjusteVersao,
      ),
    ),
  );
}
