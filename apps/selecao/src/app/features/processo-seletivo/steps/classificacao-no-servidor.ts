import { computed, signal } from '@angular/core';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { CriterioDesempateConfigurado } from './processo-seletivo.models';
import type { MotivoDaReleitura } from './shared/motivo-da-releitura';
import {
  mesmoQuadro,
  quadroCongelado,
  type CopiaCongelada,
  type GrupoDoQuadro,
} from './shared/quadro-de-pesos';
import { CODIGO_ESCALA_DA_NOTA_FINAL_NAO_DECLARADA } from './steps/classificacao/escala-da-nota-final';

/**
 * O que se sabe da classificação que o processo tem no servidor. `desconhecida` vale depois de uma
 * gravação sem resposta conclusiva, ou que deu certo com a resolução sem o cadastro de Peso por
 * Área lido e por isso não diz o que foi copiado: só uma releitura decide. O servidor só conta
 * como quadro o que tem ao menos um grupo.
 *
 * `com-quadro` sem `confirmada` é a cópia que a gravação presume, a do cadastro lido pelo cliente:
 * o servidor copia o dele no momento da gravação, que pode ser mais novo.
 */
export type ClassificacaoGravada =
  | { readonly estado: 'nunca-gravada' }
  | { readonly estado: 'sem-quadro' }
  | {
      readonly estado: 'com-quadro';
      readonly resolucao: string;
      readonly grupos: readonly GrupoDoQuadro[];
      readonly confirmada: boolean;
    }
  | { readonly estado: 'desconhecida' };

/**
 * O estado da classificação gravada e das recusas que ela gera. Vive no store, e não no passo,
 * porque a Eliminação grava a classificação enquanto os campos recusados são do passo da fórmula:
 * sem um lugar comum, o operador voltava à fórmula e não via ali o que o servidor recusou.
 */
export class ClassificacaoNoServidor {
  /**
   * Recusa ao campo `resolucaoPesoAreaEnem` na última gravação. Some quando a resolução muda ou
   * deixa de ser exigida, quando o cadastro é relido e quando a gravação seguinte dá certo; uma
   * recusa de outro campo não a apaga, porque o servidor pode ter recusado antes de julgá-la.
   */
  readonly recusaDaResolucaoPesoAreaEnem = signal<string | null>(null);

  /** Recusa ao campo `escalaNotaFinal` (a escala que não é maior que zero). Some quando a escala muda e quando a gravação seguinte dá certo. */
  readonly recusaDaEscalaDaNotaFinal = signal<string | null>(null);

  /** Recusa às edições do ENEM, gravadas pela Eliminação logo depois da classificação. Some quando a gravação seguinte dá certo. */
  readonly recusaDasEdicoesDoEnem = signal<string | null>(null);

  /**
   * Recusa da gravação da classificação por um critério de desempate já gravado que compara a nota
   * de área do ENEM. Some como a da resolução; depois de gravar o desempate ou reler o cadastro,
   * só quando a conferência dos critérios gravados mostra que a pendência acabou, e com os
   * critérios gravados desconhecidos ela fica.
   */
  readonly recusaPeloDesempatePorArea = signal<string | null>(null);

  /** A leitura do cadastro de Peso por Área em mãos quando o servidor recusou pelo desempate: só uma leitura posterior diz que a área recusada passou a valer. */
  readonly leituraDoCadastroNaRecusaPeloDesempate = signal(0);

  /** Os critérios gravados que o servidor julgou ao recusar pelo desempate. */
  readonly criteriosNaRecusaPeloDesempate = signal<readonly CriterioDesempateConfigurado[] | null>(
    null,
  );

  /**
   * Os códigos dos itens que a conferência de publicação acusa como pendentes. A Revisão os
   * entrega enquanto está montada e os retira ao sair; os outros passos derivam o que lhes cabe.
   */
  readonly pendenciasDaConferencia = signal<readonly string[]>([]);

  /** A classificação por fórmula local não declarou a escala da nota final, campo do passo da fórmula. */
  readonly escalaDaNotaFinalPendente = computed(() =>
    this.pendenciasDaConferencia().includes(CODIGO_ESCALA_DA_NOTA_FINAL_NAO_DECLARADA),
  );

  readonly gravada = signal<ClassificacaoGravada>({ estado: 'nunca-gravada' });

  readonly motivoDaReleitura = computed(() => motivoDaReleitura(this.gravada()));

  readonly porReler = computed(() => this.motivoDaReleitura() !== null);

  /** O quadro que o processo congelou, quando se sabe que ele tem um e quais são os valores. */
  readonly copiaCongeladaEmVigor = computed<CopiaCongelada | null>(() => {
    const gravada = this.gravada();
    return gravada.estado === 'com-quadro' && gravada.confirmada
      ? { resolucao: gravada.resolucao, grupos: gravada.grupos }
      : null;
  });

  /**
   * Os critérios de desempate que o servidor tem, pela leitura do processo e pelas gravações desta
   * sessão. A gravação da classificação é conferida contra eles, e não contra o rascunho. `null`
   * depois de uma gravação sem resposta conclusiva: só o servidor sabe o que tem.
   */
  readonly criteriosDesempateGravados = signal<readonly CriterioDesempateConfigurado[] | null>([]);

