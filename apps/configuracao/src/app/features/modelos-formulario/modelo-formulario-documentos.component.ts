import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  EditorDeDocumentosExigidosComponent,
  fatosCitaveisPelosTermos,
  fatosOferecidos,
  type ConteudoDoFormulario,
  type DocumentoExigidoDoFormulario,
} from '@uniplus/shared-ui/components';
import type { EdicaoDoConteudoDoModelo } from './edicao-do-conteudo-do-modelo';
import type { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';

type Edicao = EdicaoDoConteudoDoModelo;
type Store = ModeloFormularioEdicaoStore;

/** Os documentos que o modelo exige: o editor, com os fatos que as condições podem citar. */
@Component({
  selector: 'cfg-modelo-formulario-documentos',
  imports: [EditorDeDocumentosExigidosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelo-formulario-documentos.component.html',
})
export class ModeloFormularioDocumentosComponent {
  readonly conteudo = input.required<ConteudoDoFormulario>();
  readonly fatos = input.required<ReturnType<Store['fatos']>>();
  readonly fases = input.required<ReturnType<Store['fases']>>();
  readonly tiposDeDocumento = input.required<ReturnType<Store['tiposDeDocumento']>>();
  readonly recusas = input.required<ReturnType<Edicao['recusasDosDocumentos']>>();
  /** A gravação em curso e a espera pela recarga que a segue. */
  readonly somenteLeitura = input.required<boolean>();
  readonly comMunicipios = input.required<boolean>();
  readonly documentosChange = output<readonly DocumentoExigidoDoFormulario[]>();

  readonly documentosExigidos = computed(() => this.conteudo().documentosExigidos ?? []);
  readonly fatosCitaveis = computed(() => fatosCitaveisPelosTermos(this.conteudo()));
  readonly fatosDosDocumentos = computed(() =>
    fatosOferecidos(
      this.fatos(),
      this.fatosCitaveis(),
      this.documentosExigidos().map((d) => d.quando),
      this.comMunicipios(),
    ),
  );
}
