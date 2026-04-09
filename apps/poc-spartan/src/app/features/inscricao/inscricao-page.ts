import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { BrnTabsImports } from '@spartan-ng/brain/tabs';
import { InscricaoFormService } from './services/inscricao-form.service';
import { DadosPessoaisTabComponent } from './components/dados-pessoais-tab/dados-pessoais-tab';
import { DocumentosTabComponent } from './components/documentos-tab/documentos-tab';
import { RevisaoTabComponent } from './components/revisao-tab/revisao-tab';
import { ConfirmacaoDialogComponent } from './components/confirmacao-dialog/confirmacao-dialog';

@Component({
  selector: 'poc-inscricao-page',
  standalone: true,
  imports: [
    ...BrnTabsImports,
    DadosPessoaisTabComponent,
    DocumentosTabComponent,
    RevisaoTabComponent,
    ConfirmacaoDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-govbr-5">
      <h1 class="text-govbr-2xl font-bold text-govbr-primary-dark">
        Inscrição — Processo Seletivo 2026
      </h1>

      <!-- Alert de sucesso -->
      @if (inscricaoEnviada()) {
        <div class="flex items-start gap-govbr-3 p-govbr-4 bg-govbr-success-light border-l-4 border-govbr-success rounded-govbr-sm"
             role="alert">
          <svg class="w-5 h-5 text-govbr-success flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
          <div>
            <p class="text-govbr-base font-semibold text-govbr-success">Inscrição enviada com sucesso!</p>
            <p class="text-govbr-sm text-govbr-gray-60 mt-govbr-1">
              Sua inscrição foi registrada. Acompanhe o status pelo portal do candidato.
            </p>
          </div>
        </div>
      }

      <!-- Alert de erro -->
      @if (mostrarErroValidacao()) {
        <div class="flex items-start gap-govbr-3 p-govbr-4 bg-govbr-danger-light border-l-4 border-govbr-danger rounded-govbr-sm"
             role="alert">
          <svg class="w-5 h-5 text-govbr-danger flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <div>
            <p class="text-govbr-base font-semibold text-govbr-danger">Formulário incompleto</p>
            <p class="text-govbr-sm text-govbr-gray-60 mt-govbr-1">
              Preencha todos os campos obrigatórios antes de enviar.
            </p>
          </div>
        </div>
      }

      <!-- Tabs (Spartan Brain — attribute directives) -->
      <div brnTabs="dados-pessoais" class="block">
        <div brnTabsList
          class="flex border-b border-govbr-gray-10 mb-govbr-5 gap-0">
          <button brnTabsTrigger="dados-pessoais"
            class="px-govbr-5 py-govbr-3 text-govbr-base font-medium text-govbr-gray-60
                   border-b-2 border-transparent cursor-pointer
                   hover:text-govbr-primary hover:border-govbr-gray-20
                   data-[state=active]:text-govbr-primary data-[state=active]:border-govbr-primary
                   data-[state=active]:font-semibold transition-colors">
            Dados Pessoais
          </button>
          <button brnTabsTrigger="documentos"
            class="px-govbr-5 py-govbr-3 text-govbr-base font-medium text-govbr-gray-60
                   border-b-2 border-transparent cursor-pointer
                   hover:text-govbr-primary hover:border-govbr-gray-20
                   data-[state=active]:text-govbr-primary data-[state=active]:border-govbr-primary
                   data-[state=active]:font-semibold transition-colors">
            Documentos
          </button>
          <button brnTabsTrigger="revisao"
            class="px-govbr-5 py-govbr-3 text-govbr-base font-medium text-govbr-gray-60
                   border-b-2 border-transparent cursor-pointer
                   hover:text-govbr-primary hover:border-govbr-gray-20
                   data-[state=active]:text-govbr-primary data-[state=active]:border-govbr-primary
                   data-[state=active]:font-semibold transition-colors">
            Revisão
          </button>
        </div>

        <div brnTabsContent="dados-pessoais">
          <poc-dados-pessoais-tab [form]="form" />
        </div>

        <div brnTabsContent="documentos">
          <poc-documentos-tab [form]="form" />
        </div>

        <div brnTabsContent="revisao">
          <poc-revisao-tab [form]="form" />

          <div class="mt-govbr-6 flex items-center gap-govbr-4">
            <poc-confirmacao-dialog (confirmado)="onConfirmar()" />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class InscricaoPageComponent {
  private readonly formService = inject(InscricaoFormService);
  readonly form = this.formService.createForm();
  readonly inscricaoEnviada = signal(false);
  readonly mostrarErroValidacao = signal(false);

  onConfirmar(): void {
    if (this.form.valid) {
      this.inscricaoEnviada.set(true);
      this.mostrarErroValidacao.set(false);
    } else {
      this.form.markAllAsTouched();
      this.mostrarErroValidacao.set(true);
      this.inscricaoEnviada.set(false);
    }
  }
}