  /**
   * O Desempate deixou os critérios para gravar depois da classificação: o servidor recusa o
   * critério por área enquanto o processo não tem o quadro congelado, e quem o congela é a
   * gravação da classificação, no passo seguinte.
   */
  readonly desempatePendenteDeGravacao = signal(false);

  /** Algo do que o servidor tem só uma releitura do processo diz. */
  readonly gravadoPorReler = computed(
    () => this.porReler() || this.criteriosDesempateGravados() === null,
  );

  /**
   * Muda a cada troca de processo e a cada leitura que muda a classificação conhecida (a que só
   * confirma o que já se sabia não muda). Uma leitura do cadastro de Peso por Área pedida nesta
   * versão, ou depois, é posterior ao que o processo congelou.
   */
  readonly versaoLida = signal(0);

  recusarPeloDesempate(recusa: string | null, leituraDoCadastro: number): void {
    this.recusaPeloDesempatePorArea.set(recusa);
    this.leituraDoCadastroNaRecusaPeloDesempate.set(leituraDoCadastro);
    this.criteriosNaRecusaPeloDesempate.set(this.criteriosDesempateGravados());
  }

  /** A resolução mudou, deixou de ser exigida ou foi gravada: as recusas eram sobre a de antes. */
  descartarRecusas(): void {
    this.recusaDaResolucaoPesoAreaEnem.set(null);
    this.recusaPeloDesempatePorArea.set(null);
  }

  /**
   * A classificação lida do servidor. Só ela: a releitura depois de gravar não pode mexer no
   * `remoteSnapshot`, de que outros passos derivam estado, nem no rascunho em edição.
   */
  registrarLida(classificacao: ProcessoSeletivoDto['classificacao']): void {
    const lida = classificacaoGravadaDe(classificacao);
    if (!mesmaClassificacao(this.gravada(), lida)) this.aoTrocarDeProcesso();
    this.gravada.set(lida);
  }

  /**
   * A gravação sem resolução nenhuma deixa o processo com uma classificação sem quadro e dispensa
   * a releitura para sabê-lo. Sem este registro, o desempate seria conferido contra o rascunho, e
   * não contra o servidor.
   */
  registrarGravadaSemQuadro(): void {
    this.gravada.set({ estado: 'sem-quadro' });
  }

  /** A gravação com a resolução copiou o quadro do cadastro do servidor; o lido aqui é a cópia presumida, por confirmar na releitura. */
  registrarGravadaComQuadro(resolucao: string, grupos: readonly GrupoDoQuadro[]): void {
    this.gravada.set({ estado: 'com-quadro', resolucao, grupos, confirmada: false });
  }

  /** A gravação ficou sem resposta conclusiva: o que o processo tem só uma releitura decide. */
  marcarDesconhecida(): void {
    this.gravada.set({ estado: 'desconhecida' });
  }

  /** Invalida o que se leu do cadastro de Peso por Área até aqui. */
  aoTrocarDeProcesso(): void {
    this.versaoLida.update((versao) => versao + 1);
  }

  reiniciar(): void {
    this.recusaDaResolucaoPesoAreaEnem.set(null);
    this.recusaDaEscalaDaNotaFinal.set(null);
    this.pendenciasDaConferencia.set([]);
    this.recusaDasEdicoesDoEnem.set(null);
    this.recusaPeloDesempatePorArea.set(null);
    this.gravada.set({ estado: 'nunca-gravada' });
    this.criteriosDesempateGravados.set([]);
    this.desempatePendenteDeGravacao.set(false);
    this.aoTrocarDeProcesso();
  }
}

/** A classificação lida sem o quadro fica sem grupo, e não é um erro de leitura. */
function classificacaoGravadaDe(
  classificacao: ProcessoSeletivoDto['classificacao'],
): ClassificacaoGravada {
  if (classificacao === null || classificacao === undefined) return { estado: 'nunca-gravada' };
  const resolucao = classificacao.resolucaoPesoAreaEnem ?? null;
  const grupos = quadroCongelado(classificacao.quadroPesoAreaEnem ?? []);
  return resolucao === null || grupos.length === 0
    ? { estado: 'sem-quadro' }
    : { estado: 'com-quadro', resolucao, grupos, confirmada: true };
}

/** Por que só uma releitura diz o que a classificação gravada tem, ou `null` quando se sabe. */
export function motivoDaReleitura(gravada: ClassificacaoGravada): MotivoDaReleitura | null {
  if (gravada.estado === 'desconhecida') return 'desconhecida';
  return gravada.estado === 'com-quadro' && !gravada.confirmada ? 'por-confirmar' : null;
}

/** A mesma classificação, com os mesmos valores, confirmada ou não. */
function mesmaClassificacao(a: ClassificacaoGravada, b: ClassificacaoGravada): boolean {
  if (a.estado === 'com-quadro' && b.estado === 'com-quadro') {
    return a.resolucao === b.resolucao && mesmoQuadro(a.grupos, b.grupos);
  }
  return a.estado === b.estado;
}
