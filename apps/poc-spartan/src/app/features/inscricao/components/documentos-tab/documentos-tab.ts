import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { InscricaoForm } from '../../services/inscricao-form.service';
import { MODALIDADES_COTA } from '../../models/inscricao.model';

@Component({
  selector: 'poc-documentos-tab',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .govbr-radio-indicator {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid #cccccc;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: border-color 0.15s, background-color 0.15s;
    }
    .govbr-radio-indicator::after {
      content: '';
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: white;
      transform: scale(0);
      transition: transform 0.15s;
    }
    input:checked + .govbr-radio-indicator {
      border-color: #1351b4;
      background-color: #1351b4;
    }
    input:checked + .govbr-radio-indicator::after {
      transform: scale(1);
    }
  `,
  template: `
    <div class="space-y-govbr-6">
      <h2 class="text-govbr-xl font-bold text-govbr-primary-dark mb-govbr-4">
        Documentos e Modalidade
      </h2>

      <!-- Modalidade de Cota -->
      <fieldset class="space-y-govbr-3">
        <legend class="text-govbr-sm font-semibold text-govbr-gray-80 mb-govbr-2">
          Modalidade de concorrência <span class="text-govbr-danger">*</span>
        </legend>
        <div class="flex flex-col gap-govbr-2" role="radiogroup" aria-label="Modalidade de concorrência">
          @for (modalidade of modalidades; track modalidade.id) {
            <label
              class="flex items-center gap-govbr-3 py-govbr-2 cursor-pointer group">
              <input type="radio"
                [formControl]="form().controls.modalidadeCota"
                [value]="modalidade.id"
                class="sr-only" />
              <span class="govbr-radio-indicator"></span>
              <span class="text-govbr-base text-govbr-gray-80">{{ modalidade.label }}</span>
            </label>
          }
        </div>
        @if (form().controls.modalidadeCota.touched && form().controls.modalidadeCota.errors?.['required']) {
          <span class="text-govbr-xs text-govbr-danger">Selecione uma modalidade de concorrência.</span>
        }
      </fieldset>

      <!-- Opção de Curso -->
      <fieldset class="space-y-govbr-3">
        <legend class="text-govbr-sm font-semibold text-govbr-gray-80 mb-govbr-2">
          Opção de curso <span class="text-govbr-danger">*</span>
        </legend>
        <div class="flex gap-govbr-6" role="radiogroup" aria-label="Opção de curso">
          @for (opcao of opcoesLabel; track opcao.value) {
            <label
              class="flex items-center gap-govbr-3 py-govbr-2 cursor-pointer group">
              <input type="radio"
                [formControl]="form().controls.opcaoCurso"
                [value]="opcao.value"
                class="sr-only" />
              <span class="govbr-radio-indicator"></span>
              <span class="text-govbr-base text-govbr-gray-80 font-medium">{{ opcao.label }}</span>
            </label>
          }
        </div>
        @if (form().controls.opcaoCurso.touched && form().controls.opcaoCurso.errors?.['required']) {
          <span class="text-govbr-xs text-govbr-danger">Selecione a opção de curso.</span>
        }
      </fieldset>
    </div>
  `,
})
export class DocumentosTabComponent {
  readonly form = input.required<FormGroup<InscricaoForm>>();
  readonly modalidades = MODALIDADES_COTA;
  readonly opcoesLabel = [
    { value: 'primeira', label: '1ª Opção' },
    { value: 'segunda', label: '2ª Opção' },
  ];
}
