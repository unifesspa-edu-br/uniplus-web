import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';

import { InscricaoFormService, type InscricaoForm } from './services/inscricao-form.service';
import { DadosPessoaisTabComponent } from './components/dados-pessoais-tab/dados-pessoais-tab';
import { DocumentosTabComponent } from './components/documentos-tab/documentos-tab';
import { RevisaoTabComponent } from './components/revisao-tab/revisao-tab';

@Component({
  selector: 'poc-inscricao-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    Dialog,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    DadosPessoaisTabComponent,
    DocumentosTabComponent,
    RevisaoTabComponent,
  ],
  template: `
    <h1 class="text-govbr-2xl font-bold text-govbr-gray-80 mb-govbr-2">
      Inscrição — Processo Seletivo 2026
    </h1>
    <p class="text-govbr-sm text-govbr-gray-60 mb-govbr-5">
      Preencha seus dados, selecione a modalidade de concorrência e revise antes de enviar.
    </p>

    @if (inscricaoEnviada()) {
      <div role="alert" class="poc-message-success flex items-start gap-govbr-3 p-govbr-4 rounded-govbr-sm mb-govbr-5">
        <svg class="poc-message-icon w-5 h-5 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <div>
          <p class="font-semibold text-govbr-sm text-govbr-gray-80">Inscrição enviada com sucesso!</p>
          <p class="text-govbr-sm text-govbr-gray-60 mt-1">Sua inscrição foi registrada. Você receberá um e-mail de confirmação em breve.</p>
        </div>
      </div>
    }

    @if (mostrarErroValidacao()) {
      <div role="alert" class="poc-message-error flex items-start gap-govbr-3 p-govbr-4 rounded-govbr-sm mb-govbr-5">
        <svg class="poc-message-icon w-5 h-5 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p class="font-semibold text-govbr-sm text-govbr-gray-80">Formulário incompleto</p>
          <p class="text-govbr-sm text-govbr-gray-60 mt-1">Preencha todos os campos obrigatórios antes de enviar a inscrição.</p>
        </div>
      </div>
    }

    <p-tabs [value]="0">
      <p-tablist>
        <p-tab [value]="0">Dados Pessoais</p-tab>
        <p-tab [value]="1">Documentos</p-tab>
        <p-tab [value]="2">Revisão</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel [value]="0">
          <poc-dados-pessoais-tab [form]="form" />
        </p-tabpanel>
        <p-tabpanel [value]="1">
          <poc-documentos-tab [form]="form" />
        </p-tabpanel>
        <p-tabpanel [value]="2">
          <div class="flex flex-col gap-govbr-5">
            <poc-revisao-tab [form]="form" />
            <div class="flex justify-end">
              <p-button
                label="Enviar Inscrição"
                (onClick)="dialogVisivel.set(true)"
                data-testid="btn-enviar-inscricao"
              />
            </div>
          </div>
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>

    <p-dialog
      header="Confirmar inscrição"
      [(visible)]="dialogVisivel"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
    >
      <p class="text-govbr-base text-govbr-gray-60">
        Tem certeza que deseja enviar sua inscrição? Após confirmar, os dados serão registrados.
      </p>
      <ng-template #footer>
        <div class="flex justify-end gap-govbr-3">
          <button
            class="inline-flex items-center justify-center gap-2 h-10 px-govbr-5 rounded-govbr-pill font-['Rawline','Raleway',sans-serif] text-[16.8px] font-semibold cursor-pointer transition-colors bg-transparent text-govbr-gray-60 border border-govbr-gray-20 hover:bg-govbr-gray-2"
            data-testid="btn-cancelar"
            (click)="dialogVisivel.set(false)"
          >
            Cancelar
          </button>
          <button
            class="inline-flex items-center justify-center gap-2 h-10 px-govbr-5 rounded-govbr-pill font-['Rawline','Raleway',sans-serif] text-[16.8px] font-semibold cursor-pointer transition-colors bg-govbr-success text-govbr-pure-0 hover:brightness-90"
            data-testid="btn-confirmar"
            (click)="handleConfirmar()"
          >
            Confirmar
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class InscricaoPageComponent {
  private readonly formService = inject(InscricaoFormService);

  readonly form: FormGroup<InscricaoForm> = this.formService.createForm();

  readonly inscricaoEnviada = signal(false);
  readonly mostrarErroValidacao = signal(false);
  readonly dialogVisivel = signal(false);

  handleConfirmar(): void {
    this.dialogVisivel.set(false);
    this.form.markAllAsTouched();

    if (this.form.valid) {
      this.inscricaoEnviada.set(true);
      this.mostrarErroValidacao.set(false);
    } else {
      this.inscricaoEnviada.set(false);
      this.mostrarErroValidacao.set(true);
    }
  }
}
