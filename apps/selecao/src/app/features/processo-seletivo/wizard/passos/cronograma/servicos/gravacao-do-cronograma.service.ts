import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { ProblemI18nService } from '@uniplus/shared-core/http';

import type { FaseDoCronograma, ValidacaoDoPasso } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  CadastroInicial,
  type ResultadoGravacao,
} from '../../../shared/cadastro-inicial.service';
import { resumoDaRecusa } from '../../../shared/resumo-da-recusa';
import { CatalogosDoCronograma } from '../catalogos-do-cronograma.service';
import { type FaseForm, faseDoFormulario } from '../cronograma-form';
import { comoComandoDeEtapa, comoComandoDeFase } from '../cronograma-para-comando';
import {
  localDoErroDaEtapa,
  recusaDaEtapaDeNotaDoEnem,
  recusaDoCampoDaEtapa,
  fasesComUnidadeNaoEncontrada,
} from '../recusas-do-servidor-da-etapa';
import { ConferenciaDoCronograma } from './conferencia-do-cronograma.service';
import { ExpansaoDoCronograma } from './expansao-do-cronograma.service';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';
import { GravacaoDasExigenciasDocumentais } from './gravacao-das-exigencias-documentais.service';
import { ReleituraDasEtapas, AGUARDA_RELEITURA } from './releitura-das-etapas.service';
import { RecusasDoServidorNasEtapas } from './recusas-do-servidor-nas-etapas.service';
import { UnidadesResponsaveisDasFases } from './unidades-responsaveis-das-fases.service';

/**
 * Recusa do servidor quando a nova ordem troca a posição entre fases que já
 * existem, formando um ciclo que uma única gravação não consegue aplicar.
 */
export const PERMUTACAO_DE_ORDEM =
  'uniplus.selecao.fase_cronograma.permutacao_de_ordem_nao_suportada';

/**
 * A recusa de permutação descreve o que aconteceu, não o que fazer. Quem
 * reordenou duas fases precisa saber que o caminho é fazê-lo em duas gravações
 * — a informação que evita tentar de novo o mesmo movimento.
 */
export const ORIENTACAO_DE_PERMUTACAO =
  'Trocar duas fases de lugar exige duas gravações: mova uma delas para o fim da linha do tempo, grave, e então traga a outra para a posição desejada.';

/**
 * Grava o cronograma de fases, contornando o ciclo de ordem quando ele aparece.
 *
 * Reordenar é sempre uma permutação de `1..N`, e toda permutação não-trivial
 * fecha ciclo: cada fase precisa que a outra libere a posição primeiro, e o
 * servidor não persiste isso numa chamada. Mandar o operador "mover uma para o
 * fim" não resolvia — renumerar produz `1..N` de novo, e o ciclo volta.
 *
 * O que resolve é uma posição que ninguém ocupa. O domínio aceita qualquer
 * ordem positiva, não só a sequência fechada, então uma gravação intermediária
 * em `N+1..2N` esvazia as posições `1..N` e a seguinte as ocupa sem cadeia que
 * volte a si mesma. Duas chamadas em vez de uma, e só quando a primeira acusa.
 *
 * Vive fora dos passos porque **todo** caminho que substitui a coleção de fases
 * precisa dele: a reordenação fica no rascunho até alguém gravar, e quem grava
 * pode ser a linha do tempo ou a superfície de configuração da fase. O passo que
 * não carregasse o contorno devolveria a recusa crua, de uma tela onde nem dá
 * para reordenar.
 */
export async function gravarCronogramaFases(
  cadastro: CadastroInicial,
  processoSeletivoId: string,
  fases: readonly FaseDoCronograma[],
): Promise<ResultadoGravacao> {
  const pretendida = await cadastro.definirCronogramaFases(
    processoSeletivoId,
    fases.map(comoComandoDeFase),
  );
  if (pretendida.ok || pretendida.problem.code !== PERMUTACAO_DE_ORDEM) return pretendida;

  // Deslocar pela quantidade de fases só serve se as ordens forem 1..N; o
  // domínio aceita qualquer ordem positiva, e uma lacuna faria a faixa "livre"
  // cair em cima de uma posição ocupada. Somar a maior ordem em uso põe todas
  // acima de qualquer uma que exista hoje.
  const deslocamento = Math.max(...fases.map((fase) => fase.ordem));
  const emOrdemLivre = fases.map((fase) => ({ ...fase, ordem: fase.ordem + deslocamento }));

  const intermediaria = await cadastro.definirCronogramaFases(
    processoSeletivoId,
    emOrdemLivre.map(comoComandoDeFase),
  );
  if (!intermediaria.ok) return intermediaria;

  return cadastro.definirCronogramaFases(processoSeletivoId, fases.map(comoComandoDeFase));
}

