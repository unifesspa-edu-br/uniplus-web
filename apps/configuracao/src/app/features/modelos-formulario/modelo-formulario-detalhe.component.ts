import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AlertComponent,
  EditorDeDocumentosExigidosComponent,
  EditorDeFormularioComponent,
  FINALIDADES,
  SpinnerComponent,
  TagComponent,
  fatosCitaveisPelosTermos,
  fatosOferecidos,
  type ConteudoDoFormulario,
  type DocumentoExigidoDoFormulario,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import type { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';
import type { EdicaoDoConteudoDoModelo } from './edicao-do-conteudo-do-modelo';

/** Uma leitura por recurso que a tela pode refazer a pedido da pessoa. */
export interface LeiturasEmCurso {
  readonly modelo: boolean;
  readonly termos: boolean;
  readonly catalogo: boolean;
  readonly vocabulario: boolean;
}

@Component({
  selector: 'cfg-modelo-formulario-detalhe',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    EditorDeDocumentosExigidosComponent,
    EditorDeFormularioComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelo-formulario-detalhe.component.html',
  host: { class: 'cfg-page' },
})
export class ModeloFormularioDetalheComponent {
  readonly modelo = input.required<ReturnType<ModeloFormularioEdicaoStore['modelo']>>();
  readonly carregando = input.required<boolean>();
  readonly erroAoCarregar = input.required<string | null>();
  readonly fatos = input.required<ReturnType<ModeloFormularioEdicaoStore['fatos']>>();
  readonly catalogoComErro = input.required<boolean>();
  readonly tiposDeProcesso =
    input.required<ReturnType<ModeloFormularioEdicaoStore['tiposDeProcesso']>>();
  readonly fases = input.required<ReturnType<ModeloFormularioEdicaoStore['fases']>>();
  readonly tiposDeDocumento =
    input.required<ReturnType<ModeloFormularioEdicaoStore['tiposDeDocumento']>>();
  readonly vocabularioDosDocumentosComErro = input.required<boolean>();
  readonly termosDisponiveis =
    input.required<ReturnType<ModeloFormularioEdicaoStore['termosDisponiveis']>>();
  readonly termosComErro = input.required<boolean>();
  readonly form = input.required<EdicaoDoConteudoDoModelo['form']>();
  readonly conteudo = input.required<ConteudoDoFormulario | null>();
  readonly salvando = input.required<boolean>();
  /** A gravação em curso e a espera pela recarga que a segue. */
  readonly somenteLeitura = input.required<boolean>();
  /** Quais leituras estão em curso: cada alerta se liga à do próprio recurso. */
  readonly tentando = input.required<LeiturasEmCurso>();
  readonly recusas = input.required<ReturnType<EdicaoDoConteudoDoModelo['recusas']>>();
  readonly recusasGerais = input.required<readonly string[]>();
  readonly recusasDosDocumentos =
    input.required<ReturnType<EdicaoDoConteudoDoModelo['recusasDosDocumentos']>>();
  readonly comMunicipios = input.required<boolean>();
  readonly salvar = output<void>();
  readonly recarregar = output<void>();
  readonly recarregarTermos = output<void>();
  readonly recarregarCatalogo = output<void>();
  readonly recarregarVocabulario = output<void>();
  readonly conteudoChange = output<ConteudoDoFormulario>();
  readonly documentosChange = output<readonly DocumentoExigidoDoFormulario[]>();
  private readonly editor = viewChild(EditorDeFormularioComponent);
  readonly documentosExigidos = computed(() => this.conteudo()?.documentosExigidos ?? []);
  readonly fatosCitaveisDosDocumentos = computed(() => {
    const conteudo = this.conteudo();
    return conteudo === null ? new Set<string>() : fatosCitaveisPelosTermos(conteudo);
  });
  readonly fatosDosDocumentos = computed(() =>
    fatosOferecidos(
      this.fatos(),
      this.fatosCitaveisDosDocumentos(),
      this.documentosExigidos().map((d) => d.quando),
      this.comMunicipios(),
    ),
  );
  readonly conteudoAlterado = computed(
    () => JSON.stringify(this.conteudo()) !== JSON.stringify(this.modelo()?.conteudo ?? null),
  );
  constructor() {
    acompanharFocoDoEnvio({
      salvando: this.somenteLeitura,
      aberto: computed(() => this.modelo() !== null),
    });
  }

  rotuloDaFinalidade(valor: string): string {
    return FINALIDADES.find((f) => f.valor === valor)?.rotulo ?? valor;
  }
  protected erro(campo: keyof EdicaoDoConteudoDoModelo['form']['controls']): string | null {
    return mensagemDeErroDoControle(this.form().controls[campo]);
  }
  focarPrimeiroCampoInvalido(): void {
    void this.editor()?.focarPrimeiroCampoInvalido();
  }
}
