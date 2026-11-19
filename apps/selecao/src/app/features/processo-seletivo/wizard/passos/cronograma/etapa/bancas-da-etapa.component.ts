import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import type { BancaDaEtapa, RegraDeDeliberacaoDaBanca } from '../../../processo-seletivo.models';
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

type ErrosDaBanca = Partial<Record<CampoDaBanca, string>>;

/** Uma banca declarada na etapa, com o nome que o cadastro lhe dá e o que a regra dela recusa. */
interface BancaEscolhida {
  readonly tipoBancaId: string;
  readonly nome: string;
  readonly regra: RegraDeDeliberacaoDaBanca | null;
  readonly erros: ErrosDaBanca;
}

@Component({
  selector: 'sel-bancas-da-etapa',
  imports: [RegraDeDeliberacaoComponent],
  templateUrl: './bancas-da-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BancasDaEtapaComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  protected readonly catalogoDeBancas = inject(CatalogoDeBancas);
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  private readonly recusas = inject(RecusasDoServidorNasEtapas);

  /** As bancas declaradas na etapa, na ordem em que o comando as leva. */
  protected readonly escolhidas = computed<readonly BancaEscolhida[]>(() => {
    const etapa = this.grupo();
    const nomes = new Map(this.catalogoDeBancas.bancas().map((banca) => [banca.id, banca.nome]));
    return this.edicao.bancasDaEtapa(etapa).map((banca, posicao) => ({
      tipoBancaId: banca.tipoBancaId,
      nome: nomes.get(banca.tipoBancaId) ?? banca.tipoBancaId,
      regra: banca.regraDeDeliberacao,
      erros: this.errosDaBanca(etapa, banca, posicao),
    }));
  });

  /** A conferência local vem primeiro: descreve o estado atual, e a recusa, o que foi enviado. */
  private errosDaBanca(
    etapa: FormGroup<EtapaForm>,
    banca: BancaDaEtapa,
    posicao: number,
  ): ErrosDaBanca {
    const locais: ReadonlyMap<CampoDaBanca, string> = problemasDaRegraPorCampo(
      banca.regraDeDeliberacao,
    );
    const erroDe = (campo: CampoDaBanca): string | null =>
      locais.get(campo) ?? this.recusas.recusaDoCampo(etapa, `bancas.${posicao}.${campo}`);
    return errosDaBancaPorCampo(erroDe);
  }
}
