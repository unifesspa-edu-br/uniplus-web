import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BrnRadioGroupImports } from '@spartan-ng/brain/radio-group';
import { InscricaoForm } from '../../services/inscricao-form.service';
import { MODALIDADES_COTA } from '../../models/inscricao.model';

@Component({
  selector: 'poc-documentos-tab',
  standalone: true,
  imports: [ReactiveFormsModule, ...BrnRadioGroupImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-govbr-6">
      <h2 class="text-govbr-xl font-bold text-govbr-primary-dark mb-govbr-4">
        Documentos e Modalidade
      </h2>

      <!-- Modalidade de Cota (Radio Group via Spartan) -->
      <fieldset class="space-y-govbr-3">
        <legend class="text-govbr-sm font-semibold text-govbr-gray-80 mb-govbr-2">
          Modalidade de concorrência <span class="text-govbr-danger">*</span>
        </legend>
        <brn-radio-group [formControl]="form().controls.modalidadeCota" class="flex flex-col gap-govbr-2">
          @for (modalidade of modalidades; track modalidade.id) {
            <label
              class="flex items-center gap-govbr-2 px-govbr-3 py-govbr-2
                     border border-govbr-gray-10 rounded-govbr-sm
                     bg-govbr-pure-0 cursor-pointer
                     hover:border-govbr-primary hover:bg-govbr-primary-lightest
                     has-[:checked]:border-govbr-primary has-[:checked]:bg-govbr-primary-lightest">
              <brn-radio
                [value]="modalidade.id"
                class="relative w-5 h-5 rounded-full border-2 border-govbr-gray-20
                       data-[state=checked]:border-govbr-primary
                       data-[state=checked]:bg-govbr-primary
                       after:content-[''] after:absolute after:inset-[3px]
                       after:rounded-full after:bg-govbr-pure-0 after:hidden
                       data-[state=checked]:after:block"
              />
              <span class="text-govbr-base text-govbr-gray-80">{{ modalidade.label }}</span>
            </label>
          }
        </brn-radio-group>
        @if (form().controls.modalidadeCota.touched && form().controls.modalidadeCota.errors?.['required']) {
          <span class="text-govbr-xs text-govbr-danger">Selecione uma modalidade de concorrência.</span>
        }
      </fieldset>

      <!-- Opção de Curso (Radio Group) -->
      <fieldset class="space-y-govbr-3">
        <legend class="text-govbr-sm font-semibold text-govbr-gray-80 mb-govbr-2">
          Opção de curso <span class="text-govbr-danger">*</span>
        </legend>
        <brn-radio-group [formControl]="form().controls.opcaoCurso" class="flex gap-govbr-4">
          @for (opcao of opcoesLabel; track opcao.value) {
            <label
              class="flex items-center gap-govbr-2 px-govbr-4 py-govbr-3
                     border border-govbr-gray-10 rounded-govbr-sm
                     bg-govbr-pure-0 cursor-pointer flex-1 justify-center
                     hover:border-govbr-primary hover:bg-govbr-primary-lightest
                     has-[:checked]:border-govbr-primary has-[:checked]:bg-govbr-primary-lightest">
              <brn-radio
                [value]="opcao.value"
                class="relative w-5 h-5 rounded-full border-2 border-govbr-gray-20
                       data-[state=checked]:border-govbr-primary
                       data-[state=checked]:bg-govbr-primary
                       after:content-[''] after:absolute after:inset-[3px]
                       after:rounded-full after:bg-govbr-pure-0 after:hidden
                       data-[state=checked]:after:block"
              />
              <span class="text-govbr-base text-govbr-gray-80 font-medium">{{ opcao.label }}</span>
            </label>
          }
        </brn-radio-group>
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
