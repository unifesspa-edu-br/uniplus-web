import { Injectable, inject, signal } from '@angular/core';
import {
  JanelaDeMigracaoApi,
  type DecisaoDaMigracao,
  type ItemDaJanelaDto,
} from '@uniplus/shared-data/autorizacao';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { EnvioNaJanela } from './envio-na-janela';

/** A decisão de uma concessão que o lote reteve, tomada por outra pessoa da gestão de acessos. */
@Injectable()
export class DecisaoDaRetida {
  private readonly api = inject(JanelaDeMigracaoApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly envio = inject(EnvioNaJanela);
  /** A concessão cuja recusa aguarda a confirmação. */
  readonly recusando = signal<ItemDaJanelaDto | null>(null);
  readonly confirmando = signal(false);
  /** O que a API recusou de cada concessão, pela concessão. */
  readonly erros = signal<ReadonlyMap<string, string>>(new Map());

  migrar(perfilId: string, item: ItemDaJanelaDto): Promise<void> {
    return this.enviar(perfilId, item, 'migrar');
  }

  pedirRecusa(item: ItemDaJanelaDto): void {
    if (this.escrita.gravando()) return;
    this.recusando.set(item);
    this.confirmando.set(true);
    this.erros.update((atuais) => this.sem(atuais, item.concessaoId));
  }

  confirmarRecusa(perfilId: string): Promise<void> {
    const item = this.recusando();
    return item === null ? Promise.resolve() : this.enviar(perfilId, item, 'recusar');
  }

  private enviar(
    perfilId: string,
    item: ItemDaJanelaDto,
    decisao: DecisaoDaMigracao,
  ): Promise<void> {
    const { concessaoId } = item;
    const corpo = { decisao, confirmacaoDeExclusao: decisao === 'recusar' };
    return this.escrita.executar(
      'janela',
      async () => {
        const recusa = await this.envio.enviar({ tipo: 'retida', perfilId, concessaoId, corpo }, (c) =>
          this.api.decidirRetida(perfilId, concessaoId, corpo, c),
        );
        if (recusa === null) this.concluir(decisao);
        else this.registrarErro(concessaoId, this.envio.tratar(recusa));
      },
      (mensagem) => this.registrarErro(concessaoId, mensagem),
    );
  }

  private concluir(decisao: DecisaoDaMigracao): void {
    this.confirmando.set(false);
    this.recusando.set(null);
    this.envio.concluir(decisao === 'migrar' ? 'Concessão migrada' : 'Concessão recusada');
  }

  private registrarErro(concessaoId: string, texto: string | null): void {
    if (texto === null) this.confirmando.set(false);
    else this.erros.update((atuais) => new Map(atuais).set(concessaoId, texto));
  }

  private sem(atuais: ReadonlyMap<string, string>, concessaoId: string) {
    const proximos = new Map(atuais);
    proximos.delete(concessaoId);
    return proximos;
  }
}
