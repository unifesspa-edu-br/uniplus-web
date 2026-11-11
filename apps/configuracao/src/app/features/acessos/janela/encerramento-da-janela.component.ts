import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { focarPrimeiroCampoInvalido } from '../../../shared/foco';
import { mensagemDeErroDoControle } from '../../../shared/formulario';
import { LIMITE_DO_MOTIVO } from '../motivo-dialog.component';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { EncerramentoDaJanela } from './encerramento-da-janela';

const ID_DO_FORMULARIO = 'cfg-encerramento-formulario';
const ID_DO_ERRO = 'cfg-encerramento-erro';

/** O encerramento manual da versão anterior, com motivo e a confirmação de que quem não migrou perde o acesso. */
@Component({
  selector: 'cfg-encerramento-da-janela',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './encerramento-da-janela.component.html',
})
export class EncerramentoDaJanelaComponent {
  readonly perfilId = input.required<string>();

  protected readonly encerramento = inject(EncerramentoDaJanela);
  protected readonly gravando = inject(EscritaDoPerfil).gravando;
  protected readonly limite = LIMITE_DO_MOTIVO;
  protected readonly idDoFormulario = ID_DO_FORMULARIO;
  protected readonly idDoErro = ID_DO_ERRO;
  protected readonly mensagem = mensagemDeErroDoControle;
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      if (this.encerramento.tentativas() === 0) return;
      afterNextRender(() => this.conduzirAoErro(), { injector: this.injector });
    });
  }

  protected motivoInvalido(): boolean {
    const motivo = this.encerramento.form.controls.motivo;
    return motivo.invalid && (motivo.touched || motivo.dirty);
  }

  protected confirmacaoPendente(): boolean {
    return this.encerramento.tentou() && this.encerramento.form.controls.confirmou.invalid;
  }

  protected enviar(): void {
    void this.encerramento.confirmar(this.perfilId());
  }

  /** Depois de renderizar: o primeiro campo recusado, ou o aviso quando a recusa não é de campo. */
  private conduzirAoErro(): void {
    const raiz = document.getElementById(ID_DO_FORMULARIO);
    if (raiz === null) return;
    if (!focarPrimeiroCampoInvalido(raiz)) document.getElementById(ID_DO_ERRO)?.focus();
  }
}
