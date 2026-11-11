import { Injectable, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { JanelaDeMigracaoApi } from '@uniplus/shared-data/autorizacao';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../../shared/formulario';
import { LIMITE_DO_MOTIVO } from '../motivo-dialog.component';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { EnvioNaJanela } from './envio-na-janela';

/** O encerramento manual da versão anterior: quem não migrou perde o acesso, com motivo e confirmação. */
@Injectable()
export class EncerramentoDaJanela {
  private readonly api = inject(JanelaDeMigracaoApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly envio = inject(EnvioNaJanela);
  readonly erro = signal<string | null>(null);
  readonly tentou = signal(false);
  /** Cresce a cada tentativa sem sucesso (local ou da API): a tela leva o foco ao que precisa de correção. */
  readonly tentativas = signal(0);
  readonly form = new FormGroup({
    motivo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
    }),
    confirmou: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  confirmar(perfilId: string): Promise<void> {
    this.tentou.set(true);
    this.erro.set(null);
    descartarRecusasDoServidor(this.form);
    const motivo = this.form.controls.motivo.value.trim();
    if (!motivo) this.form.controls.motivo.setErrors({ required: true });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.tentativas.update((n) => n + 1);
      return Promise.resolve();
    }
    return this.escrita.executar(
      'janela',
      () => this.encerrar(perfilId, motivo),
      (mensagem) => this.falhar(mensagem),
    );
  }

  private async encerrar(perfilId: string, motivo: string): Promise<void> {
    const corpo = { motivo, confirmacaoDeExclusao: true };
    const recusa = await this.envio.enviar(`encerramento:${perfilId}`, corpo, (contexto) =>
      this.api.encerrar(perfilId, corpo, contexto),
    );
    if (recusa === null) {
      this.form.reset();
      this.tentou.set(false);
      this.envio.concluir('Janela encerrada');
    } else {
      this.recusar(recusa);
    }
  }

  private recusar(problema: ProblemDetails): void {
    const doMotivo = problema.errors?.find((erro) => erro.field.toLowerCase() === 'motivo');
    if (doMotivo) {
      marcarRecusaDoServidor(this.form.controls.motivo, doMotivo.code, doMotivo.message);
      this.tentativas.update((n) => n + 1);
      return;
    }
    this.falhar(this.envio.tratar(problema));
  }

  private falhar(mensagem: string | null): void {
    this.erro.set(mensagem);
    if (mensagem !== null) this.tentativas.update((n) => n + 1);
  }
}
