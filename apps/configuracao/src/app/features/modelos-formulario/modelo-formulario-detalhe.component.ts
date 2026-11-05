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
import type { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';
import type { EdicaoDoConteudoDoModelo } from './edicao-do-conteudo-do-modelo';

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
  protected readonly documentosExigidos = computed(() => this.conteudo()?.documentosExigidos ?? []);
  protected readonly fatosCitaveisDosDocumentos = computed(() => {
    const conteudo = this.conteudo();
    return conteudo === null ? new Set<string>() : fatosCitaveisPelosTermos(conteudo);
  });
  protected readonly fatosDosDocumentos = computed(() =>
    fatosOferecidos(
      this.fatos(),
      this.fatosCitaveisDosDocumentos(),
      this.documentosExigidos().map((d) => d.quando),
      this.comMunicipios(),
    ),
  );
  protected readonly conteudoAlterado = computed(
    () => JSON.stringify(this.conteudo()) !== JSON.stringify(this.modelo()?.conteudo ?? null),
  );
  protected rotuloDaFinalidade(valor: string): string {
    return FINALIDADES.find((f) => f.valor === valor)?.rotulo ?? valor;
  }
  protected erro(campo: keyof EdicaoDoConteudoDoModelo['form']['controls']): string | null {
    const controle = this.form().controls[campo];
    if (!(controle.touched || controle.dirty) || controle.errors === null) return null;
    const backend = controle.errors['backend'] as { message: string } | undefined;
    if (backend) return backend.message;
    if (controle.errors['required']) return 'Campo obrigatório.';
    if (controle.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }
  focarPrimeiroCampoInvalido(): void {
    void this.editor()?.focarPrimeiroCampoInvalido();
  }
}
