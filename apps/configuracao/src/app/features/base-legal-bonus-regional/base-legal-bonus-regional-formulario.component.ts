import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { type CidadeResumoDto } from '@uniplus/shared-data/geo';
import {
  AlertComponent,
  DrawerComponent,
  FalhaDeLeituraComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoCampoComFormato } from '../../shared/formulario';
import { BaseLegalForm } from './base-legal-form';
import { CampoDeMunicipiosComponent } from './campo-de-municipios.component';
import type { CampoDeMunicipios } from './municipios-da-base-legal';
import type { TiposDoFormulario } from './tipos-de-instrumento';

/** Nenhum campo da base legal tem validador de formato: a mensagem de formato nunca é a escolhida. */
const MENSAGEM_DE_FORMATO = 'Valor inválido.';

/** O drawer do cadastro e da edição de base legal de bônus regional. */
@Component({
  selector: 'cfg-base-legal-bonus-regional-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    CampoDeMunicipiosComponent,
    DrawerComponent,
    FalhaDeLeituraComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './base-legal-bonus-regional-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class BaseLegalBonusRegionalFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<BaseLegalForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  /** Tipos de instrumento vindos da API: o select oferece os nomes e grava o código. */
  readonly tipos = input.required<TiposDoFormulario>();
  readonly municipios = input.required<CampoDeMunicipios>();

  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly buscarMunicipio = output<string>();
  readonly adicionarMunicipio = output<CidadeResumoDto>();
  readonly removerMunicipio = output<string>();

  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  /** Enquanto envia, o botão está indisponível: o clique (e Enter ou Espaço, que o geram) não envia. */
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) {
      evento.preventDefault();
    }
  }

  /** O envio do formulário (Enter num campo, por exemplo) também espera o envio em curso. */
  protected aoEnviar(): void {
    if (this.salvando()) {
      return;
    }
    this.salvar.emit();
    if (this.form().invalid || this.municipios().selecionados.length === 0) {
      this.foco.focarPrimeiroInvalido();
    }
  }

  protected erroDoCampo(nome: keyof BaseLegalForm): string | null {
    return mensagemDeErroDoCampoComFormato(this.form().controls[nome], MENSAGEM_DE_FORMATO);
  }

  /** O select é descrito pela falha do vocabulário e pelo erro do campo, quando há. */
  protected descricaoDoTipo(): string | null {
    const ids = [
      this.aberto() && this.tipos().leitura.visivel() ? 'cfg-blbr-tipos-falha' : null,
      this.erroDoCampo('tipoInstrumento') ? 'cfg-blbr-tipo-erro' : null,
    ].filter((id): id is string => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  }
}
