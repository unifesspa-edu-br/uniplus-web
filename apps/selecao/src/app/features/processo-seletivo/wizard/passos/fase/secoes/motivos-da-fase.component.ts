import { ChangeDetectionStrategy, Component, ElementRef, computed, inject } from '@angular/core';
import {
  FalhaDeLeituraComponent,
  RecusaDoCampoComponent,
  acompanharLeitura,
} from '@uniplus/shared-ui/components';

import { MotivosDaFaseOuEtapaComponent } from '../../../shared/motivos/motivos-da-fase-ou-etapa.component';
import { FaseEmEdicao } from '../fase-em-edicao';
import { MotivosDaFaseStore } from '../motivos/motivos-da-fase.store';

/**
 * Os motivos de decisão que a fase escolhe. Repassa ao componente comum o que o servidor tem e
 * grava cada escolha na hora, pela `MotivosDaFaseStore`, que o passo da fase fornece: a lista
 * mostrada é a do servidor, e a fase precisa estar gravada no cronograma para escolher.
 */
@Component({
  selector: 'sel-motivos-da-fase',
  imports: [FalhaDeLeituraComponent, MotivosDaFaseOuEtapaComponent, RecusaDoCampoComponent],
  templateUrl: './motivos-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class MotivosDaFaseComponent {
  protected readonly motivos = inject(MotivosDaFaseStore);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly espelho = this.faseEmEdicao.espelho;
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly faseOuEtapa = computed(() => ({ faseChave: this.faseEmEdicao.faseAberta() }));
  protected readonly nomeDaFase = this.faseEmEdicao.nomeDaFaseAberta;
  protected readonly idBase = computed(() => this.faseEmEdicao.idDaFase('motivos'));

  protected readonly aguardaOCronograma = computed(
    () => this.motivos.modo() !== 'consulta' && !this.motivos.faseGravada(),
  );

  /** Os tipos de decisão que a fase declara agora no formulário, ainda que não gravados. */
  protected readonly tiposDeclarados = computed(() => {
    this.espelho.versao();
    return this.espelho.formulario()?.controls.tiposDeDecisao.value ?? [];
  });

  protected readonly leitura = acompanharLeitura({
    falha: this.motivos.falhaDeLeitura,
    pendente: this.motivos.lendo,
    recarregar: () => void this.motivos.recarregar(),
    destino: () => this.elemento.nativeElement.querySelector<HTMLElement>('[tabindex="-1"]'),
  });

  constructor() {
    this.motivos.carregar();
  }
}
