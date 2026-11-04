import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FileUploadComponent } from '@uniplus/shared-ui/components';

import {
  EXTENSOES_DO_ANEXO,
  LIMITE_DE_ANEXOS,
  TAMANHO_MAXIMO_DO_ANEXO_MB,
  nomeNoDownload,
  recusaDoNomeDoAnexo,
} from '../wizard/shared/anexos-do-edital/anexos-do-edital';
import type { ArquivoDoAto, EnviosDeArquivos } from './envios-de-arquivos';

/**
 * Os anexos opcionais do documento: o envio dos arquivos e, para cada um já selado, o campo do
 * nome com que a pessoa o recebe ao baixar. A lista de envios é do formulário, que a esvazia a
 * cada abertura e confere o nome de cada anexo antes de publicar.
 */
@Component({
  selector: 'sel-anexos-da-publicacao',
  imports: [FileUploadComponent],
  templateUrl: './anexos-da-publicacao.component.html',
  styleUrl: './anexos-da-publicacao.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', 'aria-labelledby': 'pub-anexos-titulo' },
})
export class AnexosDaPublicacaoComponent {
  readonly envios = input.required<EnviosDeArquivos>();
  readonly desabilitado = input(false);

  protected readonly extensoesDoAnexo = EXTENSOES_DO_ANEXO;
  protected readonly limiteDeAnexos = LIMITE_DE_ANEXOS;
  protected readonly tamanhoMaximoMb = TAMANHO_MAXIMO_DO_ANEXO_MB;

  protected renomear(arquivo: ArquivoDoAto, evento: Event): void {
    this.envios().renomear(arquivo.id, (evento.target as HTMLInputElement).value);
  }

  protected recusaDoNome(arquivo: ArquivoDoAto): string | null {
    return recusaDoNomeDoAnexo(arquivo.nome, arquivo.nomeArquivo);
  }

  protected nomeBaixado(arquivo: ArquivoDoAto): string {
    return nomeNoDownload(arquivo.nome, arquivo.nomeArquivo);
  }
}
