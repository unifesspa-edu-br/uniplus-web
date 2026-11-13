import { Injectable, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { TermosDeResponsabilidadeApi } from '@uniplus/shared-data/autorizacao';
import { LeituraDoTermo } from './leitura-do-termo';

/**
 * A versão do termo fixada no pedido, apresentada ao beneficiário que aceita o pedido depois da
 * verificação do documento ou do pedido feito por outra pessoa. O aceite informa essa versão.
 */
@Injectable()
export class TermoDoPedido {
  private readonly api = inject(TermosDeResponsabilidadeApi);
  private readonly leitura = new LeituraDoTermo();
  readonly versao = this.leitura.versao;
  readonly carregando = this.leitura.carregando;
  readonly erro = this.leitura.erro;
  readonly tentou = signal(false);
  readonly aceite = new FormControl(false, {
    nonNullable: true,
    validators: [Validators.requiredTrue],
  });

  /** Apresenta a versão fixada; sem versão a aceitar, nada é apresentado. */
  acompanhar(versaoId: string | null): void {
    if (versaoId === null) {
      this.versao.set(null);
      return;
    }
    if (this.versao()?.id === versaoId || this.carregando()) return;
    this.aceite.reset(false);
    this.tentou.set(false);
    void this.leitura.ler(() => this.api.versao(versaoId));
  }

  /** Confere que a versão foi lida e aceita; marca a caixa quando não foi. */
  conferirAceite(): boolean {
    this.tentou.set(true);
    return this.versaoApresentada() !== null;
  }

  /** A versão que o aceite apresenta, ou `null` quando o pedido não tem termo a aceitar. */
  versaoApresentada(): string | null {
    const versao = this.versao();
    return versao !== null && this.aceite.value ? versao.id : null;
  }
}
