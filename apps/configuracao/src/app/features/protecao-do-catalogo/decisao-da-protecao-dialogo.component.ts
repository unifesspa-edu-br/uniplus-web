import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  type DecisaoDaProtecao,
  type DetalheDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import {
  CLASSIFICACOES_DE_PROTECAO,
  nomeDoCadastro,
  rotuloDe,
} from '../../shared/protecao-do-catalogo';
import { JUSTIFICATIVA_MAXIMA } from './decisao-da-protecao-form';

@Component({
  selector: 'cfg-decisao-da-protecao-dialogo',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DialogComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decisao-da-protecao-dialogo.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class DecisaoDaProtecaoDialogoComponent {
  readonly aberto = input.required<boolean>();
  readonly detalhe = input.required<DetalheDaProtecaoDoCatalogoDto | null>();
  readonly decisao = input.required<DecisaoDaProtecao>();
  readonly decidindo = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly tentouDecidir = input.required<boolean>();
  readonly recomendada = input.required<FormControl<string>>();
  readonly justificativa = input.required<FormControl<string>>();
  readonly opcoes = input.required<typeof CLASSIFICACOES_DE_PROTECAO>();
  readonly erroDaJustificativa = input.required<string | null>();
  readonly tamanhoDaJustificativa = input.required<number>();
  readonly fechar = output<void>();
  readonly confirmar = output<void>();
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly cadastro = nomeDoCadastro;
  protected readonly rotulo = rotuloDe;
  protected readonly justificativaMaxima = JUSTIFICATIVA_MAXIMA;

  private readonly foco = acompanharFocoDoEnvio({ salvando: this.decidindo, aberto: this.aberto });

  /** Confirmar barrado por um campo inválido leva o foco ao primeiro deles, na ordem da tela. */
  protected enviar(): void {
    this.confirmar.emit();
    this.foco.focarPrimeiroInvalido();
  }
}
