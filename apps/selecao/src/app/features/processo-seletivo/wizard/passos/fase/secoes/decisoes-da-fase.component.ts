import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ControlContainer, ReactiveFormsModule } from '@angular/forms';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { rotuloDoTipoDeDecisaoLido } from '../../../shared/hidratacao/rotulo-do-tipo-de-decisao-lido';
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
  private readonly rotuloLido = computed(() =>
    rotuloDoTipoDeDecisaoLido(this.store.remoteSnapshot()),
  );

  /** A leitura da consulta: o nome de cada tipo declarado, como o processo lido o traz. */
  protected decisoesLidas(): readonly string[] {
    this.espelho.versao();
    const declarados = this.espelho.formulario()?.controls.tiposDeDecisao.value ?? [];
    return declarados.map(this.rotuloLido());
  }
}
