import { Injectable, inject, signal } from '@angular/core';
import { ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ReclassificacoesApi,
  type EtapaDaVersao,
  type ReclassificacaoDto,
  type ResultadoDaReclassificacao,
} from '@uniplus/shared-data/autorizacao';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { ChavesPorComando } from '../versoes/chaves-por-comando';
import { CampoDoMotivo } from '../versoes/campo-do-motivo';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { desfechoDaDecisao, type DesfechoDaDecisao } from './concessoes-da-etapa';

const RAIZ = 'uniplus.autorizacao.reclassificacao.';
const SUPERADA = `${RAIZ}superada`;
const DOCUMENTO_NAO_LIDO = `${RAIZ}documento_nao_lido`;
const SEM_CONCESSAO_MARCADA =
  'Marque ao menos uma concessão ou escolha decidir todas as pendentes da etapa.';

export type AlcanceDaDecisao = 'marcadas' | 'todas';

/**
 * A decisão de uma etapa sobre as concessões suspensas: as marcadas ou todas as pendentes, liberando
 * ou mantendo a suspensão com motivo. A decisão vale por inteiro ou não é gravada.
 */
@Injectable()
export class DecisaoDaReclassificacao {
  private readonly api = inject(ReclassificacoesApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly chaves = new ChavesPorComando();
  readonly motivo = new CampoDoMotivo();
  readonly etapa = signal<EtapaDaVersao | undefined>(undefined);
  readonly alcance = signal<AlcanceDaDecisao>('marcadas');
  readonly marcadas = signal<ReadonlySet<string>>(new Set());
  readonly pedindoMotivo = signal(false);
  /** A recusa da API, junto à ação; o motivo recusado aparece no campo do diálogo. */
  readonly erro = signal<string | null>(null);
  /** Cresce a cada erro para o qual a ação pede o foco. */
  readonly pedidoDeFocoNoErro = signal(0);
  /** Cresce quando a decisão exige a leitura do documento, que a tela mostra em seguida. */
  readonly pedidoDeLeitura = signal(0);
  readonly superada = signal(false);
  readonly desfecho = signal<DesfechoDaDecisao | null>(null);

  alternar(concessaoId: string): void {
    this.marcadas.update((atuais) => {
      const proximas = new Set(atuais);
      if (!proximas.delete(concessaoId)) proximas.add(concessaoId);
      return proximas;
    });
  }

  escolherEtapa(etapa: EtapaDaVersao): void {
    this.etapa.set(etapa);
    this.marcadas.set(new Set());
  }

  liberar(reclassificacao: ReclassificacaoDto): Promise<void> {
    return this.enviar(reclassificacao, 'liberada', null);
  }

  pedirManutencao(): void {
    if (this.escrita.gravando()) return;
    if (this.semAlvo()) {
      this.falhar(SEM_CONCESSAO_MARCADA);
      return;
    }
    this.erro.set(null);
    this.motivo.reiniciar();
    this.pedindoMotivo.set(true);
  }

  manter(reclassificacao: ReclassificacaoDto): Promise<void> {
    const motivo = this.motivo.exigir();
    return motivo === null ? Promise.resolve() : this.enviar(reclassificacao, 'mantida', motivo);
  }

  private enviar(
    reclassificacao: ReclassificacaoDto,
    resultado: ResultadoDaReclassificacao,
    motivo: string | null,
  ): Promise<void> {
    const etapa = this.etapa();
    if (etapa === undefined || this.semAlvo()) {
      this.falhar(SEM_CONCESSAO_MARCADA);
      return Promise.resolve();
    }
    const escolhidas = [...this.marcadas()];
    const todas = this.alcance() === 'todas';
    const corpo = { etapa, resultado, concessoes: todas ? null : escolhidas, todas, motivo };
    return this.escrita.executar(
      'decisao',
      () => this.gravar(reclassificacao, corpo),
      (mensagem) => this.falhar(mensagem),
    );
  }

  private semAlvo(): boolean {
    return this.alcance() === 'marcadas' && this.marcadas().size === 0;
  }

  private async gravar(
    reclassificacao: ReclassificacaoDto,
    corpo: Parameters<ReclassificacoesApi['decidir']>[1],
  ): Promise<void> {
    this.erro.set(null);
    this.desfecho.set(null);
    const { resultado } = await this.chaves.enviar(`decidir:${reclassificacao.id}`, corpo, (c) =>
      this.api.decidir(reclassificacao.id, corpo, c),
    );
    if (resultado.ok) {
      this.concluir(desfechoDaDecisao(resultado.data, reclassificacao.concessoes));
    } else {
      this.recusar(resultado.problem);
    }
  }

  private concluir(desfecho: DesfechoDaDecisao): void {
    this.pedindoMotivo.set(false);
    this.marcadas.set(new Set());
    this.desfecho.set(desfecho);
    this.notificacoes.success('Decisão registrada');
    this.escrita.recarregar();
  }

  private recusar(problema: ProblemDetails): void {
    if (this.pedindoMotivo() && this.motivo.recusar(problema)) return;
    const texto = mensagemDaRecusa(this.problemas, this.notificacoes, problema);
    if (problema.code === DOCUMENTO_NAO_LIDO) {
      this.pedindoMotivo.set(false);
      this.erro.set(texto);
      this.pedidoDeLeitura.update((n) => n + 1);
      return;
    }
    if (problema.code === SUPERADA) {
      this.superada.set(true);
      this.pedindoMotivo.set(false);
    }
    this.falhar(texto);
  }

  private falhar(mensagem: string): void {
    this.erro.set(mensagem);
    this.pedidoDeFocoNoErro.update((n) => n + 1);
  }
}
