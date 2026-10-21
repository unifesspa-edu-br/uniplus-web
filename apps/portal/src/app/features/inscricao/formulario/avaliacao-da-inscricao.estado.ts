import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, map, switchMap } from 'rxjs';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import type {
  AvaliacaoDaInscricaoDto,
  AvaliacaoDaInscricaoRequest,
} from '@uniplus/shared-data/selecao';
import type {
  AvaliacaoNaTela,
  DependenciasDaAvaliacao,
  DocumentosAvaliados,
  ModalidadesAvaliadas,
  SimulacaoDoFormulario,
} from '@uniplus/shared-ui/components';

import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';

/** O tempo sem nova mudança antes de consultar: quem digita não dispara uma consulta por tecla. */
export const ESPERA_DA_CONSULTA_MS = 400;

const FORA_DO_PERIODO = 'uniplus.selecao.inscricao.fora_do_periodo';
const FALHA_GENERICA = 'Não foi possível atualizar agora.';

interface Consulta {
  readonly revisao: number;
  readonly corpo: AvaliacaoDaInscricaoRequest;
}

/**
 * O que a API calcula das respostas da inscrição (ADR-0143), compartilhado pelos blocos que o mostram.
 * Consulta só quando muda uma resposta de que a avaliação depende, e guarda a revisão dessas respostas:
 * uma avaliação calculada sobre respostas que já mudaram nunca sobrescreve a mais nova.
 */
@Injectable()
export class AvaliacaoDaInscricaoEstado {
  private readonly servico = inject(InscricaoDoCandidatoService);
  private readonly problemas = inject(ProblemI18nService);

  private readonly modalidades = signal<ModalidadesAvaliadas | null>(null);
  private readonly modalidadesSegundaOpcao = signal<ModalidadesAvaliadas | null>(null);
  private readonly documentos = signal<DocumentosAvaliados | null>(null);
  private readonly calculando = signal(false);
  private readonly erro = signal<string | null>(null);

  /** O estado que os blocos mostram; nulo antes da primeira avaliação. */
  readonly naTela = computed<AvaliacaoNaTela | null>(() => {
    const modalidades = this.modalidades();
    const modalidadesSegundaOpcao = this.modalidadesSegundaOpcao();
    const documentos = this.documentos();
    const vazia = modalidades === null && documentos === null;
    if (vazia && !this.calculando() && this.erro() === null) return null;
    return {
      modalidades,
      modalidadesSegundaOpcao,
      documentos,
      calculando: this.calculando(),
      erro: this.erro(),
    };
  });

  private processoId = '';
  private dependencias: DependenciasDaAvaliacao | null = null;
  private impressao: string | null = null;
  private oferta: string | null = null;
  private segundaOferta: string | null = null;
  private ultimoCorpo: AvaliacaoDaInscricaoRequest | null = null;
  private revisaoAtual = 0;
  private readonly consultas = new Subject<Consulta>();

