import { Injectable, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { TermosDeResponsabilidadeApi } from '@uniplus/shared-data/autorizacao';
import { acompanharLeitura } from '@uniplus/shared-ui/components';
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
  /** A falha da leitura, com "Tentar novamente", no padrão das leituras da tela. */
  readonly falhaDeLeitura = acompanharLeitura({
    assunto: 'termo fixado no pedido',
    falha: this.erro,
    pendente: this.carregando,
    recarregar: () => this.tentarNovamente(),
    destino: () => document.querySelector<HTMLElement>('cfg-termo-de-responsabilidade h2'),
  });
  readonly tentou = signal(false);
  /** A versão fixada no pedido que a tela acompanha; a lida só vale se for ela. */
  private fixada: string | null = null;
  readonly aceite = new FormControl(false, {
    nonNullable: true,
    validators: [Validators.requiredTrue],
  });

  /** Apresenta a versão fixada; sem versão a aceitar, nada é apresentado. */
  acompanhar(versaoId: string | null): void {
    if (versaoId === this.fixada) return;
    this.fixada = versaoId;
    this.aceite.reset(false);
    this.tentou.set(false);
    if (versaoId === null) this.leitura.descartar();
    else void this.leitura.ler(() => this.api.versao(versaoId));
  }

  /** Repete a leitura da versão fixada que falhou. */
  tentarNovamente(): void {
    void this.leitura.tentarNovamente();
  }

  /** Confere que a versão foi lida e aceita; marca a caixa quando não foi. */
  conferirAceite(): boolean {
    this.tentou.set(true);
    return this.versaoApresentada() !== null;
  }

  /**
   * A versão que o aceite apresenta: a fixada no pedido, lida e marcada. `null` quando o pedido não
   * tem termo a aceitar ou quando a versão lida não é a fixada.
   */
  versaoApresentada(): string | null {
    const versao = this.versao();
    return versao !== null && versao.id === this.fixada && this.aceite.value ? versao.id : null;
  }
}
