import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  NomesDeMunicipios,
  ValorDeMunicipioComponent,
  ValorLegivelDirective,
} from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { ErroDoCampoComponent } from './erro-do-campo.component';
import { GravacaoDaIdentificacao } from './servicos/gravacao-da-identificacao.service';

/** O município cujo calendário rege os prazos do processo. */
@Component({
  selector: 'sel-municipio-do-processo',
  imports: [ValorLegivelDirective, ValorDeMunicipioComponent, ErroDoCampoComponent],
  templateUrl: './municipio-do-processo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class MunicipioDoProcessoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly nomes = inject(NomesDeMunicipios);
  protected readonly gravacao = inject(GravacaoDaIdentificacao);

  readonly invalido = input.required<boolean>();

  /** O combobox do município: o rótulo do campo aponta para o id que ele gera. */
  protected readonly campoDoMunicipio = viewChild(ValorDeMunicipioComponent);

  protected readonly bloqueado = computed(() => this.store.cadastroInicialCongelado());

  protected escolher(codigos: readonly string[]): void {
    const municipio = this.nomes.municipio(codigos[0] ?? '');
    if (municipio === null) return;
    const { codigoIbge, nome, uf } = municipio;
    this.store.patchObjectSection('identificacao', { localidade: { codigoIbge, nome, uf } });
    this.gravacao.retirarRecusa('localidade');
  }

  protected trocar(): void {
    this.store.patchObjectSection('identificacao', { localidade: null });
    this.gravacao.retirarRecusa('localidade');
  }
}
