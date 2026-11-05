import { computed, type Signal } from '@angular/core';

import { avaliarConfirmacoes } from './confirmacao-do-campo';
import { AGUARDE_A_VERIFICACAO } from './documentos-avaliados';
import {
  BLOCO_COMPROVACAO_DOCUMENTAL,
  type PassoPrefixado,
  type RespostaFixa,
} from './formulario-do-candidato.model';
import type { NavegacaoDosPassos } from './navegacao-dos-passos';
import type { PassoDoFormulario } from './passos-do-formulario';
import {
  type PendenciaDoPasso,
  pendenciasDo,
  type ProblemaDaConfirmacao,
} from './pendencias-do-passo';
import { contemOCampo } from './recusas-do-servidor';
import type { RespostasDoFormulario } from './respostas-do-formulario';

/** Quantas pendências uma seção tem. */
export interface PendenciaDaSecao {
  readonly chave: string;
  readonly titulo: string;
  readonly quantidade: number;
}

/** O que a conferência pede à tela: dizer algo ao leitor de tela e barrar o avanço do passo de quem hospeda. */
export interface AvisosDaTela {
  dizer(texto: string): void;
  barrarAvanco(chavePrefixada: string): void;
}

/** O que a conferência lê do formulário. */
export interface FontesDaConferencia {
  readonly navegacao: NavegacaoDosPassos;
  readonly respostas: RespostasDoFormulario;
  readonly respostasFixas: Signal<Readonly<Partial<Record<string, RespostaFixa>>>>;
  readonly passos: () => readonly PassoDoFormulario[];
  readonly passosPrefixados: () => readonly PassoPrefixado[];
  readonly exigirSecaoValida: () => boolean;
  readonly aguardaVerificacaoDosDocumentos: () => boolean;
  readonly problemasDaConfirmacao: () => ReadonlyMap<string, ProblemaDaConfirmacao>;
  /** Os passos como ficariam com estas etapas concluídas; nulo quando as regras não se interpretam. */
  readonly passosComEtapasConcluidas: (
    etapas: ReadonlySet<string>,
  ) => readonly PassoDoFormulario[] | null;
  readonly avisos: AvisosDaTela;
}

/**
 * Confere as seções contra o que falta: as pendências de cada uma, a conclusão de todas de uma vez, o
 * avanço barrado pela primeira que falha. Não guarda estado: lê as respostas e a navegação e leva a
 * tela ao que falta.
 */
export class ConferenciaDasSecoes {
  /** As seções com pendência, contadas como ficariam com todas concluídas, sem concluí-las. */
  private readonly pendenciasCompletas = computed(() => {
    const passos = this.passosComTodasConcluidas();
    const problemas = avaliarConfirmacoes(passos, this.entradaDasConfirmacoes());
    const { aceitos, fixasSemResposta } = this.fontes.respostas;
    return passos
      .map((passo) => ({
        passo,
        pendencias: pendenciasDo(passo, aceitos(), problemas, fixasSemResposta()),
      }))
      .filter((secao) => secao.pendencias.length > 0);
  });

  /**
   * As pendências das seções, sem dar nenhuma como concluída: o que o candidato ainda tem de resolver.
   * Quem hospeda monta daqui o motivo de o envio não seguir; `concluirTodas()` é a conta que vale.
   */
  readonly pendenciasPorSecao = computed<readonly PendenciaDaSecao[]>(() =>
    this.pendenciasCompletas().map(({ passo, pendencias }) => ({
      chave: passo.chave,
      titulo: passo.titulo,
      quantidade: pendencias.length,
    })),
  );

  /** As chaves das seções que têm pendência. */
  readonly chavesComPendencia = computed(
    () => new Set(this.pendenciasCompletas().map((s) => s.passo.chave)),
  );

  constructor(private readonly fontes: FontesDaConferencia) {}

