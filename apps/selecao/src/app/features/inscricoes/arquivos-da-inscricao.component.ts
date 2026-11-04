import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AlertComponent, TagComponent } from '@uniplus/shared-ui/components';

import type { RecusaAoAbrir } from './abertura-de-arquivo';
import type { ArquivoExibido } from './exibicao-da-inscricao';
import { rotuloDaSituacaoDoArquivo, varianteDaSituacaoDoArquivo } from './situacao-do-arquivo';

/**
 * Os arquivos que o candidato enviou, um por linha, cada um com a situação e o botão que o abre. Com
 * um arquivo sendo aberto, os botões ficam indisponíveis, mas continuam focáveis: o foco não sai do
 * que foi acionado.
 */
@Component({
  selector: 'sel-arquivos-da-inscricao',
  standalone: true,
  imports: [AlertComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arquivos-da-inscricao.component.html',
  styleUrl: './arquivos-da-inscricao.component.css',
})
export class ArquivosDaInscricaoComponent {
  readonly arquivos = input.required<readonly ArquivoExibido[]>();
  /** O arquivo cujo acesso está sendo pedido, ou `null`. */
  readonly abrindo = input<string | null>(null);
  readonly recusa = input<RecusaAoAbrir | null>(null);

  /** O candidato pediu para abrir o arquivo; emitido dentro do clique, que o navegador exige. */
  readonly abrir = output<string>();

  protected readonly rotuloDaSituacaoDoArquivo = rotuloDaSituacaoDoArquivo;
  protected readonly varianteDaSituacaoDoArquivo = varianteDaSituacaoDoArquivo;

  protected pedirParaAbrir(arquivoId: string): void {
    if (this.abrindo() === null) this.abrir.emit(arquivoId);
  }
}
