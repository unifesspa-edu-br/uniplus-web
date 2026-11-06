import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  ORIGENS_DATA_FASE,
  ROTULO_ORIGEM_DATA_FASE,
  OrigemDataFase,
} from '@uniplus/shared-data/configuracao';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { CODIGO_FASE_SOLICITACAO_ISENCAO, FaseForm } from './fase-canonica-form';

@Component({
  selector: 'cfg-fase-canonica-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fase-canonica-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class FaseCanonicaFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<FaseForm>>();
  readonly salvando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly erroUnidades = input.required<boolean>();
  readonly unidadesParaEscolha =
    input.required<readonly { id: string; rotulo: string; removida: boolean }[]>();
  readonly showGrupoAgrupa = input.required<boolean>();
  readonly showGrupoCompl = input.required<boolean>();
  readonly ehFaseDeIsencao = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly recarregarUnidades = output<void>();
  protected readonly origensData = ORIGENS_DATA_FASE;
  protected readonly codigoSolicitacaoIsencao = CODIGO_FASE_SOLICITACAO_ISENCAO;
  protected rotuloDaOrigem(origem: OrigemDataFase): string {
    return ROTULO_ORIGEM_DATA_FASE[origem];
  }
  protected erroDoCampo(nome: keyof FaseForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