  private entradaDasConfirmacoes(): Parameters<typeof avaliarConfirmacoes>[1] {
    const { respostas, respostasFixas } = this.fontes;
    return {
      respostas: respostas.respostasComAsFixas(),
      grupos: respostas.grupos(),
      confirmacoes: respostas.confirmacoes(),
      fixas: respostasFixas(),
    };
  }

  /**
   * Os passos como ficariam com todas as seções concluídas, sem concluí-las: concluir pode tornar não
   * informado o opcional em branco e mostrar um obrigatório, e o motivo do envio precisa contar com ele.
   */
  private passosComTodasConcluidas(): readonly PassoDoFormulario[] {
    let etapas: ReadonlySet<string> = new Set(this.fontes.navegacao.concluidas());
    let passos = this.fontes.passos();
    for (;;) {
      const novas = passos.flatMap((p) => p.etapasNasRegras).filter((e) => !etapas.has(e));
      if (novas.length === 0) return passos;
      etapas = new Set([...etapas, ...novas]);
      const interpretados = this.fontes.passosComEtapasConcluidas(etapas);
      if (interpretados === null) return passos;
      passos = interpretados;
    }
  }

  private pendenciasDoPasso(passo: PassoDoFormulario): PendenciaDoPasso[] {
    const { respostas, problemasDaConfirmacao } = this.fontes;
    return pendenciasDo(
      passo,
      respostas.aceitos(),
      problemasDaConfirmacao(),
      respostas.fixasSemResposta(),
    );
  }

  /**
   * Dá todas as seções como concluídas, como o envio faz, quando nenhuma tem pendência, e devolve
   * quantas pendências há. Com pendência nada é concluído: com `navegar`, leva à seção da primeira, põe
   * o foco no campo e anuncia quantas são; sem ele, só conta, e quem hospeda decide para onde levar.
   */
  concluirTodas(navegar = true): number {
    const secoes = this.pendenciasCompletas();
    const total = secoes.reduce((soma, s) => soma + s.pendencias.length, 0);
    if (total === 0) {
      while (this.fontes.navegacao.concluir(this.fontes.passos())) {
        // Concluir pode mostrar outra seção, que também é concluída.
      }
      return 0;
    }
    if (navegar) {
      const [primeira] = secoes;
      this.irAPendenciaDe(primeira.passo.chave);
      this.fontes.avisos.dizer(
        `${total === 1 ? 'Há 1 item a corrigir' : `Há ${total} itens a corrigir`}. ` +
          `O primeiro está na seção ${primeira.passo.titulo}.`,
      );
    }
    return total;
  }

  /**
   * Leva à seção e põe o foco no primeiro campo pendente dela. Não dá seção nenhuma como concluída,
   * salvo quando o campo só aparece depois de concluir as anteriores ou a própria seção, como o
   * obrigatório que o opcional em branco revela: então conclui, na ordem, só até ele aparecer, e a
   * seção fica com o estado de erro. Sem pendência, leva só à seção.
   */
  irAPendenciaDe(chave: string): void {
    const { navegacao, passos } = this.fontes;
    const primeira = this.pendenciasCompletas().find((s) => s.passo.chave === chave)?.pendencias[0];
    if (!primeira) {
      navegacao.irAoPasso(chave);
      return;
    }
    navegacao.mostrarPendenciaDe(chave);
    const aparece = (): boolean =>
      passos().some((p) => p.chave === chave && contemOCampo(p, primeira.campo));
    // Relidos a cada volta: concluir uma seção pode revelar outra, que também precisa ser concluída.
    while (!aparece()) {
      const proxima = passos().find((p) => !navegacao.concluido(p));
      if (!proxima || !navegacao.concluir([proxima])) break;
    }
    // O campo revelado só existe na tela depois da renderização.
    navegacao.irAoPasso(
      chave,
      () => navegacao.controleDe(primeira.campo, primeira.naConfirmacao),
      true,
    );
  }

