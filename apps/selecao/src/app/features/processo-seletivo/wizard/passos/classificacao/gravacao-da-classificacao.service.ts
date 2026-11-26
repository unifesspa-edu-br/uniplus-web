import { computed, inject, Injectable, signal } from '@angular/core';
import type { DefinirClassificacaoRequest } from '@uniplus/shared-data/selecao';
import {
  type CausaDeCampo,
  type ProblemDetails,
  ProblemI18nService,
  separarCausas,
} from '@uniplus/shared-core/http';

import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import {
  gravarNoPasso,
  RESPOSTA_DESCARTADA,
  type RespostaDescartada,
} from '../../shared/gravacao/gravacao-no-passo';
import type { ResultadoGravacaoComInconclusiva } from '../../shared/gravacao/resultado-da-gravacao';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { resumoDaRecusa } from '../../shared/resumo-da-recusa';
import {
  conferirDesempateGravado,
  type PendenciaDoCriterioGravado,
} from '../desempate/conferencia-do-desempate-gravado';
import {
  recusaDaEliminacao,
  recusasDoCorte,
  type CampoDaRegra,
} from '../eliminacao/recusas-da-eliminacao';
import { quadroDoCorte, rotuloDaArea } from '../eliminacao/regras-de-eliminacao';
import { confirmacaoDaClassificacao } from './confirmacao-da-classificacao';
import { LeituraDoCadastroDePesos } from './leitura-do-cadastro-de-pesos.service';
import {
  comoComandoDeClassificacao,
  ehCampoDaEscala,
  ehCampoDaResolucao,
} from './classificacao-para-comando';
import {
  FATO_DA_EDICAO_DO_ENEM,
  comoOpcoesDasEdicoes,
  declaraEdicoesDoEnem,
} from './edicoes-do-enem';
import { mensagemDaRecusaDaEscala, mensagemDaRecusaDaResolucao } from './recusas-da-classificacao';
import {
  recusaDaClassificacaoPeloDesempate,
  recusaPorCriterioGravadoSemQuadro,
} from '../desempate/recusas-do-desempate';

const MENSAGEM_SEM_CADASTRO_DO_PROCESSO =
  'O cadastro do processo precisa estar concluído antes de configurar a classificação.';

/**
 * A gravação da classificação inteira — regra de cálculo, precisão, ordem de alocação e o vetor de
 * eliminação — num comando só, e o que ela diz ao responder: as recusas por campo das regras, o
 * quadro de pesos que o servidor congelou e as edições do ENEM, gravadas depois.
 *
 * Os passos Fórmula e Eliminação gravam por aqui, cada um com o que o rascunho tem nos dois: o
 * comando substitui a classificação inteira, e não há gravação parcial dela.
 */
