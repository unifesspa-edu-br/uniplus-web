import { Injectable, inject, signal } from '@angular/core';
import { ProblemI18nService, type ApiResult, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { RevisoesApi, type ItemDaRevisaoDto } from '@uniplus/shared-data/autorizacao';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { CampoDoMotivo } from '../versoes/campo-do-motivo';
import { ChavesPorComando } from '../versoes/chaves-por-comando';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { ReleituraDepoisDaFalha, type FalhaDaDecisao } from './releitura-depois-da-falha';

/** O que se decide sobre o item: manter a concessão ou revogá-la. */
type DecisaoSobreOItem = 'confirmar' | 'revogar';

const SUCESSO: Readonly<Record<DecisaoSobreOItem, string>> = {
  confirmar: 'Acesso mantido',
  revogar: 'Acesso revogado',
};

const DECISOR_MUDOU = 'uniplus.autorizacao.revisao.decisor_nao_decide_o_item';
const CONFLITO = 409;
const PRIMEIRO_STATUS_DE_SERVIDOR = 500;
const SEM_RESPOSTA = 'uniplus.client.network_error';
const TITULO_DA_FALHA = 'Não foi possível concluir a decisão';
const DEPOIS_DA_RELEITURA =
  'A revisão foi relida. Confira o item antes de decidir de novo: a decisão pode ter sido gravada.';

/** O que a recusa da decisão mostra acima dos itens, depois de reler a revisão. */
export interface AvisoDaDecisao {
  readonly titulo: string;
  readonly texto: string;
}

/**
 * A decisão de um item da revisão: confirmar mantém a concessão; revogar pede o motivo. Quando
 * outra pessoa decidiu antes (409, ADR-0119) ou quem decide mudou entre a leitura e a decisão
 * (422 `decisor_nao_decide_o_item`, ADR-0162), a revisão é relida e o aviso explica o porquê. A
 * falha de desfecho incerto tira a revisão da tela até ela ser relida com sucesso.
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
  private readonly releitura = new ReleituraDepoisDaFalha((falha) =>
    this.aviso.set({ titulo: falha.titulo, texto: DEPOIS_DA_RELEITURA }),
  );
  /** A falha que esconde a revisão até a próxima leitura bem-sucedida. */
  readonly falha = this.releitura.falha;

  confirmar(revisaoId: string, item: ItemDaRevisaoDto): Promise<void> {
    return this.escrita.executar(
      'decisao',
      () => this.enviar('confirmar', item, null, (c) => this.api.confirmar(revisaoId, item.id, c)),
      (mensagem) => this.falhar({ titulo: TITULO_DA_FALHA, texto: mensagem }),
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
        this.enviar('revogar', item, { motivo }, (c) =>
          this.api.revogar(revisaoId, item.id, { motivo }, c),
        ),
      (mensagem) => this.falhar({ titulo: TITULO_DA_FALHA, texto: mensagem }),
    );
  }

  private async enviar(
    decisao: DecisaoSobreOItem,
    item: ItemDaRevisaoDto,
    corpo: unknown,
    chamada: Parameters<ChavesPorComando['enviar']>[2],
  ): Promise<void> {
    this.aviso.set(null);
    this.erroDaRevogacao.set(null);
    const { resultado } = await this.chaves.enviar(`${decisao}:${item.id}`, corpo, chamada);
    this.desfecho(decisao, resultado);
  }

  private desfecho(decisao: DecisaoSobreOItem, resultado: ApiResult<unknown>): void {
    if (resultado.ok) this.concluir(SUCESSO[decisao]);
    else if (this.incerta(resultado.problem)) this.falharPelo(resultado.problem);
    else if (this.mudouDesdeALeitura(resultado.problem)) this.reler(resultado.problem);
    else if (!this.campo.recusar(resultado.problem)) this.recusar(resultado.problem);
  }

  /** Falha de servidor ou sem resposta: a decisão pode ter sido gravada ou não. */
  private incerta(problema: ProblemDetails): boolean {
    return problema.status >= PRIMEIRO_STATUS_DE_SERVIDOR || problema.code === SEM_RESPOSTA;
  }

  private falharPelo(problema: ProblemDetails): void {
    this.falhar({ titulo: TITULO_DA_FALHA, texto: this.texto(problema) });
  }

  private falhar(falha: FalhaDaDecisao): void {
    this.aviso.set(null);
    this.aberto.set(false);
    this.releitura.iniciar(falha);
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
