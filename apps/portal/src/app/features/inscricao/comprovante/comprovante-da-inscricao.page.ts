import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import {
  AcaoDaCorrecaoDirective,
  ComprovanteDoEnvioComponent,
  type FonteDoComprovante,
  type RecusasDoComprovante,
} from '@uniplus/shared-inscricao/comprovante';
import { cpfRevelavel } from '@uniplus/shared-utils';

import { MinhasInscricoesService } from '../minhas-inscricoes.service';
import { COMPROVANTE_NAO_ENCONTRADO, recusaDoComprovante } from './recusas-do-comprovante';

const RECUSAS: RecusasDoComprovante = {
  naoEncontrado: COMPROVANTE_NAO_ENCONTRADO,
  explicar: recusaDoComprovante,
};

/**
 * A página do comprovante de um envio da inscrição, para o candidato: entrega ao componente
 * compartilhado a leitura, os textos e as recusas do portal, e projeta a volta às inscrições e a
 * correção dos dados.
 */
@Component({
  selector: 'ptl-comprovante-da-inscricao-page',
  standalone: true,
  imports: [AcaoDaCorrecaoDirective, ComprovanteDoEnvioComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comprovante-da-inscricao.page.html',
})
export class ComprovanteDaInscricaoPage {
  private readonly servico = inject(MinhasInscricoesService);
  private readonly usuario = inject(UserContextService);

  readonly inscricaoId = input.required<string>();
  /** A ordem da submissão, a contar de 1. */
  readonly numero = input.required<string>();

  protected readonly recusas = RECUSAS;
  protected readonly fonte = computed<FonteDoComprovante>(() => {
    const inscricaoId = this.inscricaoId();
    return (numero) => this.servico.comprovante(inscricaoId, numero);
  });
  /** O destino do comprovante de outro envio desta inscrição. */
  protected readonly rotaDoEnvio = (numero: number): readonly unknown[] => [
    '/inscricao',
    'comprovante',
    this.inscricaoId(),
    numero,
  ];
  /**
   * O CPF que o titular revela vem do login, sem consulta; só quando confere com o do comprovante,
   * que chega mascarado.
   */
  protected readonly cpf = computed(() => cpfRevelavel(this.usuario.user()?.cpf));
}