@Injectable()
export class GravacaoDaClassificacao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicial);
  private readonly cadastroDePesos = inject(LeituraDoCadastroDePesos);
  private readonly releitura = inject(ReleituraDoSnapshot);
  private readonly problemI18n = inject(ProblemI18nService);

  /** Só a classificação: uma tecla em outro passo não refaz a conferência do desempate. */
  private readonly classificacao = computed(() => this.store.draft().classificacao);

  /**
   * As recusas do servidor a um campo de uma regra, por `índice.campo`. Ficam junto do campo até
   * a regra mudar ou a gravação seguinte responder.
   */
  private readonly recusasPorCampo = signal<ReadonlyMap<string, string>>(new Map());

  recusaDoCampo(indice: number, campo: CampoDaRegra): string | null {
    return this.recusasPorCampo().get(`${indice}.${campo}`) ?? null;
  }

  /** As posições seguintes mudam: as recusas guardadas por índice deixam de apontar a regra certa. */
  esquecerRecusas(): void {
    this.recusasPorCampo.set(new Map());
  }

  esquecerRecusasDa(indice: number): void {
    const restantes = [...this.recusasPorCampo()].filter(
      ([chave]) => !chave.startsWith(`${indice}.`),
    );
    if (restantes.length < this.recusasPorCampo().size)
      this.recusasPorCampo.set(new Map(restantes));
  }

  /**
   * As áreas que o cadastro lido não tem em todos os grupos da resolução do rascunho. Só avisa: a
   * gravação copia o quadro do cadastro que o servidor tem, que pode ter mudado depois da leitura,
   * e quem julga é ele.
   */
  readonly avisoDoDesempatePorArea = computed(() => {
    // Só para consulta não há gravação a avisar.
    if (!this.store.edicaoPermitida()) return [];
    const resolucao = this.classificacao().resolucaoPesoAreaEnem;
    return this.pendenciasDoDesempateGravado()
      .filter(({ semQuadro }) => !semQuadro)
      .map((pendencia) => avisoDoCriterioSemArea(pendencia, resolucao));
  });

  private readonly pendenciasDoDesempateGravado = computed<readonly PendenciaDoCriterioGravado[]>(
    () => {
      // Depois de uma gravação do desempate sem resposta conclusiva, só o servidor sabe o que tem.
      const gravados = this.store.classificacao.criteriosDesempateGravados();
      if (gravados === null) return [];
      const conferencia = conferirDesempateGravado(
        gravados,
        this.classificacao(),
        this.cadastroDePesos.leitura(),
      );
      return conferencia.resultado === 'com-pendencias' ? conferencia.pendencias : [];
    },
  );

  /**
   * O resumo do que a gravação envia, ou `null` quando ela já se sabe recusada: sem confirmação, o
   * `gravar()` mostra a recusa sem chamar a API.
   */
  confirmacao(): ConfirmacaoDeGravacao | null {
    if (this.recusasCertasPeloDesempate().length > 0) return null;

    return confirmacaoDaClassificacao({
      draft: this.store.draft(),
      avisosDoDesempate: this.avisoDoDesempatePorArea(),
      criteriosAdiados: this.criteriosAdiados(),
      rotuloDaArea: (codigo) => rotuloDaArea(this.quadroDoCorte(), codigo),
    });
  }

  /**
   * O passo Desempate adia a gravação dos critérios por área até a classificação: é aqui que eles
   * saem, e quem confirma precisa ver quais são.
   */
  private criteriosAdiados() {
    return this.store.classificacao.desempatePendenteDeGravacao()
      ? this.store.draft().desempate
      : [];
  }

  private quadroDoCorte() {
    return quadroDoCorte(
      this.classificacao(),
      this.cadastroDePesos.leitura(),
      this.store.classificacao.gravada(),
    );
  }

  /**
   * O servidor recusa a classificação que deixa sem nota de área um critério de desempate já
   * gravado que a cita. Com o rascunho fora do ENEM pela média ponderada, a recusa é certa, e a
   * gravação nem é tentada. Confere o que está gravado, e por isso fica fora do `validar()` dos
   * passos: a publicação valida todos antes de gravá-los, e o Desempate, gravado antes, pode
   * resolver a pendência.
   */
  private recusasCertasPeloDesempate(): string[] {
    return this.pendenciasDoDesempateGravado()
      .filter(({ semQuadro }) => semQuadro)
      .map(({ posicao }) => recusaPorCriterioGravadoSemQuadro(posicao));
  }

  /** Grava a classificação do rascunho e, dando certo, as edições do ENEM aceitas. */
  gravar(): Promise<ValidacaoDoPasso | RespostaDescartada> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) return recusada([MENSAGEM_SEM_CADASTRO_DO_PROCESSO]);

    const certas = this.recusasCertasPeloDesempate();
    if (certas.length > 0) return recusada(certas);
    return gravarNoPasso(this.store, () => this.enviarClassificacao(processoId));
  }

  private async enviarClassificacao(
    processoId: string,
  ): Promise<ValidacaoDoPasso | RespostaDescartada> {
    const geracao = this.store.geracao();
    const comando = comoComandoDeClassificacao(this.classificacao());
    const resultado = await this.releitura.gravando(() =>
      this.definirClassificacao(processoId, comando, geracao),
    );

    if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
    if (!resultado.ok) return { valid: false, messages: this.mensagensDaRecusa(resultado.problem) };
    const edicoes = await this.gravarEdicoesDoEnem(processoId);
    return geracao !== this.store.geracao() ? RESPOSTA_DESCARTADA : edicoes;
  }

  /**
   * Sem resposta conclusiva o servidor pode ter gravado, com ou sem quadro: o que ele tem fica
   * desconhecido.
   */
  private async definirClassificacao(
    processoId: string,
    comando: DefinirClassificacaoRequest,
    geracao: number,
  ): Promise<ResultadoGravacaoComInconclusiva> {
    const resposta = await this.cadastro.definirClassificacao(processoId, comando);
    if (geracao !== this.store.geracao()) return resposta;
    if (resposta.ok) this.registrarGravacaoConcluida(comando.resolucaoPesoAreaEnem ?? null);
    else if (resposta.inconclusiva) this.store.classificacao.marcarDesconhecida();
    return resposta;
  }

  private registrarGravacaoConcluida(resolucaoGravada: string | null): void {
    this.esquecerRecusas();
    this.store.classificacao.descartarRecusas();
    this.store.classificacao.recusaDaEscalaDaNotaFinal.set(null);
    this.registrarQuadroCongelado(resolucaoGravada);
  }

  /**
   * As edições do ENEM escolhidas na fórmula, gravadas depois da classificação: o servidor só as
   * aceita de processo cuja classificação gravada é baseada em ENEM. Sem edição escolhida não há o
   * que gravar, e a pendência de publicação diz que falta declará-las.
   */
  private async gravarEdicoesDoEnem(processoId: string): Promise<ValidacaoDoPasso> {
    const draft = this.store.draft();
    const edicoes = draft.classificacao.edicoesEnem;
    if (!declaraEdicoesDoEnem(draft) || edicoes.length === 0) return { valid: true };

    const resposta = await this.cadastro.definirOpcoesDeclaradas(
      processoId,
      FATO_DA_EDICAO_DO_ENEM,
      { opcoes: comoOpcoesDasEdicoes(edicoes) },
    );
    return resposta.ok ? this.edicoesAceitas() : this.edicoesRecusadas(resposta.problem);
  }

  private edicoesAceitas(): ValidacaoDoPasso {
    this.store.classificacao.recusaDasEdicoesDoEnem.set(null);
    return { valid: true };
  }

  private edicoesRecusadas(problema: ProblemDetails): ValidacaoDoPasso {
    const { title, detail } = this.problemI18n.resolve(problema);
    const recusa = detail ?? title;
    this.store.classificacao.recusaDasEdicoesDoEnem.set(recusa);
    return { valid: false, messages: [`Edições do ENEM, no passo Fórmula: ${recusa}`] };
  }

  /**
   * O resumo da recusa: a recusa da resolução, com o texto da tela e o passo onde corrigir; a
   * recusa por um critério de desempate já gravado, com o texto da tela, qualquer que seja o campo
   * que o servidor apontou; e o título da raiz, pelo `ProblemI18nService`, para o que a tela não
   * explica.
   *
   * As recusas sob o campo da resolução ficam guardadas para aparecer no passo da fórmula. Uma
   * resposta que julgou o campo substitui as duas — a da resolução e a de um critério de desempate
   * gravado — pelo que ela traz. Uma resposta sem ele não as apaga: o servidor recusa outros campos
   * antes de chegar a julgar a resolução, e só a gravação que dá certo prova que ela passou.
   */
  private mensagensDaRecusa(problema: ProblemDetails): string[] {
    const erros = separarCausas(problema.errors).deCampo;
    this.recusasPorCampo.set(recusasDoCorte(erros));
    this.guardarRecusasDaResolucao(erros);
    const recusaDaEscala = this.guardarRecusaDaEscala(erros);

    return resumoDaRecusa(
      problema,
      (erro) => textoDaRecusa(erro, recusaDaEscala),
      () => this.problemI18n.resolve(problema).title,
    );
  }

  /** As recusas sob o campo da resolução: a da resolução e a de um critério de desempate gravado. */
  private guardarRecusasDaResolucao(erros: readonly CausaDeCampo[]): void {
    const sobOCampo = erros.filter((erro) => ehCampoDaResolucao(erro.field));
    if (sobOCampo.length === 0) return;

    const peloDesempate = sobOCampo.map(recusaDaClassificacaoPeloDesempate);
    const [daResolucao] = sobOCampo.filter((_, indice) => peloDesempate[indice] === null);
    this.store.classificacao.recusarPeloDesempate(
      peloDesempate.find((recusa) => recusa !== null) ?? null,
      this.cadastroDePesos.leitura().pedida,
    );
    this.store.classificacao.recusaDaResolucaoPesoAreaEnem.set(
      daResolucao === undefined ? null : mensagemDaRecusaDaResolucao(daResolucao),
    );
  }

  /** A recusa da escala da nota final, guardada para o passo da fórmula; `null` sem recusa dela. */
  private guardarRecusaDaEscala(erros: readonly CausaDeCampo[]): string | null {
    const daEscala = erros.find((erro) => ehCampoDaEscala(erro.field));
    const recusa = daEscala === undefined ? null : mensagemDaRecusaDaEscala(daEscala);
    if (recusa !== null) this.store.classificacao.recusaDaEscalaDaNotaFinal.set(recusa);
    return recusa;
  }

  /**
   * A gravação que deu certo diz o que o processo passou a ter: sem resolução, nenhum quadro; com
   * ela, o quadro que o cadastro do servidor tinha para a resolução. O cadastro lido aqui dá a
   * cópia presumida, por confirmar na releitura que `gravando` faz — ou que a publicação faz no fim
   * da varredura; sem ele lido, só a releitura diz o que foi copiado.
   */
  private registrarQuadroCongelado(resolucaoGravada: string | null): void {
    const cadastro = this.cadastroDePesos.leitura();
    const quadro = cadastro.lido ? cadastro.quadroDaResolucaoEscolhida : [];
    if (resolucaoGravada === null) this.store.classificacao.registrarGravadaSemQuadro();
    else if (quadro.length > 0)
      this.store.classificacao.registrarGravadaComQuadro(resolucaoGravada, quadro);
    else this.store.classificacao.marcarDesconhecida();
  }
}

