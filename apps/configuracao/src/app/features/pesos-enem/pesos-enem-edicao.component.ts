import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, SpinnerComponent, TagComponent } from '@uniplus/shared-ui/components';
import { AreaPesoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { focarPrimeiroCampoInvalido } from '../../shared/foco';
import type { EstadoOperacao } from './edicao-dos-parametros';
import { NumeroDigitadoValidoDirective } from './numero-digitado-valido.directive';
import { PesosEnemColunasComponent } from './pesos-enem-colunas.component';
import { mensagemDoCampoNumerico } from './pesos-enem-campo-numerico';
import { AreaForm, FormularioDeEdicao } from './pesos-enem-form';
import { CORTE_MAXIMO, PESO_MAXIMO, type CampoDaArea } from './pesos-enem-limites';
import { PesosEnemNotaComponent } from './pesos-enem-nota.component';
import {
  descritoPor,
  idCampo,
  rotuloDaArea,
  rotuloDoGrupo,
  sufixoDoRotulo,
} from './pesos-enem-rotulos';

/** A grade de uma resolução em edição: o peso e o corte de cada área, por grupo de curso. */
@Component({
  selector: 'div[cfgPesosEnemEdicao]',
  standalone: true,
  imports: [
    AlertComponent,
    NumeroDigitadoValidoDirective,
    PesosEnemColunasComponent,
    PesosEnemNotaComponent,
    ReactiveFormsModule,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pesos-enem-edicao.component.html',
  styleUrl: './pesos-enem-edicao.component.css',
  host: {
    class: 'num-grid pe-grid is-editing',
    tabindex: '-1',
    '[style.--pe-colunas]': 'areas().length',
    '[attr.aria-label]': '"Pesos do ENEM — " + resolucao()',
    '(keydown.escape)': 'cancelar.emit()',
  },
})
export class PesosEnemEdicaoComponent {
  readonly resolucao = input.required<string>();
  readonly areas = input.required<readonly AreaPesoAreaEnemDto[]>();
  readonly form = input.required<FormularioDeEdicao>();
  readonly estadoLinhas = input.required<ReadonlyMap<string, EstadoOperacao>>();
  readonly erro = input.required<string | null>();
  /** Há escrita em curso, de qualquer tipo, ou a recarga que a segue. */
  readonly gravando = input.required<boolean>();
  /** Os pesos desta resolução estão sendo enviados. */
  readonly salvando = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();

  protected readonly PESO_MAXIMO = PESO_MAXIMO;
  protected readonly CORTE_MAXIMO = CORTE_MAXIMO;
  protected readonly descritoPor = descritoPor;
  protected readonly rotuloDoGrupo = rotuloDoGrupo;

  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private estavaSalvando = false;

  constructor() {
    // Terminado o envio, o foco vai ao primeiro campo recusado; sem campo recusado, fica no botão.
    effect(() => {
      const salvando = this.salvando();
      const terminou = this.estavaSalvando && !salvando;
      this.estavaSalvando = salvando;
      if (terminou) {
        this.focarPrimeiroInvalido();
      }
    });
  }

  protected idCampo(resolucao: string, grupo: number, area: number, campo: CampoDaArea): string {
    return idCampo(resolucao, grupo, area, campo);
  }

  protected erroDaArea(area: FormGroup<AreaForm>, campo: CampoDaArea): string | null {
    return mensagemDoCampoNumerico(area.controls[campo], campo);
  }

  protected rotuloDaArea(codigo: string): string {
    return rotuloDaArea(this.areas(), codigo);
  }

  protected sufixo(codigo: string, grupo: string): string {
    return sufixoDoRotulo(this.rotuloDaArea(codigo), grupo);
  }

  /** `aria-disabled` não impede o clique sozinho: o botão fica focável durante o envio, e a ação é barrada aqui. */
  protected aoSalvar(): void {
    if (this.gravando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.focarPrimeiroInvalido();
  }

  private focarPrimeiroInvalido(): void {
    afterNextRender(() => focarPrimeiroCampoInvalido(this.raiz), { injector: this.injector });
  }
}
