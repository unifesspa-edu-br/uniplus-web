import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { ProcessoSeletivoStore } from '../processo-seletivo.store';

@Component({
  selector: 'sel-wizard-stepper',
  standalone: true,
  templateUrl: './wizard-stepper.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WizardStepperComponent {
  readonly store = inject(ProcessoSeletivoStore);
  @Input() mobile = false;
  @Output() stepSelected = new EventEmitter<number>();

  select(index: number): void {
    this.store.goTo(index);
    this.stepSelected.emit(index);
  }
}
