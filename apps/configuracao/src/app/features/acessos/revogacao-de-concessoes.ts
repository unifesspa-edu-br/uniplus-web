import { ElementRef, Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  comChave,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { ConcessoesApi, type ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { FALHA_INESPERADA, textoDaRecusa } from './mensagens-de-acesso';
import { LIMITE_DO_MOTIVO } from './motivo-dialog.component';
import { ConcessoesStore } from './concessoes.store';

const CODIGO_EMAIL_DIVERGENTE = 'uniplus.autorizacao.concessao.confirmacao_divergente';

/** Revogação de concessões e suas recusas. */
@Injectable()
export class RevogacaoDeConcessoes {
  private readonly store = inject(ConcessoesStore);
  private readonly api = inject(ConcessoesApi);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly chave = new ChaveDeSubstituicao();
  readonly email = new FormControl('', { nonNullable: true });
  readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
  });
  readonly tentou = signal(false);
  readonly revogando = signal(false);
  readonly enviando = signal(false);
  readonly erroDaRevogacao = signal<string | null>(null);
  readonly erroDoEmail = signal<string | null>(null);
  readonly concessaoARevogar = signal<ConcessaoDto | null>(null);
  pedirRevogacao(concessao: ConcessaoDto): void {
    if (this.enviando()) return;
    this.email.reset('');
    this.motivo.reset('');
    this.tentou.set(false);
    this.concessaoARevogar.set(concessao);
    this.erroDaRevogacao.set(null);
    this.erroDoEmail.set(null);
    this.revogando.set(true);
  }

  confirmar(): void {
    if (this.enviando()) return;
    this.tentou.set(true);
    const motivo = this.motivo.value.trim();
    const email = this.email.value.trim();
    if (!motivo || this.motivo.invalid || !email) {
      if (!motivo) this.motivo.setErrors({ required: true });
      this.focarErro();
      return;
    }
    void this.revogar(motivo, email);
  }

  async revogar(motivo: string, confirmacaoEmail: string): Promise<void> {
    const concessao = this.concessaoARevogar();
    if (concessao === null || this.enviando()) return;
    this.enviando.set(true);
    this.erroDaRevogacao.set(null);
    this.erroDoEmail.set(null);
    try {
      const corpo = { motivo, confirmacaoEmail };
      const { resultado } = await comChave(this.chave, { id: concessao.id, ...corpo }, (contexto) =>
        this.api.revogar(concessao.id, corpo, contexto),
      );
      if (!resultado.ok) {
        const texto = textoDaRecusa(this.problemas.resolve(resultado.problem));
        if (resultado.problem.code === CODIGO_EMAIL_DIVERGENTE) {
          this.erroDoEmail.set(texto);
          this.focarErro();
        } else if (!this.aplicarErrosDeCampo(resultado.problem)) {
          this.erroDaRevogacao.set(texto);
        }
        return;
      }
      this.revogando.set(false);
      this.notificacoes.success('Concessão revogada');
      this.store.recarregar();
    } catch {
      this.erroDaRevogacao.set(FALHA_INESPERADA);
    } finally {
      this.enviando.set(false);
    }
  }
  private aplicarErrosDeCampo(problema: ProblemDetails): boolean {
    let aplicado = false;
    for (const erro of problema.errors ?? []) {
      const campo = erro.field.toLowerCase();
      const controle =
        campo === 'motivo' ? this.motivo : campo === 'confirmacaoemail' ? this.email : null;
      if (!controle) continue;
      controle.setErrors({ backend: { code: erro.code, message: erro.message } });
      controle.markAsTouched();
      aplicado = true;
    }
    if (aplicado) {
      this.tentou.set(true);
      this.focarErro();
    }
    return aplicado;
  }

  private focarErro(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
  }
}
