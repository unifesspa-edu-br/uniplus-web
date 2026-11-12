import { Injectable, inject, signal } from '@angular/core';
import { ProblemI18nService, type ApiResult, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { RevisoesApi, type ItemDaRevisaoDto } from '@uniplus/shared-data/autorizacao';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { CampoDoMotivo } from '../versoes/campo-do-motivo';
import { ChavesPorComando } from '../versoes/chaves-por-comando';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';

const DECISOR_MUDOU = 'uniplus.autorizacao.revisao.decisor_nao_decide_o_item';
const CONFLITO = 409;

/** O que a recusa da decisão mostra acima dos itens, depois de reler a revisão. */
export interface AvisoDaDecisao {
  readonly titulo: string;
  readonly texto: string;
}

/**
 * A decisão de um item da revisão: confirmar mantém a concessão; revogar pede o motivo. Quando
 * outra pessoa decidiu antes (409, ADR-0119) ou quem decide mudou entre a leitura e a decisão
 * (422 `decisor_nao_decide_o_item`, ADR-0162), a revisão é relida e o aviso explica o porquê.
 */
@Injectable()
export class DecisaoDoItem {
  private readonly api = inject(RevisoesApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly chaves = new ChavesPorComando();
  private readonly campo = new CampoDoMotivo();
  readonly motivo = this.campo.controle;
  readonly tentou = this.campo.tentou;
  readonly pedidoDeFoco = this.campo.pedidoDeFoco;
  readonly revogando = signal<ItemDaRevisaoDto | null>(null);
  readonly aberto = signal(false);
  readonly erroDaRevogacao = signal<string | null>(null);
  readonly aviso = signal<AvisoDaDecisao | null>(null);

  confirmar(revisaoId: string, item: ItemDaRevisaoDto): Promise<void> {
    return this.escrita.executar(
      'decisao',
      () =>
        this.enviar(`confirmar:${item.id}`, null, (c) => this.api.confirmar(revisaoId, item.id, c)),
      (mensagem) =>
        this.aviso.set({ titulo: 'Não foi possível confirmar o item', texto: mensagem }),
    );
  }

  abrirRevogacao(item: ItemDaRevisaoDto): void {
    if (this.escrita.gravando()) return;
    this.campo.reiniciar();
    this.erroDaRevogacao.set(null);
    this.revogando.set(item);
    this.aberto.set(true);
  }

  revogar(revisaoId: string): Promise<void> {
    const item = this.revogando();
    const motivo = this.campo.exigir();
    if (item === null || motivo === null) return Promise.resolve();
    return this.escrita.executar(
      'decisao',
      () =>
        this.enviar(`revogar:${item.id}`, { motivo }, (c) =>
          this.api.revogar(revisaoId, item.id, { motivo }, c),
        ),
      (mensagem) => this.erroDaRevogacao.set(mensagem),
    );
  }

  private async enviar(
    comando: string,
    corpo: unknown,
    chamada: Parameters<ChavesPorComando['enviar']>[2],
  ): Promise<void> {
    this.aviso.set(null);
    this.erroDaRevogacao.set(null);
    const { resultado } = await this.chaves.enviar(comando, corpo, chamada);
    this.desfecho(comando, resultado);
  }

  private desfecho(comando: string, resultado: ApiResult<unknown>): void {
    if (resultado.ok)
      this.concluir(comando.startsWith('revogar') ? 'Acesso revogado' : 'Acesso mantido');
    else if (this.mudouDesdeALeitura(resultado.problem)) this.reler(resultado.problem);
    else if (!this.campo.recusar(resultado.problem)) this.recusar(resultado.problem);
  }

  private mudouDesdeALeitura(problema: ProblemDetails): boolean {
    return problema.status === CONFLITO || problema.code === DECISOR_MUDOU;
  }

  private concluir(titulo: string): void {
    this.aberto.set(false);
    this.notificacoes.success(titulo);
    this.escrita.recarregar();
  }

  private reler(problema: ProblemDetails): void {
    const titulo =
      problema.code === DECISOR_MUDOU ? 'Quem decide o item mudou' : 'Decisão concorrente';
    this.aviso.set({ titulo, texto: this.texto(problema) });
    this.aberto.set(false);
    this.escrita.recarregar();
  }

  private recusar(problema: ProblemDetails): void {
    if (this.aberto()) this.erroDaRevogacao.set(this.texto(problema));
    else this.aviso.set({ titulo: 'Não foi possível decidir o item', texto: this.texto(problema) });
  }

  private texto(problema: ProblemDetails): string {
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema);
  }
}