/** A sequência de gravação do passo: fases, etapas, releitura, exigências documentais e convenção de contagem. */
@Injectable()
export class GravacaoDoCronograma {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDoCronograma);
  private readonly cadastro = inject(CadastroInicial);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly exigencias = inject(GravacaoDasExigenciasDocumentais);
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly conferencia = inject(ConferenciaDoCronograma);
  private readonly releituraDasEtapas = inject(ReleituraDasEtapas);
  private readonly recusas = inject(RecusasDoServidorNasEtapas);
  private readonly unidades = inject(UnidadesResponsaveisDasFases);
  private readonly expansao = inject(ExpansaoDoCronograma);

  /**
   * A convenção foi gravada com sucesso nesta sessão. Só `persistir()`
   * escreve aqui, no sucesso da terceira chamada — nunca a mirror genérica de
   * `espelharRascunho`, que roda por causa de qualquer uma das três dimensões
   * (inclusive uma releitura de etapas que nada tem a ver com o
   * algoritmo) e daria falso positivo se lida como confirmação do servidor.
   */
  private readonly algoritmoConfirmadoNestaSessao = signal(false);

  /**
   * A convenção já foi declarada no servidor — pela última leitura completa
   * (`remoteSnapshot`) ou por uma gravação desta sessão. Enquanto for
   * `false`, "nenhuma convenção" é opção legítima; depois, deixa de
   * ser: o endpoint não tem operação de remoção —
   * `DefinirAlgoritmoContagemPrazoRequest` exige `codigo` e `versao` — e
   * oferecer a opção de novo convidaria a uma gravação que a tela pularia em
   * silêncio, relatando sucesso sem o servidor ter mudado nada.
   */
  readonly algoritmoDeclaradoNoServidor = computed(
    () =>
      this.store.remoteSnapshot()?.algoritmoContagemPrazo != null ||
      this.algoritmoConfirmadoNestaSessao(),
  );

  private recusarUnidades(
    enviadas: readonly FormGroup<FaseForm>[],
    indices: readonly number[],
  ): void {
    if (indices.length === 0) return;
    this.unidades.recusar(enviadas, indices);
    this.expansao.abrirFases(indices.filter((indice) => indice < enviadas.length));
    this.cronograma.versao.update((versao) => versao + 1);
    this.catalogos.carregarUnidades();
  }

  /**
   * Grava as três dimensões: etapas e cronograma de fases, na ordem que a
   * bicondicional do agregado exige, e por último a convenção de contagem de
   * prazo — só quando o rascunho declara uma.
   *
   * A ordem entre etapas e cronograma não é preferência: a fase que agrupa
   * etapas é recusada na hora se o processo não tiver nenhuma etapa, então
   * gravar o cronograma antes das etapas derrubaria a gravação de um
   * cronograma que é válido.
   *
   * As duas vão juntas mesmo quando só uma mudou. O acoplamento que isso
   * poderia criar — uma etapa malformada impedindo a correção de uma data — não
   * chega a existir, porque a conferência acima recusa antes de qualquer envio e
   * aponta a etapa; e um `PUT` que substitui a coleção pelo mesmo conteúdo não
   * muda nada no servidor.
   *
   * O algoritmo vem por último e é opcional: ausência é estado válido
   * enquanto rascunho — o endpoint recusa código ou versão nulos, e
   * não existe caminho para desdeclarar a convenção depois de escolhida. Se
   * ele falhar, as duas primeiras chamadas já gravaram, e a mensagem diz isso
   * em vez de tratar a falha como se nada tivesse sido salvo.
   */
  async persistir(): Promise<ValidacaoDoPasso> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de montar o cronograma.'],
      };
    }

    const conferencia = this.conferencia.validar();
    if (!conferencia.valid) {
      // O que a conferência acusa pode estar numa fase fechada: abrir todas põe o problema à
      // vista, em vez de deixar a mensagem apontar para um lugar que não está na tela.
      this.expansao.expandirTodasAsFases(this.cronograma.linhaDoTempo().map((item) => item.indice));
      return conferencia;
    }

    const fases = this.cronograma.fases.controls.map(faseDoFormulario);
    const grupos = [...this.cronograma.etapas.controls];
    const etapas = this.cronograma.etapasParaEnvio();
    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      // O cronograma vai primeiro, sempre: a etapa declara a fase em que acontece, e o
      // servidor recusa etapa cuja fase ainda não está no cronograma. Um certame montado do
      // zero — nenhuma fase gravada ainda — não teria como gravar etapa nenhuma na ordem
      // inversa.
      // Remover uma fase também é seguro por aqui: o agregado poda as etapas dela junto.
      const enviadas = [...this.cronograma.fases.controls];
      const cronograma = await gravarCronogramaFases(this.cadastro, processoId, fases);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!cronograma.ok) {
        this.recusarUnidades(
          enviadas,
          fasesComUnidadeNaoEncontrada(cronograma.problem.errors ?? []),
        );
        return {
          valid: false,
          messages: [this.explicarRecusa(cronograma.problem.code, cronograma.problem)],
        };
      }

      this.unidades.limparRecusadas();
      this.recusas.limpar();
      const gravacaoDeEtapas = await this.cadastro.definirEtapas(
        processoId,
        etapas.map(comoComandoDeEtapa),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!gravacaoDeEtapas.ok) {
        const problema = gravacaoDeEtapas.problem;
        this.recusas.aplicar(grupos, problema.errors ?? []);
        const daRaiz = recusaDaEtapaDeNotaDoEnem(problema.code);
        const resumo = resumoDaRecusa(
          problema,
          (erro) => {
            const texto = recusaDoCampoDaEtapa(erro.code);
            if (texto === null) return recusaDaEtapaDeNotaDoEnem(erro.code);
            const indice = localDoErroDaEtapa(erro.field)?.indice;
            if (indice === undefined) return texto;
            const nome = etapas[indice]?.nome.trim() ?? '';
            return `${nome === '' ? `Etapa ${indice + 1}` : nome}: ${texto}`;
          },
          () => this.problemI18n.resolve(problema).title,
        );
        return {
          valid: false,
          messages: daRaiz === null || resumo.includes(daRaiz) ? resumo : [daRaiz, ...resumo],
        };
      }

      // As etapas já mudaram no servidor: é aqui que o rascunho recolhe os
      // identificadores atribuídos. Deixar para o fim perderia a releitura
      // se o cronograma fosse recusado, e a tentativa seguinte reenviaria
      // etapas que já existem sem o `id`, recriando-as.
      const recolheu = await this.releituraDasEtapas.recolherIdentificadoresDasEtapas(processoId);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!recolheu) {
        // Trava a tela em vez de só avisar: o `finally` logo abaixo devolve o
        // botão de gravar, e o rascunho ainda tem `id: null` nas etapas que o
        // servidor acabou de criar.
        this.releituraDasEtapas.releituraPendente.set(true);
        return { valid: false, messages: [AGUARDA_RELEITURA] };
      }

      // As exigências documentais vão por último e dependem das duas gravações
      // anteriores: a exigência referencia a fase pelo id que o servidor atribui, e
      // a etapa que a coleta pelo id que a releitura acabou de recolher.
      const exigencias = await this.exigencias.gravar(processoId);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!exigencias.valid) return exigencias;

      // Ausência é estado válido em rascunho: a chamada só acontece
      // quando há escolha. O código e a versão do formulário sempre andam
      // juntos — `escolherAlgoritmo` os grava ao mesmo tempo —, então checar
      // um basta para saber que o par está completo.
      const codigoAlgoritmo = this.cronograma.formulario.controls.algoritmoContagemCodigo.value;
      if (codigoAlgoritmo !== '') {
        const algoritmo = await this.cadastro.definirAlgoritmoContagemPrazo(processoId, {
          codigo: codigoAlgoritmo,
          versao: this.cronograma.formulario.controls.algoritmoContagemVersao.value,
        });
        if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
        if (!algoritmo.ok) {
          return {
            valid: false,
            messages: [
              `As etapas e o cronograma de fases foram gravados. ${this.problemI18n.resolve(algoritmo.problem).title}`,
            ],
          };
        }

        // A partir daqui o endpoint não tem operação de remoção: o seletor
        // deixa de oferecer "nenhuma convenção" para não convidar a uma
        // gravação futura que a tela pularia em silêncio.
        this.algoritmoConfirmadoNestaSessao.set(true);
      }

      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * A recusa de permutação de ordem descreve o que aconteceu, não o que fazer.
   * Quem reordenou duas fases precisa saber que o caminho é fazê-lo em duas
   * gravações — a informação que evita tentar de novo o mesmo movimento.
   */
  private explicarRecusa(
    codigo: string,
    problema: Parameters<ProblemI18nService['resolve']>[0],
  ): string {
    if (codigo === PERMUTACAO_DE_ORDEM) return ORIENTACAO_DE_PERMUTACAO;
    return this.problemI18n.resolve(problema).title;
  }

  constructor() {
    effect(() => {
      this.store.geracao();
      untracked(() => this.algoritmoConfirmadoNestaSessao.set(false));
    });
  }
}
