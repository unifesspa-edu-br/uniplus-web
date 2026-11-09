import { Injectable, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import type { CategoriaDaRemocao } from '@uniplus/shared-data/autorizacao';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../../shared/formulario';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { LIMITE_DO_MOTIVO } from '../motivo-dialog.component';
import { EnvioDaVersao } from './envio-da-versao';
import { EscritaDoPerfil } from './escrita-do-perfil';

const SEM_PERMISSAO = 'Marque ao menos uma permissão a remover.';

/** A remoção avulsa: retira permissões da versão em vigor, na hora e com motivo. */
@Injectable()
export class RemocaoDePermissoes {
  private readonly envio = inject(EnvioDaVersao);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  readonly aberto = signal(false);
  readonly erro = signal<string | null>(null);
  readonly erroDasPermissoes = signal<string | null>(null);
  readonly selecionadas = signal<ReadonlySet<string>>(new Set());
  readonly tentou = signal(false);
  readonly form = new FormGroup({
    motivo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
    }),
    categoria: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly quantidade = computed(() => this.selecionadas().size);

  abrir(): void {
    if (this.escrita.gravando()) return;
    this.form.reset({ motivo: '', categoria: '' });
    this.selecionadas.set(new Set());
    this.erro.set(null);
    this.erroDasPermissoes.set(null);
    this.tentou.set(false);
    this.aberto.set(true);
  }

  alternar(codigo: string): void {
    const proximas = new Set(this.selecionadas());
    if (!proximas.delete(codigo)) proximas.add(codigo);
    this.selecionadas.set(proximas);
    this.erroDasPermissoes.set(null);
  }

  confirmar(perfilId: string): Promise<void> {
    this.tentou.set(true);
    this.erro.set(null);
    descartarRecusasDoServidor(this.form);
    if (this.selecionadas().size === 0) this.erroDasPermissoes.set(SEM_PERMISSAO);
    if (this.form.invalid) this.form.markAllAsTouched();
    if (this.form.invalid || this.selecionadas().size === 0) return Promise.resolve();
    return this.escrita.executar(
      'remocao',
      () => this.remover(perfilId),
      (mensagem) => this.erro.set(mensagem),
    );
  }

  private async remover(perfilId: string): Promise<void> {
    const desfecho = await this.envio.executar(
      { tipo: 'remocao', perfilId, corpo: this.corpo() },
      () => undefined,
    );
    if (desfecho.tipo === 'recusado') {
      this.recusar(desfecho.problema);
      return;
    }
    this.aberto.set(false);
    this.notificacoes.success('Permissões removidas');
    this.escrita.recarregar();
  }

  private corpo() {
    const { motivo, categoria } = this.form.getRawValue();
    return {
      permissoes: [...this.selecionadas()].sort(),
      motivo: motivo.trim(),
      categoria: categoria as CategoriaDaRemocao,
    };
  }

  private recusar(problema: ProblemDetails): void {
    const campos = problema.errors ?? [];
    for (const erro of campos) this.aplicar(erro.field, erro.code, erro.message);
    if (campos.length === 0) {
      this.erro.set(mensagemDaRecusa(this.problemas, this.notificacoes, problema));
    }
  }

  private aplicar(campo: string, code: string, message: string): void {
    const nome = campo.toLowerCase();
    if (nome === 'permissoes') this.erroDasPermissoes.set(message);
    else if (nome === 'motivo') marcarRecusaDoServidor(this.form.controls.motivo, code, message);
    else if (nome === 'categoria') marcarRecusaDoServidor(this.form.controls.categoria, code, message);
    else this.erro.set(message);
  }
}
