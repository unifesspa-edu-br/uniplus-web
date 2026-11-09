import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { VersaoPendenteDto } from '@uniplus/shared-data/autorizacao';
import {
  AlertComponent,
  FileUploadComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import type { AcoesDoPerfil } from './estado-do-perfil';
import { ResumoDaVersaoComponent } from './resumo-da-versao.component';
import { etapaDaVersao } from './rotulos-da-versao';

const DOCUMENTO_ENVIAVEL: readonly string[] = ['aguardando_envio', 'recusado'];

/** A versão pendente de um perfil, com o envio do documento que falta e o cancelamento. */
@Component({
  selector: 'cfg-versao-pendente',
  standalone: true,
  imports: [AlertComponent, FileUploadComponent, ResumoDaVersaoComponent, SpinnerComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './versao-pendente.component.html',
})
export class VersaoPendenteComponent {
  readonly versao = input.required<VersaoPendenteDto>();
  readonly nomeVigente = input.required<string>();
  readonly descricaoVigente = input.required<string>();
  readonly acoes = input.required<AcoesDoPerfil>();
  readonly indisponivel = input.required<boolean>();
  readonly enviandoDocumento = input.required<boolean>();
  readonly erroDoDocumento = input.required<string | null>();
  readonly cancelar = output<void>();
  readonly abrirDocumento = output<void>();
  readonly documentoEscolhido = output<File | null>();
  protected readonly etapa = etapaDaVersao;
  protected readonly recusado = computed(() => this.versao().situacaoDoDocumento === 'recusado');
  protected readonly faltaDocumento = computed(() =>
    DOCUMENTO_ENVIAVEL.includes(this.versao().situacaoDoDocumento),
  );
}
