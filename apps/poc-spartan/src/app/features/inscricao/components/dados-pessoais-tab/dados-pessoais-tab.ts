import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  BrnSelect,
  BrnSelectTrigger,
  BrnSelectContent,
  BrnSelectList,
  BrnSelectItem,
  BrnSelectPlaceholder,
} from '@spartan-ng/brain/select';
import { InscricaoForm } from '../../services/inscricao-form.service';
import { CURSOS_MOCK, CIDADES_MOCK } from '../../models/inscricao.model';

@Component({
  selector: 'poc-dados-pessoais-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    BrnSelect,
    BrnSelectTrigger,
    BrnSelectContent,
    BrnSelectList,
    BrnSelectItem,
    BrnSelectPlaceholder,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-govbr-5">
      <h2 class="text-govbr-xl font-bold text-govbr-primary-dark mb-govbr-4">
        Dados Pessoais
      </h2>

      <!-- Nome -->
      <div class="flex flex-col gap-govbr-1">
        <label for="nome" class="text-govbr-sm font-semibold text-govbr-gray-80">
          Nome completo <span class="text-govbr-danger">*</span>
        </label>
        <input
          id="nome"
          type="text"
          [formControl]="form().controls.nome"
          placeholder="Digite seu nome completo"
          class="w-full px-govbr-3 py-govbr-2 border rounded-govbr-sm text-govbr-base
                 bg-govbr-pure-0 text-govbr-gray-80
                 border-govbr-gray-20 focus:border-govbr-primary focus:ring-2 focus:ring-govbr-primary/20
                 placeholder:text-govbr-gray-40"
          [class.border-govbr-danger]="form().controls.nome.touched && form().controls.nome.invalid"
        />
        @if (form().controls.nome.touched && form().controls.nome.invalid) {
          <span class="text-govbr-xs text-govbr-danger mt-govbr-1">
            @if (form().controls.nome.hasError('required')) {
              Nome é obrigatório.
            } @else if (form().controls.nome.hasError('minlength')) {
              Nome deve ter pelo menos 3 caracteres.
            }
          </span>
        }
      </div>

      <!-- CPF -->
      <div class="flex flex-col gap-govbr-1">
        <label for="cpf" class="text-govbr-sm font-semibold text-govbr-gray-80">
          CPF <span class="text-govbr-danger">*</span>
        </label>
        <input
          id="cpf"
          type="text"
          [formControl]="form().controls.cpf"
          placeholder="000.000.000-00"
          maxlength="14"
          class="w-full px-govbr-3 py-govbr-2 border rounded-govbr-sm text-govbr-base
                 bg-govbr-pure-0 text-govbr-gray-80
                 border-govbr-gray-20 focus:border-govbr-primary focus:ring-2 focus:ring-govbr-primary/20
                 placeholder:text-govbr-gray-40"
          [class.border-govbr-danger]="form().controls.cpf.touched && form().controls.cpf.invalid"
        />
        @if (form().controls.cpf.touched && form().controls.cpf.invalid) {
          <span class="text-govbr-xs text-govbr-danger mt-govbr-1">
            @if (form().controls.cpf.hasError('required')) {
              CPF é obrigatório.
            } @else if (form().controls.cpf.hasError('cpfInvalido')) {
              CPF inválido.
            }
          </span>
        }
      </div>

      <!-- Email -->
      <div class="flex flex-col gap-govbr-1">
        <label for="email" class="text-govbr-sm font-semibold text-govbr-gray-80">
          E-mail <span class="text-govbr-danger">*</span>
        </label>
        <input
          id="email"
          type="email"
          [formControl]="form().controls.email"
          placeholder="seu.email@exemplo.com"
          class="w-full px-govbr-3 py-govbr-2 border rounded-govbr-sm text-govbr-base
                 bg-govbr-pure-0 text-govbr-gray-80
                 border-govbr-gray-20 focus:border-govbr-primary focus:ring-2 focus:ring-govbr-primary/20
                 placeholder:text-govbr-gray-40"
          [class.border-govbr-danger]="form().controls.email.touched && form().controls.email.invalid"
        />
        @if (form().controls.email.touched && form().controls.email.invalid) {
          <span class="text-govbr-xs text-govbr-danger mt-govbr-1">
            @if (form().controls.email.hasError('required')) {
              E-mail é obrigatório.
            } @else if (form().controls.email.hasError('email')) {
              E-mail inválido.
            }
          </span>
        }
      </div>

      <!-- Curso (Spartan Select — attribute directives) -->
      <div class="flex flex-col gap-govbr-1">
        <label class="text-govbr-sm font-semibold text-govbr-gray-80">
          Curso <span class="text-govbr-danger">*</span>
        </label>
        <div brnSelect [formControl]="form().controls.cursoId" placeholder="Selecione um curso">
          <button brnSelectTrigger
            class="flex items-center justify-between w-full px-govbr-3 py-govbr-2 border rounded-govbr-sm
                   bg-govbr-pure-0 text-govbr-gray-80 text-govbr-base cursor-pointer
                   border-govbr-gray-20 hover:border-govbr-primary">
            <span brnSelectPlaceholder></span>
          </button>
          <div brnSelectContent
            class="bg-govbr-pure-0 border border-govbr-gray-10 rounded-govbr-sm shadow-lg mt-1 max-h-60 overflow-y-auto">
            <div brnSelectList>
              @for (curso of cursos; track curso.id) {
                <div brnSelectItem [value]="curso.id"
                  class="px-govbr-3 py-govbr-2 text-govbr-base text-govbr-gray-80
                         hover:bg-govbr-primary-lightest cursor-pointer
                         data-[selected]:bg-govbr-primary data-[selected]:text-govbr-pure-0">
                  {{ curso.nome }}
                </div>
              }
            </div>
          </div>
        </div>
        @if (form().controls.cursoId.touched && form().controls.cursoId.errors?.['required']) {
          <span class="text-govbr-xs text-govbr-danger mt-govbr-1">Selecione um curso.</span>
        }
      </div>

      <!-- Cidade -->
      <div class="flex flex-col gap-govbr-1">
        <label class="text-govbr-sm font-semibold text-govbr-gray-80">
          Cidade de residência <span class="text-govbr-danger">*</span>
        </label>
        <div brnSelect [formControl]="form().controls.cidadeId" placeholder="Selecione uma cidade">
          <button brnSelectTrigger
            class="flex items-center justify-between w-full px-govbr-3 py-govbr-2 border rounded-govbr-sm
                   bg-govbr-pure-0 text-govbr-gray-80 text-govbr-base cursor-pointer
                   border-govbr-gray-20 hover:border-govbr-primary">
            <span brnSelectPlaceholder></span>
          </button>
          <div brnSelectContent
            class="bg-govbr-pure-0 border border-govbr-gray-10 rounded-govbr-sm shadow-lg mt-1 max-h-60 overflow-y-auto">
            <div brnSelectList>
              @for (cidade of cidades; track cidade.id) {
                <div brnSelectItem [value]="cidade.id"
                  class="px-govbr-3 py-govbr-2 text-govbr-base text-govbr-gray-80
                         hover:bg-govbr-primary-lightest cursor-pointer
                         data-[selected]:bg-govbr-primary data-[selected]:text-govbr-pure-0">
                  {{ cidade.nome }} — {{ cidade.uf }}
                </div>
              }
            </div>
          </div>
        </div>
        @if (form().controls.cidadeId.touched && form().controls.cidadeId.errors?.['required']) {
          <span class="text-govbr-xs text-govbr-danger mt-govbr-1">Selecione uma cidade.</span>
        }
      </div>
    </div>
  `,
})
export class DadosPessoaisTabComponent {
  readonly form = input.required<FormGroup<InscricaoForm>>();
  readonly cursos = CURSOS_MOCK;
  readonly cidades = CIDADES_MOCK;
}
