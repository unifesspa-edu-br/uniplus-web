import { Injectable, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { TermosDeResponsabilidadeApi } from '@uniplus/shared-data/autorizacao';
import { acompanharLeitura } from '@uniplus/shared-ui/components';
import { LeituraDoTermo } from './leitura-do-termo';

/**
 * O termo vigente apresentado na criação de todo pedido de perfil protegido (UNI-REQ-0377). No
 * pedido próprio sem documento, o envio é o aceite (ADR-0162); nos demais, a versão só é informada e
 * o beneficiário a aceita no pedido, depois da verificação. Quando a API diz que a vigente mudou, a
 * tela troca o texto, desmarca o aceite e avisa.
 */
@Injectable()
export class TermoNaCriacao {
  private readonly api = inject(TermosDeResponsabilidadeApi);
  private readonly leitura = new LeituraDoTermo();
  readonly versao = this.leitura.versao;
  readonly carregando = this.leitura.carregando;
  readonly erro = this.leitura.erro;
  /** A falha da leitura, com "Tentar novamente", no padrão das leituras da tela. */
  readonly falhaDeLeitura = acompanharLeitura({
    assunto: 'termo vigente',
    falha: this.erro,
    pendente: this.carregando,
    recarregar: () => this.tentarNovamente(),
    destino: () => document.querySelector<HTMLElement>('cfg-termo-de-responsabilidade h2'),
  });
  readonly aviso = signal<string | null>(null);
  /** Depois de um 409, se o envio é o aceite; o aviso da mudança espera a leitura da versão nova. */
  private mudancaAAvisar: boolean | null = null;
  readonly aceite = new FormControl(false, {
    nonNullable: true,
    validators: [Validators.requiredTrue],
  });

  /** Lê a vigente na primeira vez em que o pedido passa a exigir o termo. */
  garantir(): void {
    if (this.versao() === null && !this.carregando())
      void this.leitura.ler(() => this.api.vigente());
  }

  /**
   * A versão que o envio apresenta, ou `null` enquanto não há versão lida ou, quando o envio é o
   * aceite, enquanto ele não foi marcado.
   */
  apresentada(envioEOAceite: boolean): string | null {
    const versao = this.versao();
    return versao !== null && (this.aceite.value || !envioEOAceite) ? versao.id : null;
  }

  /** Repete a leitura da vigente que falhou; depois de um 409, a versão nova chega com o aviso. */
  tentarNovamente(): void {
    void this.lerVigente();
  }

  /**
   * A vigente mudou: a versão rejeitada sai na hora, e o envio fica bloqueado até a nova chegar. O
   * texto novo substitui o anterior e o aceite precisa ser dado de novo. O aviso só sai quando a
   * versão nova é lida, inclusive pela retentativa depois de uma falha.
   */
  async trocarPelaVigente(envioEOAceite: boolean): Promise<void> {
    this.aceite.reset(false);
    this.aviso.set(null);
    this.mudancaAAvisar = envioEOAceite;
    await this.lerVigente();
  }

  private async lerVigente(): Promise<void> {
    if (!(await this.leitura.ler(() => this.api.vigente()))) return;
    if (this.mudancaAAvisar === null) return;
    this.avisar(this.mudancaAAvisar);
    this.mudancaAAvisar = null;
  }

  private avisar(envioEOAceite: boolean): void {
    const numero = this.versao()?.numero;
    const proximoPasso = envioEOAceite
      ? 'Leia o texto novo e marque o aceite de novo para enviar.'
      : 'Leia o texto novo e envie de novo.';
    this.aviso.set(
      `O termo de responsabilidade foi atualizado para a versão ${numero}. ${proximoPasso}`,
    );
  }
}
