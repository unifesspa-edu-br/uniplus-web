import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { AprovacaoDaProtecaoDto } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  type CatalogoAcompanhado,
  DrawerComponent,
  FalhaDeLeituraDoCampoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import {
  CLASSIFICACOES_DE_PROTECAO,
  type OpcaoDeVocabulario,
} from '../../shared/protecao-do-catalogo';
import type { CategoriasDoFormulario } from './categorias-do-formulario';
import { TipoDocumentoAvisosComponent } from './tipo-documento-avisos.component';
import {
  FORMATOS_ACEITOS_OPCOES,
  TipoDocumentoForm,
  mensagemDoCampo,
  mensagemDoCodigo,
  mensagemDoTipoEquivalente,
} from './tipo-documento-form';

@Component({
  selector: 'cfg-tipo-documento-formulario',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    SpinnerComponent,
    TipoDocumentoAvisosComponent,
    FalhaDeLeituraDoCampoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-documento-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class TipoDocumentoFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<TipoDocumentoForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly leituraDasCategorias = input.required<CatalogoAcompanhado>();
  readonly salvando = input.required<boolean>();
  readonly categorias = input.required<CategoriasDoFormulario>();
  readonly hipoteses = input.required<readonly OpcaoDeVocabulario[]>();
  readonly decisao = input.required<AprovacaoDaProtecaoDto | null>();
  readonly avisaNovaAprovacao = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();

  protected readonly formatos = FORMATOS_ACEITOS_OPCOES;
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly titulo = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de documento' : 'Editar tipo de documento',
  );
  protected readonly rotuloDoBotao = computed(() => {
    if (this.salvando()) return 'Salvando...';
    return this.modo() === 'criar' ? 'Criar tipo de documento' : 'Salvar tipo de documento';
  });
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected erroDoCampo(nome: keyof TipoDocumentoForm): string | null {
    const form = this.form();
    if (nome === 'codigo') return mensagemDoCodigo(form.controls.codigo);
    if (nome === 'tipoEquivalente') return mensagemDoTipoEquivalente(form);
    return mensagemDoCampo(form.controls[nome]);
  }

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
