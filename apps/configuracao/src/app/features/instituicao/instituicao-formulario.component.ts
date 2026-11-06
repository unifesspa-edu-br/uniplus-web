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
  DrawerComponent,
  EnderecoGeoComponent,
  type FaseDaNovaTentativa,
  NovaTentativaDoCampoComponent,
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
    NovaTentativaDoCampoComponent,
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
  readonly reitoriasComErro = input.required<boolean>();
  /** A lista de reitorias está sendo lida: o "Tentar novamente" fica com `aria-disabled`. */
  readonly reitoriasCarregando = input.required<boolean>();
  readonly faseDasReitorias = input.required<FaseDaNovaTentativa>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly remover = output<void>();
  readonly recarregarReitorias = output<void>();

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

  /** Os avisos que o select aponta: a falha da lista e a recusa do servidor ao vínculo. */
  protected descricaoDaUnidadeRaiz(): string | null {
    const avisos = [
      this.reitoriasComErro() ? 'cfg-instituicao-reitorias-erro' : null,
      this.erroDoCampo('unidadeRaizId') ? 'cfg-instituicao-unidadeRaizId-erro' : null,
    ].filter((id) => id !== null);
    return avisos.length > 0 ? avisos.join(' ') : null;
  }

  /** Enquanto a lista é lida, o botão não dispara outra leitura; mantém o foco por ser `aria-disabled`. */
  protected aoTentarReitorias(): void {
    if (!this.reitoriasCarregando()) {
      this.recarregarReitorias.emit();
    }
  }

  protected erroDoCampo(nome: keyof InstituicaoForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}