  /**
   * Com `exigirSecaoValida`, dá as seções de agora até antes do `destino` como concluídas e, na primeira
   * com pendência, fica nela, põe o foco no primeiro campo pendente e anuncia. O passo prefixado sem
   * `concluido` também barra, e a tela avisa quem hospeda, que dá o foco e o motivo. Diz se barrou.
   */
  pendenciaAntesDe(destino: number): boolean {
    const { navegacao, exigirSecaoValida } = this.fontes;
    if (!exigirSecaoValida() || destino <= navegacao.indice()) return false;
    const chaveDoDestino = navegacao.chaves()[destino];
    // As chaves são relidas a cada passo: concluir uma seção pode mostrar outra no caminho.
    for (let i = navegacao.indice(); ; i++) {
      const chave = navegacao.chaves()[i];
      if (chave === undefined || chave === chaveDoDestino) break;
      // Concluir pode esconder o destino: o que ficou no lugar dele é o novo destino, e não se valida.
      // Depois da última seção não há destino, e a última é validada como as outras.
      if (chaveDoDestino !== undefined && !navegacao.chaves().includes(chaveDoDestino)) break;
      if (this.barraNoPasso(chave)) return true;
    }
    return false;
  }

  private barraNoPasso(chave: string): boolean {
    const { navegacao, passosPrefixados, passos, avisos, aguardaVerificacaoDosDocumentos } =
      this.fontes;
    const prefixado = passosPrefixados().find((p) => p.chave === chave);
    if (prefixado) {
      if (prefixado.concluido === true) return false;
      avisos.barrarAvanco(chave);
      return true;
    }
    const secao = passos().find((p) => p.chave === chave);
    if (!secao) return false;
    if (secao.bloco === BLOCO_COMPROVACAO_DOCUMENTAL && aguardaVerificacaoDosDocumentos()) {
      navegacao.irAoPasso(chave);
      avisos.dizer(AGUARDE_A_VERIFICACAO);
      return true;
    }
    return this.barraNaSecao(secao);
  }

  private barraNaSecao(secao: PassoDoFormulario): boolean {
    const { navegacao, passos, avisos } = this.fontes;
    navegacao.concluir([secao]);
    // Relido depois de concluir: a conclusão pode revelar o que ainda falta na seção.
    const passo = passos().find((p) => p.chave === secao.chave) ?? secao;
    const pendentes = this.pendenciasDoPasso(passo);
    if (pendentes.length === 0) return false;
    const [primeira] = pendentes;
    navegacao.irAoPasso(
      passo.chave,
      () => navegacao.controleDe(primeira.campo, primeira.naConfirmacao),
      true,
    );
    avisos.dizer(
      pendentes.length === 1
        ? `Há 1 item a corrigir na seção ${passo.titulo}.`
        : `Há ${pendentes.length} itens a corrigir na seção ${passo.titulo}.`,
    );
    return true;
  }

  /**
   * Chega ao passo do indicador: para trás ou para um passo já liberado vai direto; para frente, só
   * com as seções do caminho sem pendência.
   */
  irParaSePermitido(destino: number): void {
    const { navegacao } = this.fontes;
    const chave = navegacao.chaves()[destino];
    if (this.pendenciaAntesDe(destino)) return;
    // Concluir uma seção pode mostrar outra: o destino é achado de novo pela chave.
    const indice = navegacao.chaves().indexOf(chave);
    navegacao.irPara(indice >= 0 ? indice : destino);
  }

  /** Dá a seção atual como concluída e segue para a próxima; na última, só conclui. */
  avancar(): void {
    const { navegacao } = this.fontes;
    if (this.pendenciaAntesDe(navegacao.indice() + 1)) return;
    const passo = navegacao.passoAtual();
    if (passo) navegacao.concluir([passo]);
    if (navegacao.indice() < navegacao.total() - 1) navegacao.irPara(navegacao.indice() + 1);
  }
}
