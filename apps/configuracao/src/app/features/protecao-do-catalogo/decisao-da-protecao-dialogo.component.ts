import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  type DecisaoDaProtecao,
  type DetalheDaProtecaoDoCatalogoDto,
  type ManifestacaoDaProtecaoDto,
} from '@uniplus/shared-data/configuracao';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import {
  CLASSIFICACOES_DE_PROTECAO,
  nomeDoCadastro,
  rotuloDe,
} from '../../shared/protecao-do-catalogo';
import { ManifestacoesDaProtecaoComponent } from '../../shared/protecao-do-catalogo/manifestacoes-da-protecao.component';

interface TextosDaDecisao {
  readonly titulo: string;
  readonly confirmar: string;
}

const TEXTOS: Readonly<Record<DecisaoDaProtecao, TextosDaDecisao>> = {
  APROVAR: { titulo: 'Aprovar a proteção de dados do item', confirmar: 'Aprovar item' },
  RECOMENDAR_AJUSTE: {
    titulo: 'Recomendar ajuste da proteção de dados',
    confirmar: 'Recomendar ajuste',
  },
  REPROVAR: { titulo: 'Reprovar a proteção de dados do item', confirmar: 'Reprovar item' },
};

@Component({
  selector: 'cfg-decisao-da-protecao-dialogo',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DialogComponent,
    ManifestacoesDaProtecaoComponent,
    SpinnerComponent,
  ],
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
  readonly manifestacoes = input<readonly ManifestacaoDaProtecaoDto[]>([]);
  /** A reprovação e a decisão diante de manifestação desfavorável vigente exigem a justificativa. */
  readonly exigeJustificativa = input(false);
  readonly fechar = output<void>();
  readonly confirmar = output<void>();
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly cadastro = nomeDoCadastro;
  protected readonly rotulo = rotuloDe;
  protected readonly textos = computed(() => TEXTOS[this.decisao()]);

  /** A recusa da API para a classificação recomendada, ou a falta dela. */
  protected erroDaRecomendada(): string {
    const recusa = this.recomendada().getError('backend') as { message: string } | null;
    return recusa?.message ?? 'Indique a classificação recomendada.';
  }

  private readonly foco = acompanharFocoDoEnvio({ salvando: this.decidindo, aberto: this.aberto });

  /** Confirmar barrado por um campo inválido leva o foco ao primeiro deles, na ordem da tela. */
  protected enviar(): void {
    this.confirmar.emit();
    this.foco.focarPrimeiroInvalido();
  }
}
