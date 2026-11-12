import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, type ApiResult, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ContencaoDoPerfilApi,
  type EtapaDaVersao,
  type RetomadaDaSuspensaoDto,
} from '@uniplus/shared-data/autorizacao';
import type { Observable } from 'rxjs';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { CampoDoMotivo } from './campo-do-motivo';
import { ChavesPorComando } from './chaves-por-comando';
import { EscritaDoPerfil } from './escrita-do-perfil';
import { decisaoDaEtapa } from './rotulos-da-versao';
import { MENSAGENS_DA_RETOMADA } from './mensagens-da-contencao';
import { TEXTOS_DA_CONTENCAO, type AcaoDaContencao } from './textos-da-contencao';

type Chamada = (
  api: ContencaoDoPerfilApi,
  perfilId: string,
  corpo: { readonly motivo: string },
  contexto: HttpContext,
) => Observable<ApiResult<unknown>>;

const retomar =
  (etapa: EtapaDaVersao): Chamada =>
  (api, perfilId, corpo, contexto) =>
    api.retomar(perfilId, { etapa, ...corpo }, contexto);

/** O endpoint de cada ação: a retomada leva a etapa que a pessoa decide. */
const CHAMADAS: Record<AcaoDaContencao, Chamada> = {
  suspender: (api, perfilId, corpo, contexto) => api.suspender(perfilId, corpo, contexto),
  retomar_gestao_de_acessos: retomar('gestao_de_acessos'),
  retomar_protecao_de_dados: retomar('protecao_de_dados'),
  desativar: (api, perfilId, corpo, contexto) => api.desativar(perfilId, corpo, contexto),
  reativar: (api, perfilId, corpo, contexto) => api.reativar(perfilId, corpo, contexto),
};

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
  readonly pedidoDeFoco = this.campo.pedidoDeFoco;
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
      CHAMADAS[acao](this.api, perfilId, corpo, contexto),
    );
    if (resultado.ok) this.concluir(acao, resultado.data);
    else if (!this.campo.recusar(resultado.problem)) {
      this.erro.set(this.textoDaRecusa(acao, resultado.problem));
    }
  }

  private concluir(acao: AcaoDaContencao, dados: unknown): void {
    this.aberto.set(false);
    this.notificacoes.success(this.textoDoSucesso(acao, dados));
    this.escrita.recarregar();
  }

  private textoDaRecusa(acao: AcaoDaContencao, problema: ProblemDetails): string {
    const doContexto = acao.startsWith('retomar_') ? MENSAGENS_DA_RETOMADA : undefined;
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema, doContexto);
  }

  private textoDoSucesso(acao: AcaoDaContencao, dados: unknown): string {
    if (!ehRetomada(dados)) return TEXTOS_DA_CONTENCAO[acao].sucesso;
    if (dados.concluida) return 'Perfil retomado: as concessões voltam a valer';
    const faltam = dados.etapasPendentes.map(decisaoDaEtapa);
    return `Etapa decidida. Falta a ${faltam.join(' e a ')}`;
  }
}

function ehRetomada(dados: unknown): dados is RetomadaDaSuspensaoDto {
  return typeof dados === 'object' && dados !== null && 'concluida' in dados;
}