function recusada(messages: string[]): Promise<ValidacaoDoPasso> {
  return Promise.resolve({ valid: false, messages });
}

/** O texto da tela para a recusa de um campo, ou `null` quando a tela não a explica. */
function textoDaRecusa(
  erro: Pick<CausaDeCampo, 'field' | 'code'>,
  recusaDaEscala: string | null,
): string | null {
  return (
    recusaDaEliminacao(erro) ??
    (ehCampoDaEscala(erro.field) && recusaDaEscala !== null
      ? `Escala da nota final, no passo Fórmula: ${recusaDaEscala}`
      : null) ??
    recusaDaClassificacaoPeloDesempate(erro) ??
    (ehCampoDaResolucao(erro.field)
      ? `Resolução de Peso por Área, no passo Fórmula: ${mensagemDaRecusaDaResolucao(erro)}`
      : null)
  );
}

function avisoDoCriterioSemArea(
  { posicao, fora, todas }: PendenciaDoCriterioGravado,
  resolucao: string,
): string {
  // Retirar todas as áreas deixaria o critério vazio, que o próprio Desempate recusa.
  const correcao = todas
    ? 'troque a regra do critério ou remova-o no passo Desempate e grave o passo'
    : 'retire a área no passo Desempate e grave o passo';
  return `Pelo cadastro de Peso por Área lido, o critério de desempate ${posicao} gravado cita ${fora.join(', ')}, que a resolução ${resolucao} não tem em todos os grupos, e a gravação deve ser recusada: ${correcao}, ou escolha outra resolução no passo Fórmula. Se o cadastro mudou, atualize a lista.`;
}
