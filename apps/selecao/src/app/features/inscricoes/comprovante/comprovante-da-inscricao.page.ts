import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ComprovanteDaInscricaoDoProcessoApi } from '@uniplus/shared-data/selecao';
import {
  ComprovanteDoEnvioComponent,
  type FonteDoComprovante,
  type RecusasDoComprovante,
} from '@uniplus/shared-inscricao/comprovante';

import { COMPROVANTE_NAO_ENCONTRADO, recusaDoComprovante } from './recusas-do-comprovante';

const RECUSAS: RecusasDoComprovante = {
  naoEncontrado: COMPROVANTE_NAO_ENCONTRADO,
  explicar: recusaDoComprovante,
};

/**
 * A página do comprovante de um envio da inscrição, para quem opera o processo: lê os parâmetros da
 * rota, entrega ao componente compartilhado a leitura, os textos e as recusas da Seleção e projeta a
 * volta à inscrição. O CPF chega mascarado e fica assim: a unidade não revela o dado do titular aqui.
 */
@Component({
  selector: 'sel-comprovante-da-inscricao-page',
  standalone: true,
  imports: [ComprovanteDoEnvioComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comprovante-da-inscricao.page.html',
})
export class ComprovanteDaInscricaoPage {
  private readonly api = inject(ComprovanteDaInscricaoDoProcessoApi);
  private readonly parametros = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  protected readonly recusas = RECUSAS;
  protected readonly numero = computed(() => this.parametros().get('numero') ?? '');
  /** A inscrição de onde o comprovante é emitido, para voltar a ela. */
  protected readonly rotaDaInscricao = computed(() => [
    '/processo-seletivo',
    this.parametros().get('id'),
    'inscricoes',
    this.parametros().get('inscricaoId'),
  ]);
  protected readonly fonte = computed<FonteDoComprovante>(() => {
    const processoId = this.parametros().get('id') ?? '';
    const inscricaoId = this.parametros().get('inscricaoId') ?? '';
    return (numero) => this.api.obter(processoId, inscricaoId, numero);
  });
  /** O destino do comprovante de outro envio desta inscrição. */
  protected readonly rotaDoEnvio = (numero: number): readonly unknown[] => [
    ...this.rotaDaInscricao(),
    'comprovantes',
    numero,
  ];
}
