import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  comChave,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PerfisApi } from '@uniplus/shared-data/autorizacao';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { EscritaDoPerfil } from './escrita-do-perfil';

interface PerfilAtivavel {
  readonly id: string;
  readonly nome: string;
  readonly ativo: boolean;
}

/** Desativar e reativar o perfil, com o andamento e o desfecho anunciados a quem não vê a mudança. */
@Injectable()
export class AtivacaoDoPerfil {
  private readonly api = inject(PerfisApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly chave = new ChaveDeSubstituicao();
  private readonly andamento = signal('');
  private readonly resultado = signal('');
  /** O andamento e o desfecho da mudança de situação, que não tem sobreposição para dizê-los. */
  readonly anuncio = computed(() => this.andamento() || this.resultado());

  limparAnuncio(): void {
    this.resultado.set('');
  }

  alternar(perfil: PerfilAtivavel): Promise<void> {
    return this.escrita.executar('situacao', () => this.mudar(perfil), (m) => this.escrita.erroDaAcao.set(m));
  }

  private async mudar(perfil: PerfilAtivavel): Promise<void> {
    this.escrita.erroDaAcao.set(null);
    this.resultado.set('');
    this.andamento.set(`${perfil.ativo ? 'Desativando' : 'Reativando'} o perfil ${perfil.nome}.`);
    try {
      const { resultado } = await comChave(
        this.chave,
        { id: perfil.id, ativo: !perfil.ativo },
        (contexto) =>
          perfil.ativo
            ? this.api.desativar(perfil.id, contexto)
            : this.api.ativar(perfil.id, contexto),
      );
      if (resultado.ok) this.concluir(perfil);
      else this.escrita.erroDaAcao.set(this.texto(resultado.problem));
    } finally {
      this.andamento.set('');
    }
  }

  private concluir(perfil: PerfilAtivavel): void {
    this.notificacoes.success(perfil.ativo ? 'Perfil desativado' : 'Perfil reativado');
    this.resultado.set(`Perfil ${perfil.nome} ${perfil.ativo ? 'desativado' : 'reativado'}.`);
    this.escrita.recarregar();
  }

  private texto(problema: Parameters<typeof mensagemDaRecusa>[2]): string {
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema);
  }
}
