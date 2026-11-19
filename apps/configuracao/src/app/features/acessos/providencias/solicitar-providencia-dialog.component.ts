import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../../shared/formulario';
import { TIPOS_DA_PROVIDENCIA } from './rotulos-da-providencia';
import {
  FUNDAMENTO_MAXIMO,
  FUNDAMENTO_MINIMO,
  SolicitacaoDeProvidencia,
  tamanhoDoFundamento,
} from './solicitacao-de-providencia';

/** O diálogo da solicitação de providência: o tipo e o fundamento, com o contador. */
@Component({
  selector: 'cfg-solicitar-providencia-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DialogComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../../shared/sobreposicao/sobreposicao.css',
  templateUrl: './solicitar-providencia-dialog.component.html',
})
export class SolicitarProvidenciaDialogComponent {
  protected readonly solicitacao = inject(SolicitacaoDeProvidencia);
  protected readonly tipos = TIPOS_DA_PROVIDENCIA;
  protected readonly minimo = FUNDAMENTO_MINIMO;
  protected readonly maximo = FUNDAMENTO_MAXIMO;
  protected readonly mensagem = mensagemDeErroDoControle;
  protected readonly tamanho = toSignal(
    this.solicitacao.form.controls.fundamento.valueChanges.pipe(map(tamanhoDoFundamento)),
    { initialValue: 0 },
  );
  /** O estado do formulário como signal: o erro do tipo acompanha cada escolha e cada recusa. */
  private readonly estado = toSignal(this.solicitacao.form.statusChanges, {
    initialValue: this.solicitacao.form.status,
  });
  /** A falta do tipo ou a recusa da API sobre ele, depois da tentativa de enviar. */
  protected readonly erroDoTipo = computed<string | null>(() => {
    this.estado();
    const controle = this.solicitacao.form.controls.tipo;
    if (!this.solicitacao.tentou() || controle.valid) return null;
    return controle.hasError('required')
      ? 'Escolha a retirada ou a revisão do acesso.'
      : this.mensagem(controle);
  });

  protected erroDoFundamento(): string | null {
    const controle = this.solicitacao.form.controls.fundamento;
    if (!this.solicitacao.tentou() || controle.valid) return null;
    return (
      this.mensagem(controle) ||
      `Explique o fundamento, entre ${this.minimo} e ${this.maximo} caracteres.`
    );
  }

  protected visibilidade(aberto: boolean): void {
    if (!aberto) this.solicitacao.fechar();
  }
}
