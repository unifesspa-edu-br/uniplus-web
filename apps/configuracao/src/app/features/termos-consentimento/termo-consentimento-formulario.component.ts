import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { carregarVocabulario } from '../../shared/vocabulario-de-configuracao';
import {
  acompanharLeitura,
  FalhaDeLeituraDoCampoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { CriarForm, TEXTO_MAX } from './termo-consentimento-form';

@Component({
  selector: 'cfg-termo-consentimento-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, FalhaDeLeituraDoCampoComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './termo-consentimento-formulario.component.html',
})
export class TermoConsentimentoFormularioComponent {
  readonly form = input.required<FormGroup<CriarForm>>();
  readonly criando = input.required<boolean>();
  readonly salvar = output<void>();
  protected readonly formasAceite = carregarVocabulario('formas-aceite');
  protected readonly leituraDasFormas = acompanharLeitura({
    assunto: 'formas de aceite',
    falha: computed(() =>
      this.formasAceite.falhou() ? 'Não foi possível carregar as opções.' : null,
    ),
    pendente: this.formasAceite.carregando,
    recarregar: () => this.formasAceite.recarregar(),
    destino: () => document.getElementById('termo-novo-formaAceite'),
  });
  protected readonly textoMax = TEXTO_MAX;
  private readonly foco = acompanharFocoDoEnvio({
    salvando: this.criando,
    aberto: signal(true).asReadonly(),
  });

  protected erroDoCampo(nome: keyof CriarForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }

  protected aoEnviar(): void {
    if (this.criando() || this.leituraDasFormas.pendente()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
