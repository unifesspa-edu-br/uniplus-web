import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, type ApiResult } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ContencaoDoPerfilApi,
  type RetomadaDaSuspensaoDto,
} from '@uniplus/shared-data/autorizacao';
import type { Observable } from 'rxjs';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { CampoDoMotivo } from './campo-do-motivo';
import { ChavesPorComando } from './chaves-por-comando';
import { EscritaDoPerfil } from './escrita-do-perfil';
import { etapa } from '../rotulos-de-acesso';
import { TEXTOS_DA_CONTENCAO, type AcaoDaContencao } from './textos-da-contencao';

/**
 * As ações de contenção do perfil, cada uma com o motivo pedido num diálogo único: o diálogo mostra
 * os textos da ação aberta, e a recusa da API fica junto ao campo ou no aviso do diálogo.
 */
@Injectable()
export class ContencaoDoPerfil {
  private readonly api = inject(ContencaoDoPerfilApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly campo = new CampoDoMotivo();
  private readonly chaves = new ChavesPorComando();
  readonly acao = signal<AcaoDaContencao>('suspender');
  readonly aberto = signal(false);
  readonly erro = signal<string | null>(null);
  readonly tentou = this.campo.tentou;
  readonly motivo = this.campo.controle;
  readonly textos = computed(() => TEXTOS_DA_CONTENCAO[this.acao()]);

  abrir(acao: AcaoDaContencao): void {
    if (this.escrita.gravando()) return;
    this.campo.reiniciar();
    this.erro.set(null);
    this.acao.set(acao);
    this.aberto.set(true);
  }

  confirmar(perfilId: string): Promise<void> {
    const motivo = this.campo.exigir();
    if (motivo === null) return Promise.resolve();
    const acao = this.acao();
    return this.escrita.executar(
      'contencao',
      () => this.enviar(perfilId, acao, motivo),
      (mensagem) => this.erro.set(mensagem),
    );
  }

  private async enviar(perfilId: string, acao: AcaoDaContencao, motivo: string): Promise<void> {
    this.erro.set(null);
    const corpo = { motivo };
    const { resultado } = await this.chaves.enviar(`${acao}:${perfilId}`, corpo, (contexto) =>
      this.chamar(acao, perfilId, corpo, contexto),
    );
    if (!resultado.ok) {
      if (!this.campo.recusar(resultado.problem)) {
        this.erro.set(mensagemDaRecusa(this.problemas, this.notificacoes, resultado.problem));
      }
      return;
    }
    this.aberto.set(false);
    this.notificacoes.success(this.textoDoSucesso(acao, resultado.data));
    this.escrita.recarregar();
  }

  private textoDoSucesso(acao: AcaoDaContencao, dados: unknown): string {
    if (!ehRetomada(dados)) return TEXTOS_DA_CONTENCAO[acao].sucesso;
    if (dados.concluida) return 'Perfil retomado: as concessões voltam a valer';
    const faltam = dados.etapasPendentes.map((codigo) => etapa(codigo).toLowerCase());
    return `Etapa decidida. Falta a decisão da ${faltam.join(' e da ')}`;
  }

  private chamar(
    acao: AcaoDaContencao,
    perfilId: string,
    corpo: { readonly motivo: string },
    contexto: HttpContext,
  ): Observable<ApiResult<unknown>> {
    const chamadas: Record<AcaoDaContencao, () => Observable<ApiResult<unknown>>> = {
      suspender: () => this.api.suspender(perfilId, corpo, contexto),
      retomar_gestao_de_acessos: () =>
        this.api.retomar(perfilId, { etapa: 'gestao_de_acessos', ...corpo }, contexto),
      retomar_protecao_de_dados: () =>
        this.api.retomar(perfilId, { etapa: 'protecao_de_dados', ...corpo }, contexto),
      desativar: () => this.api.desativar(perfilId, corpo, contexto),
      reativar: () => this.api.reativar(perfilId, corpo, contexto),
    };
    return chamadas[acao]();
  }
}

function ehRetomada(dados: unknown): dados is RetomadaDaSuspensaoDto {
  return typeof dados === 'object' && dados !== null && 'concluida' in dados;
}
