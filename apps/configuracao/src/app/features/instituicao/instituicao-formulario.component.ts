import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UnidadeDto } from '@uniplus/shared-data/organizacao';
import {
  AlertComponent,
  type CatalogoAcompanhado,
  DrawerComponent,
  EnderecoGeoComponent,
  FalhaDeLeituraDoCampoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { InstituicaoForm } from './instituicao-form';
import { InstituicaoIdentificacaoComponent } from './instituicao-identificacao.component';
import { InstituicaoRegulatorioComponent } from './instituicao-regulatorio.component';

/** O drawer com o formulário de cadastro e edição da Instituição. */
@Component({
  selector: 'cfg-instituicao-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    EnderecoGeoComponent,
    InstituicaoIdentificacaoComponent,
    InstituicaoRegulatorioComponent,
    SpinnerComponent,
    FalhaDeLeituraDoCampoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instituicao-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class InstituicaoFormularioComponent {
  private readonly endereco = viewChild(EnderecoGeoComponent);

  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<InstituicaoForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly erro = input.required<string | null>();
  readonly erroDoEndereco = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  /** Há escrita em curso, de qualquer tipo: a remoção não parte durante o salvamento. */
  readonly gravando = input.required<boolean>();
  readonly reitorias = input.required<readonly UnidadeDto[]>();
  readonly leituraDasReitorias = input.required<CatalogoAcompanhado>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly remover = output<void>();

  protected readonly titulo = computed(() =>
    this.modo() === 'criar' ? 'Cadastrar instituição' : 'Editar instituição',
  );

  private readonly foco = acompanharFocoDoEnvio({
    salvando: this.salvando,
    aberto: this.aberto,
    focarEndereco: () => this.endereco()?.focarErro(),
  });

  /** Enquanto grava e relê, o botão está indisponível: o clique (e Enter ou Espaço, que o geram) não envia. */
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.gravando()) {
      evento.preventDefault();
    }
  }

  /** O envio do formulário (Enter num campo, por exemplo) também espera a gravação e a releitura em curso. */
  protected aoEnviar(): void {
    if (this.gravando()) {
      return;
    }
    this.salvar.emit();
    if (this.form().invalid) {
      this.foco.focarPrimeiroInvalido();
    }
  }

  /** A recusa do servidor ao vínculo é o que o select aponta; a falha da lista tem o próprio aviso. */
  protected descricaoDaUnidadeRaiz(): string | null {
    return this.erroDoCampo('unidadeRaizId') ? 'cfg-instituicao-unidadeRaizId-erro' : null;
  }

  protected erroDoCampo(nome: keyof InstituicaoForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}
