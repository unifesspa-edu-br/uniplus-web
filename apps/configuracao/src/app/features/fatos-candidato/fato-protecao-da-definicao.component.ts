import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  FalhaDeLeituraDoCampoComponent,
  IndicadorDaLeituraDirective,
} from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import {
  AvisoDeNovaAprovacaoComponent,
  type OpcaoDeVocabulario,
} from '../../shared/protecao-do-catalogo';
import type { LeituraDoVocabulario } from './vocabulario-do-fato';

type CampoDaProtecao = 'classificacao' | 'hipotese' | 'finalidade';

/** O nome de cada campo na API, que dá o fim do id da mensagem de erro dele. */
const NOME_NA_API: Record<CampoDaProtecao, string> = {
  classificacao: 'classificacaoProtecao',
  hipotese: 'hipoteseLegal',
  finalidade: 'finalidadeTratamento',
};

/** O fim do id de cada campo; o da hipótese é o id que a leitura da lista usa para devolver o foco. */
const FIM_DO_ID_DO_CAMPO: Record<CampoDaProtecao, string> = {
  classificacao: 'classificacaoProtecao',
  hipotese: 'hipoteses',
  finalidade: 'finalidadeTratamento',
};

/** Os campos de proteção de dados do cadastro: classificação, hipótese legal e finalidade. */
@Component({
  selector: 'cfg-fato-protecao-da-definicao',
  imports: [
    ReactiveFormsModule,
    AvisoDeNovaAprovacaoComponent,
    FalhaDeLeituraDoCampoComponent,
    IndicadorDaLeituraDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-protecao-da-definicao.component.html',
})
export class FatoProtecaoDaDefinicaoComponent {
  readonly classificacao = input.required<FormControl<string>>();
  readonly hipotese = input.required<FormControl<string>>();
  readonly finalidade = input.required<FormControl<string>>();
  /** Início dos ids dos campos e das mensagens, para a tela de criação e a de definição não repetirem ids. */
  readonly prefixoDosIds = input.required<'cfg-fato' | 'cfg-fato-def'>();
  readonly classificacoes = input.required<readonly OpcaoDeVocabulario[]>();
  readonly hipoteses = input.required<readonly OpcaoDeVocabulario[]>();
  /** A leitura da lista de hipóteses: o carregando e a falha com nova tentativa. */
  readonly leituraDasHipoteses = input.required<LeituraDoVocabulario>();
  /** A proteção mudou e o fato estava aprovado: a mudança volta à aprovação da proteção de dados. */
  readonly avisaNovaAprovacao = input(false);

  protected erroDoCampo(campo: CampoDaProtecao): string | null {
    return mensagemDeErroDoControle(this[campo]());
  }

  protected idDoCampo(campo: CampoDaProtecao): string {
    return `${this.prefixoDosIds()}-${FIM_DO_ID_DO_CAMPO[campo]}`;
  }

  protected idDoErro(campo: CampoDaProtecao): string {
    return `${this.prefixoDosIds()}-${NOME_NA_API[campo]}-erro`;
  }

  protected descritor(campo: CampoDaProtecao): string | null {
    return this.erroDoCampo(campo) ? this.idDoErro(campo) : null;
  }

  /** O aviso de falha da leitura e, se houver, a mensagem de campo obrigatório. */
  protected descritorDaHipotese(idDaFalha: string): string | null {
    const ids = [
      this.leituraDasHipoteses().leitura.visivel() ? idDaFalha : null,
      this.descritor('hipotese'),
    ];
    return ids.filter(Boolean).join(' ') || null;
  }
}
