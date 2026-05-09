import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { RadioButton } from 'primeng/radiobutton';

import type { InscricaoForm } from '../../services/inscricao-form.service';
import { MODALIDADES_COTA } from '../../models/inscricao.model';

@Component({
  selector: 'poc-documentos-tab',
  standalone: true,
  imports: [ReactiveFormsModule, RadioButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="form()" class="flex flex-col gap-govbr-6">
      <!-- Grupo 1: Modalidade de concorrência -->
      <fieldset class="flex flex-col gap-govbr-3">
        <legend class="text-govbr-md font-semibold text-govbr-gray-80 mb-govbr-2">
          Modalidade de concorrência <span class="text-govbr-danger">*</span>
        </legend>

        @for (mod of modalidades; track mod.id) {
          <div class="flex items-center gap-govbr-2">
            <p-radiobutton
              [inputId]="'mod-' + mod.id"
              name="modalidadeCota"
              [value]="mod.id"
              formControlName="modalidadeCota"
            />
            <label [for]="'mod-' + mod.id" class="text-govbr-base text-govbr-gray-80 cursor-pointer">
              {{ mod.label }}
            </label>
          </div>
        }

        @if (form().controls.modalidadeCota.touched && form().controls.modalidadeCota.invalid) {
          <span class="text-govbr-xs text-govbr-danger">
            Selecione uma modalidade de concorrência
          </span>
        }
      </fieldset>

      <!-- Grupo 2: Opção de curso -->
      <fieldset class="flex flex-col gap-govbr-3">
        <legend class="text-govbr-md font-semibold text-govbr-gray-80 mb-govbr-2">
          Opção de curso <span class="text-govbr-danger">*</span>
        </legend>

        <div class="flex items-center gap-govbr-2">
          <p-radiobutton
            inputId="opcao-primeira"
            name="opcaoCurso"
            value="primeira"
            formControlName="opcaoCurso"
          />
          <label for="opcao-primeira" class="text-govbr-base text-govbr-gray-80 cursor-pointer">
            1ª Opção
          </label>
        </div>
        <div class="flex items-center gap-govbr-2">
          <p-radiobutton
            inputId="opcao-segunda"
            name="opcaoCurso"
            value="segunda"
            formControlName="opcaoCurso"
          />
          <label for="opcao-segunda" class="text-govbr-base text-govbr-gray-80 cursor-pointer">
            2ª Opção
          </label>
        </div>

        @if (form().controls.opcaoCurso.touched && form().controls.opcaoCurso.invalid) {
          <span class="text-govbr-xs text-govbr-danger">
            Selecione uma opção de curso
          </span>
        }
      </fieldset>
    </div>
  `,
})
export class DocumentosTabComponent {
  readonly form = input.required<FormGroup<InscricaoForm>>();
  protected readonly modalidades = MODALIDADES_COTA;
}
