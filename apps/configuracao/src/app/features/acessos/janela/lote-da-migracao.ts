import { Injectable, computed, inject, signal } from '@angular/core';
import {
  JanelaDeMigracaoApi,
  type DecisaoDaMigracao,
  type EnviarLoteDaMigracaoRequest,
  type ItemDaJanelaDto,
} from '@uniplus/shared-data/autorizacao';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { EnvioNaJanela } from './envio-na-janela';
import {
  decisoesDaEtapa,
  quantidadeDeRecusas,
  semDecisao,
  type DecisoesDaMigracao,
} from './itens-da-janela';

/** O lote da gestão de acessos: uma decisão por concessão da versão anterior, enviadas juntas. */
@Injectable()
export class LoteDaMigracao {
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

  completo(itens: readonly ItemDaJanelaDto[]): boolean {
    return semDecisao(itens, this.decisoes()) === 0;
  }

  /** Com recusa, a confirmação vem antes do envio; sem ela, o lote segue direto. */
  pedirEnvio(perfilId: string, itens: readonly ItemDaJanelaDto[]): void {
    if (this.escrita.gravando() || !this.completo(itens)) return;
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

  private async gravar(perfilId: string, corpo: EnviarLoteDaMigracaoRequest): Promise<void> {
    const recusa = await this.envio.enviar(`lote:${perfilId}`, corpo, (contexto) =>
      this.api.enviarLote(perfilId, corpo, contexto),
    );
    if (recusa === null) this.concluir();
    else this.recusar(this.envio.tratar(recusa));
  }

  private concluir(): void {
    this.confirmando.set(false);
    this.decisoes.set(new Map());
    this.envio.concluir('Lote enviado');
  }

  private recusar(texto: string | null): void {
    this.erro.set(texto);
    if (texto === null) this.confirmando.set(false);
  }
}
