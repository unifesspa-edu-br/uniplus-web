import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { ProblemI18nService } from '@uniplus/shared-core/http';

import type {
  EtapaPontuada,
  FaseDoCronograma,
  ValidacaoDoPasso,
} from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial, type ResultadoGravacao } from '../../../shared/cadastro-inicial.service';
import { resumoDaRecusa } from '../../../shared/resumo-da-recusa';
import { CatalogoDeUnidadesDoCadastro } from '../catalogos/catalogo-de-unidades-do-cadastro.service';
import { type EtapaForm, type FaseForm, faseDoFormulario } from '../cronograma-form';
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

/** O que uma gravação do cronograma envia, congelado no instante em que o operador manda gravar. */
interface EnvioDoCronograma {
  readonly processoId: string;
  readonly geracao: number;
  readonly enviadas: readonly FormGroup<FaseForm>[];
  readonly fases: readonly FaseDoCronograma[];
  readonly grupos: readonly FormGroup<EtapaForm>[];
  readonly etapas: readonly EtapaPontuada[];
}

/** A gravação foi superada por troca de processo ou de rascunho: nada a relatar ao operador. */
const GRAVACAO_SUPERADA: ValidacaoDoPasso = { valid: false, messages: [] };

/** A sequência de gravação do passo: fases, etapas, releitura, exigências documentais e convenção de contagem. */
@Injectable()
export class GravacaoDoCronograma {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogoDeUnidades = inject(CatalogoDeUnidadesDoCadastro);
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
    this.catalogoDeUnidades.recarregar();
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
   *
   * O cronograma vai primeiro porque a etapa declara a fase em que acontece, e o servidor recusa
   * etapa cuja fase ainda não está no cronograma; remover uma fase é seguro, o agregado poda as
   * etapas dela. Depois das etapas, a releitura recolhe os identificadores que o servidor
   * atribuiu: deixar para o fim perderia a releitura se o cronograma fosse recusado, e a
   * tentativa seguinte recriaria etapas que já existem. Se ela falha, a tela trava, porque o
   * rascunho ainda tem `id: null` nas etapas criadas. As exigências documentais dependem dos
   * dois ids. A convenção só é gravada quando há escolha, e dali em diante o endpoint não tem
   * remoção: o seletor deixa de oferecer "nenhuma convenção".
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
      this.expansao.expandirTodasAsFases(this.cronograma.linhaDoTempo().map((item) => item.indice));
      return conferencia;
    }

    const envio = this.congelarEnvio(processoId);
    this.store.salvando.set(true);
    try {
      return (await this.gravarEmSequencia(envio)) ?? { valid: true };
    } finally {
      if (envio.geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  private congelarEnvio(processoId: string): EnvioDoCronograma {
    return {
      processoId,
      geracao: this.store.geracao(),
      enviadas: [...this.cronograma.fases.controls],
      fases: this.cronograma.fases.controls.map(faseDoFormulario),
      grupos: [...this.cronograma.etapas.controls],
      etapas: this.cronograma.etapasParaEnvio(),
    };
  }

  private async gravarEmSequencia(envio: EnvioDoCronograma): Promise<ValidacaoDoPasso | null> {
    const passos = [
      () => this.gravarFases(envio),
      () => this.gravarEtapas(envio),
      () => this.recolherIdentificadores(envio),
      () => this.gravarExigencias(envio),
      () => this.gravarConvencao(envio),
    ];
    for (const passo of passos) {
      const recusa = await passo();
      if (recusa !== null) return recusa;
    }
    return null;
  }

  private superada(envio: EnvioDoCronograma): boolean {
    return envio.geracao !== this.store.geracao();
  }

  private async gravarFases(envio: EnvioDoCronograma): Promise<ValidacaoDoPasso | null> {
    const cronograma = await gravarCronogramaFases(this.cadastro, envio.processoId, envio.fases);
    if (this.superada(envio)) return GRAVACAO_SUPERADA;
    if (!cronograma.ok) {
      this.recusarUnidades(
        envio.enviadas,
        fasesComUnidadeNaoEncontrada(cronograma.problem.errors ?? []),
      );
      return {
        valid: false,
        messages: [this.explicarRecusa(cronograma.problem.code, cronograma.problem)],
      };
    }

    this.unidades.limparRecusadas();
    this.recusas.limpar();
    return null;
  }

  private async gravarEtapas(envio: EnvioDoCronograma): Promise<ValidacaoDoPasso | null> {
    const gravacao = await this.cadastro.definirEtapas(
      envio.processoId,
      envio.etapas.map(comoComandoDeEtapa),
    );
    if (this.superada(envio)) return GRAVACAO_SUPERADA;
    if (gravacao.ok) return null;

    this.recusas.aplicar(envio.grupos, gravacao.problem.errors ?? []);
    return { valid: false, messages: this.mensagensDaRecusaDasEtapas(gravacao.problem, envio) };
  }

  private mensagensDaRecusaDasEtapas(
    problema: Extract<ResultadoGravacao, { ok: false }>['problem'],
    envio: EnvioDoCronograma,
  ): string[] {
    const daRaiz = recusaDaEtapaDeNotaDoEnem(problema.code);
    const resumo = resumoDaRecusa(
      problema,
      (erro) => this.mensagemDoErroDaEtapa(erro, envio.etapas),
      () => this.problemI18n.resolve(problema).title,
    );
    return daRaiz === null || resumo.includes(daRaiz) ? resumo : [daRaiz, ...resumo];
  }

  private mensagemDoErroDaEtapa(
    erro: { readonly code: string; readonly field: string },
    etapas: EnvioDoCronograma['etapas'],
  ): string | null {
    const texto = recusaDoCampoDaEtapa(erro.code);
    if (texto === null) return recusaDaEtapaDeNotaDoEnem(erro.code);
    const indice = localDoErroDaEtapa(erro.field)?.indice;
    if (indice === undefined) return texto;
    const nome = etapas[indice]?.nome.trim() ?? '';
    return `${nome === '' ? `Etapa ${indice + 1}` : nome}: ${texto}`;
  }

  private async recolherIdentificadores(
    envio: EnvioDoCronograma,
  ): Promise<ValidacaoDoPasso | null> {
    const recolheu = await this.releituraDasEtapas.recolherIdentificadoresDasEtapas(
      envio.processoId,
    );
    if (this.superada(envio)) return GRAVACAO_SUPERADA;
    if (recolheu) return null;

    this.releituraDasEtapas.releituraPendente.set(true);
    return { valid: false, messages: [AGUARDA_RELEITURA] };
  }

  private async gravarExigencias(envio: EnvioDoCronograma): Promise<ValidacaoDoPasso | null> {
    const exigencias = await this.exigencias.gravar(envio.processoId);
    if (this.superada(envio)) return GRAVACAO_SUPERADA;
    return exigencias.valid ? null : exigencias;
  }

  private async gravarConvencao(envio: EnvioDoCronograma): Promise<ValidacaoDoPasso | null> {
    const formulario = this.cronograma.formulario.controls;
    const codigo = formulario.algoritmoContagemCodigo.value;
    if (codigo === '') return null;

    const algoritmo = await this.cadastro.definirAlgoritmoContagemPrazo(envio.processoId, {
      codigo,
      versao: formulario.algoritmoContagemVersao.value,
    });
    if (this.superada(envio)) return GRAVACAO_SUPERADA;
    if (!algoritmo.ok) {
      return {
        valid: false,
        messages: [
          `As etapas e o cronograma de fases foram gravados. ${this.problemI18n.resolve(algoritmo.problem).title}`,
        ],
      };
    }

    this.algoritmoConfirmadoNestaSessao.set(true);
    return null;
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
