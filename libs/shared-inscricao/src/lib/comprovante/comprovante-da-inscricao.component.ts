import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ComprovanteDaInscricaoDto } from '@uniplus/shared-data/selecao';
import {
  CodigoDeVerificacaoComponent,
  DadoDirective,
  DadoRevelavelComponent,
  ListaDeDadosComponent,
  SecaoDeDocumentoComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { type DadoRevelavel, formatarDataBr } from '@uniplus/shared-utils';

import { documentosExibidos } from './documentos-do-comprovante';
import { ItensDoComprovanteComponent } from './itens-do-comprovante.component';
import { opcoesDeCursoExibidas } from './opcoes-de-curso-do-comprovante';

/** Um instante em pt-BR, no fuso que a API projeta, com o nome dele: "10/10/2026, 19:36, horário de Belém (PA)". */
function noFuso(instante: string, fuso: ComprovanteDaInscricaoDto['envio']['fusoHorario']): string {
  return `${formatarDataBr(instante, 'datetime', fuso.id)}, horário de ${fuso.nome}`;
}

/**
 * O corpo do comprovante de um envio da inscrição, como a API o emitiu: sem número de documento, com
 * o CPF mascarado e o código que prova que não mudou. Só exibe; texto, seções e prazo vêm prontos.
 * Vai dentro de um `ui-documento`, cujas seções ele contribui ao corpo.
 *
 * O que é de quem o hospeda entra por projeção: `[inscAcaoDaCorrecao]` fica em "Próximos passos",
 * quando o prazo de correção está aberto.
 */
@Component({
  selector: 'insc-comprovante-da-inscricao',
  standalone: true,
  imports: [
    CodigoDeVerificacaoComponent,
    DadoDirective,
    DadoRevelavelComponent,
    ItensDoComprovanteComponent,
    ListaDeDadosComponent,
    RouterLink,
    SecaoDeDocumentoComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'documento__fragmento' },
  templateUrl: './comprovante-da-inscricao.component.html',
})
export class ComprovanteDaInscricaoComponent {
  readonly comprovante = input.required<ComprovanteDaInscricaoDto>();
  /** O CPF que o titular pode revelar para conferir; nulo mostra o mascarado que a API entregou. */
  readonly cpf = input<DadoRevelavel | null>(null);
  /** O destino do comprovante de outro envio da mesma inscrição, a partir do número dele. */
  readonly rotaDoEnvio = input.required<(numero: number) => readonly unknown[]>();

  protected readonly enviadoEm = computed(() => {
    const { enviadoEm, fusoHorario } = this.comprovante().envio;
    return noFuso(enviadoEm, fusoHorario);
  });
  protected readonly aceitosEm = computed(() => {
    const { enviadoEm, fusoHorario } = this.comprovante().envio;
    return formatarDataBr(enviadoEm, 'short', fusoHorario.id);
  });
  protected readonly fimDoPrazo = computed(() => {
    const prazo = this.comprovante().prazoDaCorrecao;
    return prazo ? noFuso(prazo.fim, prazo.fusoHorario) : '';
  });
  protected readonly opcoes = computed(() => opcoesDeCursoExibidas(this.comprovante()));
  /** O envio de um processo de 1 opção sem o nome do curso não tem o que mostrar na seção. */
  protected readonly mostrarOpcoes = computed(() => {
    const opcoes = this.opcoes();
    return opcoes.length > 1 || opcoes[0]?.curso != null;
  });
  protected readonly comDuasOpcoes = computed(() => this.opcoes().length > 1);
  protected readonly modalidadesDefinidas = computed(() =>
    this.opcoes().some((o) => o.modalidades !== null),
  );
  protected readonly documentos = computed(() => documentosExibidos(this.comprovante().documentos));
}