  constructor() {
    this.consultas
      .pipe(
        debounceTime(ESPERA_DA_CONSULTA_MS),
        switchMap((consulta) =>
          this.servico
            .avaliar(this.processoId, consulta.corpo)
            .pipe(map((resultado) => ({ consulta, resultado }))),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(({ consulta, resultado }) => {
        if (consulta.revisao !== this.revisaoAtual) return;
        this.calculando.set(false);
        if (resultado.ok) {
          this.aplicar(resultado.data);
          return;
        }
        this.erro.set(
          resultado.problem.code === FORA_DO_PERIODO
            ? this.problemas.resolve(resultado.problem).title
            : FALHA_GENERICA,
        );
      });
  }

  /** Parte da avaliação que veio com a inscrição, sem consultar. */
  iniciar(
    processoId: string,
    avaliacao: AvaliacaoDaInscricaoDto,
    dependencias: DependenciasDaAvaliacao | null | undefined,
    simulacao: SimulacaoDoFormulario,
    oferta: string | null,
    segundaOferta: string | null,
  ): void {
    this.processoId = processoId;
    this.oferta = oferta;
    this.segundaOferta = segundaOferta;
    this.dependencias = dependencias ?? null;
    this.impressao = impressaoDasDependencias(simulacao, this.dependencias);
    this.ultimoCorpo = null;
    this.revisaoAtual++;
    this.calculando.set(false);
    this.aplicar(avaliacao);
  }

  /**
   * As respostas mudaram. Só consulta se mudou uma de que a avaliação depende; o corpo é montado só
   * nesse caso.
   */
  respostasMudaram(
    simulacao: SimulacaoDoFormulario,
    corpo: () => AvaliacaoDaInscricaoRequest,
  ): void {
    if (this.dependencias === null) return;
    const impressao = impressaoDasDependencias(simulacao, this.dependencias);
    if (impressao === this.impressao) return;
    this.impressao = impressao;
    this.revisaoAtual++;
    this.consultar(corpo());
  }

  /**
   * O candidato trocou a 1ª ou a 2ª opção de curso na tela, sem gravar. Cada oferta tem as próprias
   * modalidades e documentos, então a avaliação mostrada deixa de valer e a consulta sai com as ofertas
   * novas — mesmo que nenhuma resposta tenha mudado. O corpo é montado só quando uma oferta de fato mudou.
   */
  ofertaMudou(
    oferta: string | null,
    segundaOferta: string | null,
    corpo: () => AvaliacaoDaInscricaoRequest,
  ): void {
    const primeiraMudou = oferta !== this.oferta;
    const segundaMudou = segundaOferta !== this.segundaOferta;
    if (!primeiraMudou && !segundaMudou) return;
    // As modalidades de uma opção cujo curso mudou não valem para o curso novo, e com duas opções elas
    // estão sob o título do curso: não ficam à vista enquanto a nova avaliação não chega.
    if (segundaMudou) this.modalidadesSegundaOpcao.set(null);
    if (primeiraMudou && (segundaOferta !== null || this.segundaOferta !== null)) {
      this.modalidades.set(null);
    }
    this.oferta = oferta;
    this.segundaOferta = segundaOferta;
    this.revisaoAtual++;
    this.consultar(corpo());
  }

  /** A revisão das respostas agora — quem grava a guarda para aplicar a avaliação que voltar. */
  revisao(): number {
    return this.revisaoAtual;
  }

  /**
   * A avaliação que voltou do salvar ou da releitura. Vale só se nenhuma resposta de que ela depende
   * mudou desde que o pedido saiu: senão ela descreve respostas que o candidato já trocou.
   */
  aplicarDaGravacao(avaliacao: AvaliacaoDaInscricaoDto, revisaoNoPedido: number): void {
    if (revisaoNoPedido !== this.revisaoAtual) return;
    this.calculando.set(false);
    this.aplicar(avaliacao);
  }

  tentarDeNovo(): void {
    this.reavaliar();
  }

  /**
   * Consulta de novo com as mesmas respostas: o que mudou foi o que o candidato enviou ou removeu, e a
   * situação de cada documento vem da avaliação.
   */
  reavaliar(): void {
    if (this.ultimoCorpo !== null) this.consultar(this.ultimoCorpo);
  }

  private consultar(corpo: AvaliacaoDaInscricaoRequest): void {
    this.ultimoCorpo = corpo;
    this.erro.set(null);
    this.calculando.set(true);
    this.consultas.next({ revisao: this.revisaoAtual, corpo });
  }

  private aplicar(avaliacao: AvaliacaoDaInscricaoDto): void {
    this.erro.set(null);
    this.modalidades.set(avaliacao.modalidades);
    this.modalidadesSegundaOpcao.set(avaliacao.modalidadesSegundaOpcao ?? null);
    this.documentos.set(avaliacao.documentos);
  }
}

/**
 * As respostas de que a avaliação depende, numa forma comparável: os fatos, os subitens das ocorrências
 * (`GRUPO.FATO`) e as ocorrências de cada grupo. Duas simulações com a mesma impressão dão a mesma
 * avaliação.
 */
export function impressaoDasDependencias(
  simulacao: SimulacaoDoFormulario,
  dependencias: DependenciasDaAvaliacao | null,
): string | null {
  if (dependencias === null) return null;
  const respostas = simulacao.respostas ?? {};
  const grupos = simulacao.grupos ?? {};
  const fatos = dependencias.fatos.map((fato) => {
    const [grupo, subitem] = fato.split('.');
    if (subitem === undefined) return [fato, respostas[fato] ?? null];
    return [fato, (grupos[grupo] ?? []).map((o) => [o.id, o.respostas?.[subitem] ?? null])];
  });
  const ocorrencias = dependencias.grupos.map((grupo) => [
    grupo,
    (grupos[grupo] ?? []).map((o) => o.id),
  ]);
  return JSON.stringify([fatos, ocorrencias]);
}
