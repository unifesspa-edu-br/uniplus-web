import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { InscricaoForm } from '../../services/inscricao-form.service';
import { CURSOS_MOCK, CIDADES_MOCK } from '../../models/inscricao.model';

@Component({
  selector: 'poc-dados-pessoais-tab',
  standalone: true,
  imports: [ReactiveFormsModule],
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
                 focus:border-govbr-primary focus:ring-2 focus:ring-govbr-primary/20
                 placeholder:text-govbr-gray-40"
          [class.border-govbr-danger]="form().controls.nome.touched && form().controls.nome.invalid"
          [class.border-govbr-gray-20]="!(form().controls.nome.touched && form().controls.nome.invalid)"
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
                 focus:border-govbr-primary focus:ring-2 focus:ring-govbr-primary/20
                 placeholder:text-govbr-gray-40"
          [class.border-govbr-danger]="form().controls.cpf.touched && form().controls.cpf.invalid"
          [class.border-govbr-gray-20]="!(form().controls.cpf.touched && form().controls.cpf.invalid)"
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
                 focus:border-govbr-primary focus:ring-2 focus:ring-govbr-primary/20
                 placeholder:text-govbr-gray-40"
          [class.border-govbr-danger]="form().controls.email.touched && form().controls.email.invalid"
          [class.border-govbr-gray-20]="!(form().controls.email.touched && form().controls.email.invalid)"
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

      <!-- Curso (select nativo estilizado Gov.br) -->
      <!-- FINDING: BrnSelect requer BrnPopover para dropdown overlay.
           Sem popover, o conteúdo renderiza inline. Para a PoC, usamos select nativo. -->
      <div class="flex flex-col gap-govbr-1">
        <label for="curso" class="text-govbr-sm font-semibold text-govbr-gray-80">
          Curso <span class="text-govbr-danger">*</span>
        </label>
        <select
          id="curso"
          [formControl]="form().controls.cursoId"
          class="w-full px-govbr-3 py-govbr-2 border rounded-govbr-sm text-govbr-base
                 bg-govbr-pure-0 text-govbr-gray-80 appearance-none
                 border-govbr-gray-20 focus:border-govbr-primary focus:ring-2 focus:ring-govbr-primary/20
                 bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23636363%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')]
                 bg-no-repeat bg-[right_12px_center]">
          <option value="" disabled>Selecione um curso</option>
          @for (curso of cursos; track curso.id) {
            <option [value]="curso.id">{{ curso.nome }}</option>
          }
        </select>
        @if (form().controls.cursoId.touched && form().controls.cursoId.errors?.['required']) {
          <span class="text-govbr-xs text-govbr-danger mt-govbr-1">Selecione um curso.</span>
        }
      </div>

      <!-- Cidade -->
      <div class="flex flex-col gap-govbr-1">
        <label for="cidade" class="text-govbr-sm font-semibold text-govbr-gray-80">
          Cidade de residência <span class="text-govbr-danger">*</span>
        </label>
        <select
          id="cidade"
          [formControl]="form().controls.cidadeId"
          class="w-full px-govbr-3 py-govbr-2 border rounded-govbr-sm text-govbr-base
                 bg-govbr-pure-0 text-govbr-gray-80 appearance-none
                 border-govbr-gray-20 focus:border-govbr-primary focus:ring-2 focus:ring-govbr-primary/20
                 bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23636363%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')]
                 bg-no-repeat bg-[right_12px_center]">
          <option value="" disabled>Selecione uma cidade</option>
          @for (cidade of cidades; track cidade.id) {
            <option [value]="cidade.id">{{ cidade.nome }} — {{ cidade.uf }}</option>
          }
        </select>
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
