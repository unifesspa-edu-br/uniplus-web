import { inject, Injectable } from '@angular/core';
import { isApiOk, ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { OrigemCandidatos, ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { firstValueFrom } from 'rxjs';

import { StepValidation } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicialService } from '../../../shared/cadastro-inicial.service';
import {
  CamposPressupostosService,
  fatosCitadosPelasModalidadesOfertadas,
} from '../../../shared/campos-pressupostos.service';
import {
  gravarNoPasso,
  RESPOSTA_DESCARTADA,
  RespostaDescartada,
} from '../../../shared/gravacao/gravacao-no-passo';
import { comandoDaCascata, comandoDeRemocaoDaCascata } from '../cascata-de-remanejamento';
import type { CascataRemanejamentoComponent } from '../cascata-remanejamento.component';
import { comoComando } from '../distribuicao-para-comando';
import {
  numeroDeOpcoesPrimeiro,
  recusadoPorOpcoesAcimaDasOfertas,
  TEXTO_OPCOES_ACIMA_DAS_OFERTAS,
} from '../opcoes-de-curso';
import { OpcoesDeCursoService } from './opcoes-de-curso.service';
import { PadraoDoEditalService } from './padrao-do-edital.service';

/**
 * A gravação do passo: o número de opções e a distribuição, depois a cascata de remanejamento e,
 * por fim, a releitura das regras que o servidor congelou nas modalidades ofertadas.
 *
 * Até aqui o quadro vive no rascunho: com vinte ofertas, gravar célula a célula transformaria o
 * preenchimento numa sequência de idas ao servidor, e é por isso que o passo acumula e envia uma
 * vez só. A cascata referencia modalidades que só existem depois de a oferta ser gravada, e as duas
 * chamadas são independentes: a falha de uma não desfaz a outra, e a mensagem diz qual parte gravou.
 */
@Injectable()
export class GravacaoDasVagasService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly camposPressupostos = inject(CamposPressupostosService);
  private readonly padrao = inject(PadraoDoEditalService);
  private readonly opcoes = inject(OpcoesDeCursoService);

  gravar(
    processoId: string,
    cascata: CascataRemanejamentoComponent | undefined,
  ): Promise<StepValidation | RespostaDescartada> {
    return gravarNoPasso(this.store, async () => {
      const geracao = this.store.geracao();
      this.opcoes.limparRecusaDaApi();
      const recusa = await this.gravarOpcoesEDistribuicao(processoId, geracao);
      if (recusa !== null) return recusa;

      // O editor pode ter passado a outro processo enquanto o comando corria. A resposta descreve
      // o processo anterior, e concluir o passo agora avançaria o rascunho de outro cadastro.
      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;

      const gravouACascata = await this.persistirCascata(processoId, cascata);
      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      if (!gravouACascata.valid) {
        this.store.vagasGravadasDefasadas.set(true);
        return {
          valid: false,
          messages: [
            `A distribuição de vagas foi gravada. A cascata de remanejamento não: ${(gravouACascata.messages ?? []).join(' ')}`,
          ],
        };
      }

      return this.acompanharAsRegrasDasModalidades(processoId);
    });
  }

  /**
   * Grava o número de opções e a distribuição, sempre os dois, na ordem que o servidor aceita:
   * ver {@link numeroDeOpcoesPrimeiro}. O número gravado vem da leitura mais recente do processo;
   * depois de uma resposta inconclusiva ele pode ter mudado sem que a tela saiba, e a releitura vem
   * antes de decidir a ordem. `null` quando as duas gravações deram certo.
   */
  private async gravarOpcoesEDistribuicao(
    processoId: string,
    geracao: number,
  ): Promise<StepValidation | null> {
    if (this.store.vagasGravadasDefasadas()) {
      const detalhe = await firstValueFrom(this.api.obter(processoId));
      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      if (!isApiOk(detalhe)) {
        return {
          valid: false,
          messages: [
            'Não foi possível reler o processo antes de gravar as vagas. Tente novamente.',
          ],
        };
      }
      this.store.registrarVagasGravadas(detalhe.data);
    }

    const numero = Number(this.opcoes.numero());
    const comandos = this.padrao.distribuicoes().map(comoComando);
    const etapas = [
      {
        gravada: 'O número de opções de curso foi gravado.',
        gravar: async () => {
          const resultado = await this.cadastro.definirOpcoesDeCurso(processoId, { numero });
          if (resultado.ok && geracao === this.store.geracao()) {
            this.store.opcoesDeCursoGravadas.set(numero);
          }
          return resultado;
        },
      },
      {
        gravada: 'A distribuição de vagas foi gravada.',
        gravar: () => this.cadastro.definirDistribuicaoVagas(processoId, comandos),
      },
    ];
    if (!numeroDeOpcoesPrimeiro(this.store.opcoesDeCursoGravadas(), comandos.length)) {
      etapas.reverse();
    }

    let jaGravada: string | null = null;
    for (const etapa of etapas) {
      const resultado = await etapa.gravar();
      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      if (!resultado.ok) {
        // Sem resposta conclusiva o servidor pode ter aplicado o comando: o que ele tem só uma
        // releitura diz. A mesma regra da chave de idempotência, vinda do serviço.
        if (resultado.inconclusiva) this.store.vagasGravadasDefasadas.set(true);
        return this.recusaDaGravacao(resultado.problem, jaGravada);
      }
      jaGravada = etapa.gravada;
    }
    return null;
  }

  /** A recusa por número acima das ofertas é do campo; as demais seguem a mensagem da API. */
  private recusaDaGravacao(problem: ProblemDetails, jaGravada: string | null): StepValidation {
    const dizendoOQueGravou = (mensagem: string): string =>
      jaGravada === null ? mensagem : `${jaGravada} ${mensagem}`;

    if (recusadoPorOpcoesAcimaDasOfertas(problem)) {
      this.opcoes.registrarRecusaDaApi();
      return { valid: false, messages: [dizendoOQueGravou(TEXTO_OPCOES_ACIMA_DAS_OFERTAS)] };
    }
    return { valid: false, messages: [dizendoOQueGravou(this.problemI18n.resolve(problem).title)] };
  }

  /**
   * Relê o processo depois de gravar o quadro: as regras que o servidor congelou nas modalidades
   * ofertadas passam a valer para a tela, e o formulário de inscrição recebe as perguntas que elas
   * citam quando é da inscrição que a modalidade do candidato se deriva.
   *
   * Sem fase de inscrição no cronograma, as perguntas esperam: o formulário que as coleta ainda
   * não tem onde existir, e o cronograma as põe ao ganhar a fase.
   */
  private async acompanharAsRegrasDasModalidades(processoId: string): Promise<StepValidation> {
    const geracao = this.store.geracao();
    const recusa = (motivo: string): StepValidation => ({
      valid: false,
      messages: [`A distribuição de vagas foi gravada. ${motivo}`],
    });

    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!isApiOk(detalhe)) {
      this.store.vagasGravadasDefasadas.set(true);
      return this.derivaAModalidade()
        ? recusa(
            'Não foi possível reler o processo para pôr no formulário de inscrição as perguntas que as modalidades fazem. Grave as vagas de novo.',
          )
        : { valid: true };
    }
    this.store.registrarRegrasDasModalidades(detalhe.data);
    this.store.registrarVagasGravadas(detalhe.data);
    if (!this.derivaAModalidade()) return { valid: true };

    const campos = await this.camposPressupostos.garantirCampos(
      processoId,
      detalhe.data,
      fatosCitadosPelasModalidadesOfertadas(detalhe.data),
    );
    if (geracao !== this.store.geracao()) return { valid: true };
    return campos.tipo === 'recusados' ? recusa(campos.motivo) : { valid: true };
  }

  /** O candidato se inscreve no processo: é da inscrição que a modalidade dele se deriva. */
  private derivaAModalidade(): boolean {
    return this.store.draft().identificacao.origemCandidatos === OrigemCandidatos.inscricaoPropria;
  }

  /**
   * A cascata é única por processo: só é enviada quando a seção se aplica (oferta federal com
   * modalidade `SEGUE_CASCATA`) **e** a regra está escolhida com a matriz reconhecida. Quando deixa
   * de se aplicar, envia a remoção, os quatro campos nulos, **se o servidor pode ter uma cascata
   * gravada** (`existeNoServidor()`), para não deixar cascata órfã referenciando modalidade que o
   * quadro já não oferta.
   *
   * A checagem não é sobre `store.draft().vagas.cascata`: o operador pode limpar o seletor de regra
   * (zerando o rascunho) sem que isso apague nada no servidor. Só o envio da remoção faz isso, e por
   * isso quem decide se há remoção pendente é `existeNoServidor`, atualizado por hidratação e pelas
   * próprias gravações deste método, nunca pelo valor do seletor.
   */
  private async persistirCascata(
    processoId: string,
    secao: CascataRemanejamentoComponent | undefined,
  ): Promise<StepValidation> {
    if (secao === undefined || !secao.precisaExibir()) {
      if (secao === undefined || !secao.existeNoServidor()) return { valid: true };

      const resultado = await this.cadastro.definirCascataRemanejamento(
        processoId,
        comandoDeRemocaoDaCascata(),
      );
      if (resultado.ok) secao.existeNoServidor.set(false);
      return resultado.ok
        ? { valid: true }
        : { valid: false, messages: [this.problemI18n.resolve(resultado.problem).title] };
    }

    const cascataSelecionada = this.store.draft().vagas.cascata;
    if (cascataSelecionada === null || !secao.pronta()) {
      return {
        valid: false,
        messages: [
          'Escolha a regra de remanejamento e confirme a matriz antes de gravar as vagas.',
        ],
      };
    }

    const matriz = secao.matriz();
    if (matriz === null) {
      return { valid: false, messages: [secao.mensagemDeMatrizIndisponivel()] };
    }

    const resultado = await this.cadastro.definirCascataRemanejamento(
      processoId,
      comandoDaCascata(cascataSelecionada, matriz),
    );
    // Uma recusa inconclusiva (erro de rede, 5xx) não prova que o servidor não aplicou o comando:
    // marcar como presente garante que uma mudança futura que torne a cascata desnecessária dispare
    // a remoção, em vez de pular a limpeza de uma cascata que pode ter sido gravada.
    if (resultado.ok || resultado.inconclusiva) secao.existeNoServidor.set(true);
    return resultado.ok
      ? { valid: true }
      : { valid: false, messages: [this.problemI18n.resolve(resultado.problem).title] };
  }
}
