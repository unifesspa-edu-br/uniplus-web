import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';

import { InscricaoFormService, type InscricaoForm } from './services/inscricao-form.service';
import { DadosPessoaisTabComponent } from './components/dados-pessoais-tab/dados-pessoais-tab';
import { DocumentosTabComponent } from './components/documentos-tab/documentos-tab';
import { RevisaoTabComponent } from './components/revisao-tab/revisao-tab';

@Component({
  selector: 'poc-inscricao-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService],
  imports: [
    ButtonModule,
    ConfirmDialog,
    Message,
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
      <p-message
        severity="success"
        styleClass="poc-message-success mb-govbr-5"
        text="Inscrição enviada com sucesso! Sua inscrição foi registrada. Você receberá um e-mail de confirmação em breve."
      />
    }

    @if (mostrarErroValidacao()) {
      <p-message
        severity="error"
        styleClass="poc-message-error mb-govbr-5"
        text="Formulário incompleto. Preencha todos os campos obrigatórios antes de enviar a inscrição."
      />
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
                (onClick)="abrirConfirmacao()"
                data-testid="btn-enviar-inscricao"
              />
            </div>
          </div>
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>

    <p-confirmdialog>
      <ng-template #acceptButton let-acceptCallback="acceptCallback">
        <button
          class="inline-flex items-center justify-center gap-2 h-10 px-govbr-5 rounded-govbr-pill font-['Rawline','Raleway',sans-serif] text-[16.8px] font-semibold cursor-pointer transition-colors bg-govbr-success text-govbr-pure-0 hover:brightness-90"
          data-testid="btn-confirmar"
          (click)="acceptCallback($event)"
        >
          Confirmar
        </button>
      </ng-template>
      <ng-template #rejectButton let-rejectCallback="rejectCallback">
        <button
          class="inline-flex items-center justify-center gap-2 h-10 px-govbr-5 rounded-govbr-pill font-['Rawline','Raleway',sans-serif] text-[16.8px] font-semibold cursor-pointer transition-colors bg-transparent text-govbr-gray-60 border border-govbr-gray-20 hover:bg-govbr-gray-2"
          data-testid="btn-cancelar"
          (click)="rejectCallback($event)"
        >
          Cancelar
        </button>
      </ng-template>
    </p-confirmdialog>
  `,
})
export class InscricaoPageComponent {
  private readonly formService = inject(InscricaoFormService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly form: FormGroup<InscricaoForm> = this.formService.createForm();

  readonly inscricaoEnviada = signal(false);
  readonly mostrarErroValidacao = signal(false);

  abrirConfirmacao(): void {
    this.confirmationService.confirm({
      header: 'Confirmar inscrição',
      message:
        'Tem certeza que deseja enviar sua inscrição? Após confirmar, os dados serão registrados.',
      accept: () => this.handleConfirmar(),
    });
  }

  private handleConfirmar(): void {
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
