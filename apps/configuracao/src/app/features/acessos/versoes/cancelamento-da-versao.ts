import { ElementRef, Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  comChave,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { VersoesDoPerfilApi } from '@uniplus/shared-data/autorizacao';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../../shared/formulario';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { LIMITE_DO_MOTIVO } from '../motivo-dialog.component';
import { EscritaDoPerfil } from './escrita-do-perfil';

/** O cancelamento da versão pendente: o motivo fica na trilha e a versão sai da fila de aprovação. */
@Injectable()
export class CancelamentoDaVersao {
  private readonly api = inject(VersoesDoPerfilApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly chave = new ChaveDeSubstituicao();
  readonly aberto = signal(false);
  readonly erro = signal<string | null>(null);
  readonly tentou = signal(false);
  readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
  });

  abrir(): void {
    if (this.escrita.gravando()) return;
    this.motivo.reset('');
    this.erro.set(null);
    this.tentou.set(false);
    this.aberto.set(true);
  }

  confirmar(perfilId: string, versaoId: string): Promise<void> {
    this.tentou.set(true);
    descartarRecusasDoServidor(this.motivo);
    const motivo = this.motivo.value.trim();
    if (!motivo) this.motivo.setErrors({ required: true });
    if (this.motivo.invalid) {
      this.focarMotivo();
      return Promise.resolve();
    }
    return this.escrita.executar(
      'cancelamento',
      () => this.cancelar(perfilId, versaoId, motivo),
      (mensagem) => this.erro.set(mensagem),
    );
  }

  private async cancelar(perfilId: string, versaoId: string, motivo: string): Promise<void> {
    this.erro.set(null);
    const { resultado } = await comChave(this.chave, { perfilId, versaoId, motivo }, (contexto) =>
      this.api.cancelar(perfilId, versaoId, motivo, contexto),
    );
    if (!resultado.ok) {
      this.recusar(resultado.problem);
      return;
    }
    this.aberto.set(false);
    this.notificacoes.success('Versão pendente cancelada');
    this.escrita.recarregar();
  }

  private recusar(problema: ProblemDetails): void {
    const doMotivo = problema.errors?.find((erro) => erro.field.toLowerCase() === 'motivo');
    if (doMotivo) {
      marcarRecusaDoServidor(this.motivo, doMotivo.code, doMotivo.message);
      this.focarMotivo();
      return;
    }
    this.erro.set(mensagemDaRecusa(this.problemas, this.notificacoes, problema));
  }

  private focarMotivo(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('cfg-motivo-dialog [aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }
}
