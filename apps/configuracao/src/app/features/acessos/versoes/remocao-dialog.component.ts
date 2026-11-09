import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { PerfilDto } from '@uniplus/shared-data/autorizacao';
import {
  AlertComponent,
  DialogComponent,
  SelectComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../../shared/formulario';
import { focarPrimeiroCampoInvalido } from '../../../shared/foco';
import { LIMITE_DO_MOTIVO } from '../motivo-dialog.component';
import { CATEGORIAS_DA_REMOCAO } from '../perfil-form';
import { sensibilidade } from '../rotulos-de-acesso';
import { EscritaDoPerfil } from './escrita-do-perfil';
import { RemocaoDePermissoes } from './remocao-de-permissoes';

const ID_DO_CORPO = 'cfg-remocao-corpo';
const ID_DO_AVISO = 'cfg-remocao-aviso';

/** Pede as permissões a remover, o motivo e a categoria; a remoção vale na hora para todas as concessões. */
@Component({
  selector: 'cfg-remocao-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DialogComponent,
    SelectComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../../shared/sobreposicao/sobreposicao.css',
  templateUrl: './remocao-dialog.component.html',
})
export class RemocaoDialogComponent {
  readonly perfil = input.required<PerfilDto>();
  protected readonly remocao = inject(RemocaoDePermissoes);
  protected readonly enviando = inject(EscritaDoPerfil).removendo;
  protected readonly permissoes = computed(() => this.perfil().composicaoEmVigor?.permissoes ?? []);
  protected readonly cancelaPendente = computed(() => this.perfil().versaoPendente !== null);
  protected readonly categorias = CATEGORIAS_DA_REMOCAO;
  protected readonly limite = LIMITE_DO_MOTIVO;
  protected readonly sensibilidadeDe = sensibilidade;
  protected readonly idDoCorpo = ID_DO_CORPO;
  protected readonly idDoAviso = ID_DO_AVISO;

  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      if (this.remocao.conferencias() === 0) return;
      afterNextRender(() => this.conduzirAoErro(), { injector: this.injector });
    });
  }

  protected motivoInvalido(): boolean {
    const motivo = this.remocao.form.controls.motivo;
    return motivo.invalid && (motivo.touched || motivo.dirty);
  }

  protected mensagemDoMotivo(): string {
    return mensagemDeErroDoControle(this.remocao.form.controls.motivo) ?? '';
  }

  protected categoriaInvalida(): boolean {
    const categoria = this.remocao.form.controls.categoria;
    return categoria.invalid && (categoria.touched || categoria.dirty);
  }

  protected mensagemDaCategoria(): string {
    return mensagemDeErroDoControle(this.remocao.form.controls.categoria) ?? '';
  }

  protected confirmar(evento: Event): void {
    if (this.enviando()) {
      evento.preventDefault();
      return;
    }
    void this.remocao.confirmar(this.perfil().id);
  }

  /** Depois de renderizar: o primeiro campo recusado, ou o aviso quando a recusa não é de campo. */
  private conduzirAoErro(): void {
    const raiz = document.getElementById(ID_DO_CORPO);
    if (raiz === null) return;
    if (!focarPrimeiroCampoInvalido(raiz)) document.getElementById(ID_DO_AVISO)?.focus();
  }
}
