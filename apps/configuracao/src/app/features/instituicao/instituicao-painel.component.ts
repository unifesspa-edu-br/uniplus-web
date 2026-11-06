import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { InstituicaoDto } from '@uniplus/shared-data/organizacao';
import { EmptyStateComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { cidadeDaSede, linhaDoEndereco, textoOuNaoInformado } from './ficha-da-instituicao';

/** O painel da Instituição: a ficha de leitura, o convite ao cadastro ou a espera pela leitura. */
@Component({
  selector: 'cfg-instituicao-painel',
  standalone: true,
  imports: [EmptyStateComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instituicao-painel.component.html',
  styleUrl: './instituicao-painel.component.css',
})
export class InstituicaoPainelComponent {
  readonly instituicao = input.required<InstituicaoDto | null>();
  /** A leitura respondeu que nenhuma Instituição foi cadastrada. */
  readonly naoCadastrada = input.required<boolean>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  /** O nome da unidade raiz, ou `null` sem vínculo. */
  readonly unidadeRaiz = input.required<string | null>();
  readonly cadastrar = output<void>();
  readonly editar = output<InstituicaoDto>();

  protected readonly lida = computed(() => this.instituicao() !== null || this.naoCadastrada());
  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());
  protected readonly texto = textoOuNaoInformado;
  protected readonly cidade = cidadeDaSede;
  protected readonly enderecoLinha = linhaDoEndereco;

  protected acionarCadastro(): void {
    if (!this.indisponivel()) {
      this.cadastrar.emit();
    }
  }

  protected acionarEdicao(instituicao: InstituicaoDto): void {
    if (!this.indisponivel()) {
      this.editar.emit(instituicao);
    }
  }
}
