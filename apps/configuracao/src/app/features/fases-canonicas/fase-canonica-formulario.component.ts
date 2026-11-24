import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  acompanharLeitura,
  AlertComponent,
  type CatalogoAcompanhado,
  DrawerComponent,
  FalhaDeLeituraDoCampoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { carregarVocabulario } from '../../shared/vocabulario-de-configuracao';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { CODIGO_FASE_SOLICITACAO_ISENCAO, FaseForm } from './fase-canonica-form';

@Component({
  selector: 'cfg-fase-canonica-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    SpinnerComponent,
    FalhaDeLeituraDoCampoComponent,
  ],
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
  readonly leituraDasUnidades = input.required<CatalogoAcompanhado>();
  readonly unidadesParaEscolha =
    input.required<readonly { id: string; rotulo: string; removida: boolean }[]>();
  readonly showGrupoAgrupa = input.required<boolean>();
  readonly showGrupoCompl = input.required<boolean>();
  readonly ehFaseDeIsencao = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  protected readonly origensData = carregarVocabulario('origens-data-fase');
  protected readonly leituraDasOrigens = acompanharLeitura({
    assunto: 'origens da data',
    falha: computed(() =>
      this.origensData.falhou() ? 'Não foi possível carregar as origens da data.' : null,
    ),
    pendente: this.origensData.carregando,
    recarregar: this.origensData.recarregar,
    destino: () => document.getElementById('cfg-fase-origem-data'),
  });
  protected readonly codigoSolicitacaoIsencao = CODIGO_FASE_SOLICITACAO_ISENCAO;
  protected erroDoCampo(nome: keyof FaseForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected origemDisponivel(): boolean {
    const opcoes = this.origensData.opcoes();
    const selecionada = this.form().controls.origemData.value;
    return (
      !this.origensData.carregando() &&
      !this.origensData.falhou() &&
      opcoes.length > 0 &&
      (selecionada === null || opcoes.some((origem) => origem.codigo === selecionada))
    );
  }

  protected aoEnviar(): void {
    if (this.salvando() || !this.origemDisponivel()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
