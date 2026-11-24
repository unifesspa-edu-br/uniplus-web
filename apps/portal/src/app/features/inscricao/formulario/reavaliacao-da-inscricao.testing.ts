import { type Provider, type Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import {
  type AvaliacaoDaInscricaoRequest,
  type InscricaoDto,
  SituacaoInscricaoCodigo,
} from '@uniplus/shared-data/selecao';
import type { SimulacaoDoFormulario } from '@uniplus/shared-ui/components';

import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { ServicoDublê, avaliacao, inicioPadrao, ok } from './avaliacao-da-inscricao.estado.testing';
import type { OfertasEscolhidas } from './corpo-da-inscricao';
import { EscolhaDoCurso } from './escolha-do-curso';
import { GravacaoDaInscricao } from './gravacao-da-inscricao';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';
import { LeituraDaInscricao } from './leitura-da-inscricao';
import { type FormularioParaReavaliar, ReavaliacaoDaInscricao } from './reavaliacao-da-inscricao';

/** A espera do estado antes de a consulta sair, que a reavaliação soma à da verificação. */
const ESPERA_DO_ESTADO_MS = 400;

const INSCRICAO_EM_RASCUNHO: InscricaoDto = {
  id: 'inscricao-1',
  processoSeletivoId: '0199e000-0000-7000-8000-0000000000d1',
  situacao: { codigo: SituacaoInscricaoCodigo.rascunho, rotulo: 'Situação de teste' },
  numeroInscricao: null,
  formulario: {
    versaoFormularioId: 'versao-1',
    respostas: {},
    derivados: {},
    grupos: {},
    aceites: [],
  },
  escolhasDeCurso: {
    ofertaCursoId: null,
    ofertaCursoSegundaOpcaoId: null,
    numeroDeOpcoesDeCurso: 1,
    ofertas: [],
  },
  eTag: '"inscricao-1:1"',
  avaliacao: avaliacao('Ampla concorrência'),
};

/** O corpo da consulta de avaliação com as respostas da tela e as ofertas dadas. */
export const corpoDaConsulta = (
  respostas: Record<string, unknown>,
  ofertaCursoId: string | null = 'oferta-1',
  ofertaCursoSegundaOpcaoId: string | null = null,
): AvaliacaoDaInscricaoRequest => ({
  respostas,
  grupos: {},
  ofertaCursoId,
  ofertaCursoSegundaOpcaoId,
});

/** A reavaliação com o formulário, a leitura, a escolha de curso e a gravação que ela lê, todos controlados pelo teste. */
export class CenarioDaReavaliacao {
  readonly servico = new ServicoDublê();
  readonly inscricao = signal<InscricaoDto | null>(INSCRICAO_EM_RASCUNHO);
  readonly escolhidas = signal<OfertasEscolhidas>({
    ofertaCursoId: 'oferta-1',
    ofertaCursoSegundaOpcaoId: null,
  });
  readonly simulacao = signal<SimulacaoDoFormulario>({ respostas: { CONCORRER_EP: true } });
  readonly emVerificacao = signal(false);
  readonly mudancasDoEnvio = signal(0);
  readonly envio = signal<{ mudancas: Signal<number> } | null>({ mudancas: this.mudancasDoEnvio });
  readonly bloqueada = signal(false);
  readonly releitura = new Subject<void>();
  readonly relerARevisao = vi.fn(() => this.releitura);
  readonly formulario = signal<FormularioParaReavaliar | undefined>({
    simulacao: this.simulacao,
    haArquivoEmVerificacao: this.emVerificacao,
  });
  reavaliacao!: ReavaliacaoDaInscricao;

  static preparar(): CenarioDaReavaliacao {
    ligarRelogioControlado();
    const cenario = new CenarioDaReavaliacao();
    TestBed.configureTestingModule({ providers: cenario.provedores() });
    return cenario;
  }

  encerrar(): void {
    vi.useRealTimers();
    vi.restoreAllMocks();
  }

  /** A página construída: a avaliação iniciada e o formulário acompanhado. */
  async acompanhar(): Promise<void> {
    TestBed.inject(AvaliacaoDaInscricaoEstado).iniciar(inicioPadrao());
    this.reavaliacao = TestBed.inject(ReavaliacaoDaInscricao);
    TestBed.runInInjectionContext(() => this.reavaliacao.acompanhar(this.formulario));
    await passarOTempo(0);
  }

  /** Deixa passar a espera da verificação e a do estado: a consulta já saiu. */
  esperarAConsulta(esperaDaVerificacao: number): Promise<void> {
    return passarOTempo(esperaDaVerificacao + ESPERA_DO_ESTADO_MS);
  }

  /** A API responde à última consulta e a tela assenta. */
  async responderAUltima(resultado = ok(avaliacao('Ampla concorrência'))): Promise<void> {
    this.servico.responder(this.servico.consultas.length - 1, resultado);
    await passarOTempo(0);
  }

  /** O candidato enviou ou removeu um arquivo: o envio avisa que mudou. */
  async mudarOsDocumentos(): Promise<void> {
    this.mudancasDoEnvio.update((n) => n + 1);
    await passarOTempo(0);
  }

  /** A releitura da revisão termina e a consulta da reavaliação sai. */
  async concluirAReleitura(): Promise<void> {
    this.releitura.next();
    await this.esperarAConsulta(0);
  }

  /** A aba muda de visibilidade, como o navegador a avisa. */
  async mudarAAba(visibilidade: 'visible' | 'hidden'): Promise<void> {
    this.definirAVisibilidade(visibilidade);
    document.dispatchEvent(new Event('visibilitychange'));
    await passarOTempo(0);
  }

  /** O estado do documento sem aviso, como está quando a página nasce. */
  definirAVisibilidade(visibilidade: 'visible' | 'hidden'): void {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visibilidade);
  }

  private provedores(): Provider[] {
    return [
      ReavaliacaoDaInscricao,
      AvaliacaoDaInscricaoEstado,
      { provide: InscricaoDoCandidatoService, useValue: this.servico },
      { provide: LeituraDaInscricao, useValue: { inscricao: this.inscricao } },
      { provide: EscolhaDoCurso, useValue: { escolhidas: this.escolhidas } },
      { provide: GravacaoDaInscricao, useValue: this.gravacao() },
    ];
  }

  private gravacao(): object {
    return {
      envioDeDocumentos: this.envio,
      bloqueada: this.bloqueada,
      relerARevisao: this.relerARevisao,
    };
  }
}
