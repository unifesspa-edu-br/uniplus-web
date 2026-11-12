import { Injectable, computed, inject, signal } from '@angular/core';
import {
  JanelaDeMigracaoApi,
  type DecidirEtapaDaProtecaoRequest,
  type DecisaoDaMigracao,
  type ItemDaJanelaDto,
} from '@uniplus/shared-data/autorizacao';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { EnvioNaJanela } from './envio-na-janela';
import { decisoesDaEtapa, quantidadeDeRecusas, type DecisoesDaMigracao } from './itens-da-janela';

/**
 * A etapa da proteção de dados: as concessões que aguardam são decididas uma a uma ou em lote, e o
 * envio pode migrar algumas e recusar outras. O envio vale por inteiro ou não é gravado.
 */
@Injectable()
export class EtapaDaProtecaoDeDados {
  private readonly api = inject(JanelaDeMigracaoApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly envio = inject(EnvioNaJanela);
  readonly decisoes = signal<DecisoesDaMigracao>(new Map());
  readonly recusas = computed(() => quantidadeDeRecusas(this.decisoes()));
  readonly confirmando = signal(false);
  readonly erro = signal<string | null>(null);

  decidir(concessaoId: string, decisao: DecisaoDaMigracao): void {
    this.decisoes.update((atuais) => new Map(atuais).set(concessaoId, decisao));
  }

  decidirTodas(itens: readonly ItemDaJanelaDto[], decisao: DecisaoDaMigracao): void {
    this.decisoes.set(new Map(itens.map((item) => [item.concessaoId, decisao])));
  }

  /** Só as concessões que ainda aguardam: a decisão de uma que saiu da etapa não segue no envio. */
  pedirEnvio(perfilId: string, itens: readonly ItemDaJanelaDto[]): void {
    if (this.escrita.gravando() || decisoesDaEtapa(itens, this.decisoes()).length === 0) return;
    this.erro.set(null);
    if (this.recusas() > 0) this.confirmando.set(true);
    else void this.enviar(perfilId, itens, false);
  }

  confirmarExclusao(perfilId: string, itens: readonly ItemDaJanelaDto[]): Promise<void> {
    return this.enviar(perfilId, itens, true);
  }

  private enviar(
    perfilId: string,
    itens: readonly ItemDaJanelaDto[],
    confirmacaoDeExclusao: boolean,
  ): Promise<void> {
    const corpo = { decisoes: decisoesDaEtapa(itens, this.decisoes()), confirmacaoDeExclusao };
    return this.escrita.executar(
      'janela',
      () => this.gravar(perfilId, corpo),
      (mensagem) => this.erro.set(mensagem),
    );
  }

  private async gravar(perfilId: string, corpo: DecidirEtapaDaProtecaoRequest): Promise<void> {
    const recusa = await this.envio.enviar(`protecao:${perfilId}`, corpo, (contexto) =>
      this.api.decidirProtecaoDeDados(perfilId, corpo, contexto),
    );
    if (recusa === null) this.concluir();
    else this.recusar(this.envio.tratar(recusa));
  }

  private concluir(): void {
    this.confirmando.set(false);
    this.decisoes.set(new Map());
    this.envio.concluir('Decisões da proteção de dados enviadas');
  }

  private recusar(texto: string | null): void {
    this.erro.set(texto);
    if (texto === null) this.confirmando.set(false);
  }
}
