import { inject, Injectable, signal } from '@angular/core';
import { ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';

import { StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import {
  gravarNoPasso,
  RESPOSTA_DESCARTADA,
  type RespostaDescartada,
} from '../../shared/gravacao/gravacao-no-passo';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { resumoDaRecusa } from '../../shared/resumo-da-recusa';
import {
  recusaDaEliminacao,
  recusasDoCorte,
  type CampoDaRegra,
} from '../eliminacao/recusas-da-eliminacao';
import { AcompanhamentoDoCadastroDePesos } from './acompanhamento-do-cadastro-de-pesos.service';
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
import { recusaDaClassificacaoPeloDesempate } from '../desempate/recusas-do-desempate';

/**
 * A gravação da classificação inteira — regra de cálculo, precisão, ordem de alocação e o vetor de
 * eliminação — num comando só, e o que ela diz ao responder: as recusas por campo das regras, o
 * quadro de pesos que o servidor congelou e as edições do ENEM, gravadas depois.
 *
 * É a única gravação das duas telas: gravar também na Fórmula enviaria `regrasEliminacao` vazio
 * antes da hora e derrubaria o item de conformidade que esta gravação levanta.
 */
@Injectable()
export class GravacaoDaClassificacaoService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly cadastroDePesos = inject(AcompanhamentoDoCadastroDePesos);
  private readonly releitura = inject(ReleituraDoSnapshot);
  private readonly problemI18n = inject(ProblemI18nService);

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

  /** Grava a classificação do rascunho e, dando certo, as edições do ENEM aceitas. */
  gravar(processoId: string): Promise<StepValidation | RespostaDescartada> {
    return gravarNoPasso(this.store, async () => {
      const geracao = this.store.geracao();
      const comando = comoComandoDeClassificacao(this.store.draft().classificacao);
      const resultado = await this.releitura.gravando(async () => {
        const resposta = await this.cadastro.definirClassificacao(processoId, comando);
        if (geracao !== this.store.geracao()) return resposta;
        if (resposta.ok) {
          this.esquecerRecusas();
          this.store.classificacao.descartarRecusas();
          this.store.classificacao.recusaDaEscalaDaNotaFinal.set(null);
          this.registrarQuadroCongelado(comando.resolucaoPesoAreaEnem ?? null);
        } else if (resposta.inconclusiva) {
          // O servidor pode ter gravado — com ou sem quadro —, e o que ele tem fica desconhecido.
          this.store.classificacao.marcarDesconhecida();
        }
        return resposta;
      });

      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      if (!resultado.ok) {
        return { valid: false, messages: this.mensagensDaRecusa(resultado.problem) };
      }
      const edicoes = await this.gravarEdicoesDoEnem(processoId);
      return geracao !== this.store.geracao() ? RESPOSTA_DESCARTADA : edicoes;
    });
  }

  /**
   * As edições do ENEM escolhidas na fórmula, gravadas depois da classificação: o servidor só as
   * aceita de processo cuja classificação gravada é baseada em ENEM. Sem edição escolhida não há o
   * que gravar, e a pendência de publicação diz que falta declará-las.
   */
  private async gravarEdicoesDoEnem(processoId: string): Promise<StepValidation> {
    const draft = this.store.draft();
    if (!declaraEdicoesDoEnem(draft) || draft.classificacao.edicoesEnem.length === 0) {
      return { valid: true };
    }

    const resposta = await this.cadastro.definirOpcoesDeclaradas(
      processoId,
      FATO_DA_EDICAO_DO_ENEM,
      { opcoes: comoOpcoesDasEdicoes(draft.classificacao.edicoesEnem) },
    );
    if (resposta.ok) {
      this.store.classificacao.recusaDasEdicoesDoEnem.set(null);
      return { valid: true };
    }

    const { title, detail } = this.problemI18n.resolve(resposta.problem);
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
    this.recusasPorCampo.set(recusasDoCorte(problema.errors ?? []));
    const sobOCampo = (problema.errors ?? []).filter((erro) => ehCampoDaResolucao(erro.field));
    if (sobOCampo.length > 0) {
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

    const daEscala = (problema.errors ?? []).find((erro) => ehCampoDaEscala(erro.field));
    const recusaDaEscala = daEscala === undefined ? null : mensagemDaRecusaDaEscala(daEscala);
    if (recusaDaEscala !== null)
      this.store.classificacao.recusaDaEscalaDaNotaFinal.set(recusaDaEscala);

    return resumoDaRecusa(
      problema,
      (erro) =>
        recusaDaEliminacao(erro) ??
        (ehCampoDaEscala(erro.field) && recusaDaEscala !== null
          ? `Escala da nota final, no passo Fórmula: ${recusaDaEscala}`
          : null) ??
        recusaDaClassificacaoPeloDesempate(erro) ??
        (ehCampoDaResolucao(erro.field)
          ? `Resolução de Peso por Área, no passo Fórmula: ${mensagemDaRecusaDaResolucao(erro)}`
          : null),
      () => this.problemI18n.resolve(problema).title,
    );
  }

  /**
   * A gravação que deu certo diz o que o processo passou a ter: sem resolução, nenhum quadro; com
   * ela, o quadro que o cadastro do servidor tinha para a resolução. O cadastro lido aqui dá a
   * cópia presumida, por confirmar na releitura que `gravando` faz — ou que a publicação faz no fim
   * da varredura; sem ele lido, só a releitura diz o que foi copiado.
   */
  private registrarQuadroCongelado(resolucaoGravada: string | null): void {
    if (resolucaoGravada === null) {
      this.store.classificacao.registrarGravadaSemQuadro();
      return;
    }

    const cadastro = this.cadastroDePesos.leitura();
    if (cadastro.lido && cadastro.quadroDaResolucaoEscolhida.length > 0) {
      this.store.classificacao.registrarGravadaComQuadro(
        resolucaoGravada,
        cadastro.quadroDaResolucaoEscolhida,
      );
    } else {
      this.store.classificacao.marcarDesconhecida();
    }
  }
}
