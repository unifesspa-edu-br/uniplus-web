import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PendenciaDaSecao } from '@uniplus/shared-ui/components';

import type { Operacao } from './gravacao-da-inscricao';

/**
 * O fim da tela de inscrição: o que ainda impede o envio, com a ida a cada pendência, e os botões de
 * salvar o rascunho e enviar. Os botões indisponíveis continuam focáveis e marcam a gravação em
 * curso, para o foco não sair do que foi acionado.
 */
@Component({
  selector: 'ptl-acoes-da-inscricao',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './acoes-da-inscricao.component.html',
  styleUrl: './acoes-da-inscricao.component.css',
})
export class AcoesDaInscricaoComponent {
  /** Por que o envio ainda não segue, ou `null` quando o formulário está válido. */
  readonly motivoDoEnvioBloqueado = input<string | null>(null);
  readonly pendencias = input<readonly PendenciaDaSecao[]>([]);
  /** O processo com mais de uma oferta pede o curso antes de seguir. */
  readonly semCurso = input(false);
  readonly enviada = input(false);
  /** Uma gravação ou releitura em andamento, ou a página que precisa ser recarregada. */
  readonly bloqueada = input(false);
  readonly operacao = input<Operacao | null>(null);

  readonly salvar = output<void>();
  readonly enviar = output<void>();
  readonly irAoCurso = output<void>();
  readonly irAPendencia = output<string>();

  protected readonly envioIndisponivel = computed(
    () => this.bloqueada() || this.motivoDoEnvioBloqueado() !== null,
  );
  protected readonly descricaoDoEnvio = computed(() => {
    const ids = [
      this.motivoDoEnvioBloqueado() ? 'inscricao-motivo-envio' : null,
      this.enviada() ? 'inscricao-correcao' : null,
    ].filter((id) => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  });

  protected pedirParaSalvar(): void {
    if (!this.bloqueada()) this.salvar.emit();
  }

  protected pedirParaEnviar(): void {
    if (!this.envioIndisponivel()) this.enviar.emit();
  }
}
