import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import type { BancaDaEtapa, RegraDeDeliberacaoDaBanca } from '../../../processo-seletivo.models';
import { ListaDeBancasComponent } from '../../../shared/bancas/lista-de-bancas.component';
import type { RecusasDasBancas } from '../../../shared/bancas/recusas-das-bancas';
import { problemasDaRegraPorCampo } from '../../../shared/deliberacao/conferencia-da-regra';
import {
  errosDaBancaPorCampo,
  type CampoDaBanca,
} from '../../../shared/deliberacao/recusas-da-regra';
import { RegraDeDeliberacaoComponent } from '../../../shared/deliberacao/regra-de-deliberacao.component';
import { CatalogoDeBancas } from '../catalogos/catalogo-de-bancas.service';
import type { EtapaForm } from '../cronograma-form';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';
import { RecusasDoServidorNasEtapas } from '../servicos/recusas-do-servidor-nas-etapas.service';

@Component({
  selector: 'sel-bancas-da-etapa',
  imports: [ListaDeBancasComponent, RegraDeDeliberacaoComponent],
  templateUrl: './bancas-da-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BancasDaEtapaComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  protected readonly catalogoDeBancas = inject(CatalogoDeBancas);
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly recusas = inject(RecusasDoServidorNasEtapas);
  protected readonly tipos = computed(() =>
    this.catalogoDeBancas.bancas().map((tipo) => ({
      ...tipo,
      rotulo: tipo.codigo.rotulo,
    })),
  );

  /** As recusas do servidor às bancas, calculadas uma vez a cada mudança e não a cada leitura da tela. */
  protected readonly recusasDasBancas = computed<RecusasDasBancas>(() =>
    this.recusas.recusasDasBancas(this.grupo(), this.edicao.bancasDaEtapa(this.grupo())),
  );

  /** O que a conferência local recusa na regra de cada banca, pelo identificador da banca. */
  protected readonly errosDasRegras = computed(
    () =>
      new Map(
        this.edicao
          .bancasDaEtapa(this.grupo())
          .map((banca) => [banca.identificadorLocal, this.errosDaBanca(banca)]),
      ),
  );

  private errosDaBanca(banca: BancaDaEtapa) {
    const locais: ReadonlyMap<CampoDaBanca, string> = problemasDaRegraPorCampo(
      banca.regraDeDeliberacao,
    );
    return errosDaBancaPorCampo((campo) => locais.get(campo));
  }

  protected alterarRegra(banca: BancaDaEtapa, regra: RegraDeDeliberacaoDaBanca | null): void {
    const bancas = this.edicao
      .bancasDaEtapa(this.grupo())
      .map((atual) =>
        atual.identificadorLocal === banca.identificadorLocal
          ? { ...atual, regraDeDeliberacao: regra }
          : atual,
      );
    this.edicao.escreverBancas(this.grupo(), bancas);
  }
}
