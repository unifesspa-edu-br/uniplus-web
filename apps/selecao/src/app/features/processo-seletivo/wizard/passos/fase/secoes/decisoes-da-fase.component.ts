import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ControlContainer, ReactiveFormsModule } from '@angular/forms';
import { rotuloDoTipoDeDecisao } from '@uniplus/shared-data/selecao';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { TiposDeDecisaoDaFaseOuEtapaComponent } from '../../../shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-fase-ou-etapa.component';
import { FaseEmEdicao } from '../fase-em-edicao';

/** Os tipos de decisão que a fase toma. */
@Component({
  selector: 'sel-decisoes-da-fase',
  imports: [ReactiveFormsModule, ValorEmConsultaComponent, TiposDeDecisaoDaFaseOuEtapaComponent],
  templateUrl: './decisoes-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) },
  ],
})
export class DecisoesDaFaseComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly espelho = this.faseEmEdicao.espelho;

  protected readonly idDaFase = this.faseEmEdicao.idDaFase;

  /** A leitura da consulta: o nome de cada tipo declarado, sem o controle que os edita. */
  protected decisoesLidas(): readonly string[] {
    this.espelho.versao();
    const declarados = this.espelho.formulario()?.controls.tiposDeDecisao.value ?? [];
    return declarados.map(rotuloDoTipoDeDecisao);
  }
}
