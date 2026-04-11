import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import type { InscricaoForm } from '../../services/inscricao-form.service';
import { CURSOS_MOCK, CIDADES_MOCK } from '../../models/inscricao.model';

@Component({
  selector: 'poc-dados-pessoais-tab',
  standalone: true,
  imports: [ReactiveFormsModule, InputText, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="form()" class="grid grid-cols-1 md:grid-cols-2 gap-govbr-5">
      <!-- Nome -->
      <div class="flex flex-col gap-govbr-1 md:col-span-2">
        <label
          for="nome"
          class="text-govbr-sm font-semibold text-govbr-gray-80"
        >
          Nome completo <span class="text-govbr-danger">*</span>
        </label>
        <input
          pInputText
          id="nome"
          type="text"
          formControlName="nome"
          placeholder="Digite seu nome completo"
          [class.!border-govbr-danger]="
            form().controls.nome.touched && form().controls.nome.invalid
          "
        />
        @if (form().controls.nome.touched && form().controls.nome.invalid) {
          @if (form().controls.nome.errors?.['required']) {
            <span class="text-govbr-xs text-govbr-danger">Nome é obrigatório</span>
          } @else if (form().controls.nome.errors?.['minlength']) {
            <span class="text-govbr-xs text-govbr-danger">Mínimo de 3 caracteres</span>
          }
        }
      </div>

      <!-- CPF -->
      <div class="flex flex-col gap-govbr-1">
        <label for="cpf" class="text-govbr-sm font-semibold text-govbr-gray-80">
          CPF <span class="text-govbr-danger">*</span>
        </label>
        <input
          pInputText
          id="cpf"
          type="text"
          formControlName="cpf"
          placeholder="000.000.000-00"
          [class.!border-govbr-danger]="
            form().controls.cpf.touched && form().controls.cpf.invalid
          "
        />
        @if (form().controls.cpf.touched && form().controls.cpf.invalid) {
          @if (form().controls.cpf.errors?.['required']) {
            <span class="text-govbr-xs text-govbr-danger">CPF é obrigatório</span>
          } @else if (form().controls.cpf.errors?.['cpfInvalido']) {
            <span class="text-govbr-xs text-govbr-danger">CPF inválido</span>
          }
        }
      </div>

      <!-- Email -->
      <div class="flex flex-col gap-govbr-1">
        <label for="email" class="text-govbr-sm font-semibold text-govbr-gray-80">
          E-mail <span class="text-govbr-danger">*</span>
        </label>
        <input
          pInputText
          id="email"
          type="email"
          formControlName="email"
          placeholder="seu.email@exemplo.com"
          [class.!border-govbr-danger]="
            form().controls.email.touched && form().controls.email.invalid
          "
        />
        @if (form().controls.email.touched && form().controls.email.invalid) {
          @if (form().controls.email.errors?.['required']) {
            <span class="text-govbr-xs text-govbr-danger">E-mail é obrigatório</span>
          } @else if (form().controls.email.errors?.['email']) {
            <span class="text-govbr-xs text-govbr-danger">E-mail inválido</span>
          }
        }
      </div>

      <!-- Curso -->
      <div class="flex flex-col gap-govbr-1">
        <label for="curso" class="text-govbr-sm font-semibold text-govbr-gray-80">
          Curso pretendido <span class="text-govbr-danger">*</span>
        </label>
        <p-select
          id="curso"
          formControlName="cursoId"
          [options]="cursos"
          optionLabel="nome"
          optionValue="id"
          placeholder="Selecione um curso"
          ariaLabel="Curso pretendido"
        />
      </div>

      <!-- Cidade -->
      <div class="flex flex-col gap-govbr-1">
        <label for="cidade" class="text-govbr-sm font-semibold text-govbr-gray-80">
          Cidade <span class="text-govbr-danger">*</span>
        </label>
        <p-select
          id="cidade"
          formControlName="cidadeId"
          [options]="cidades"
          optionLabel="label"
          optionValue="id"
          placeholder="Selecione uma cidade"
          ariaLabel="Cidade"
        />
      </div>
    </div>
  `,
})
export class DadosPessoaisTabComponent {
  readonly form = input.required<FormGroup<InscricaoForm>>();
  protected readonly cursos = CURSOS_MOCK;
  protected readonly cidades = CIDADES_MOCK.map((c) => ({
    ...c,
    label: `${c.nome} — ${c.uf}`,
  }));
}
