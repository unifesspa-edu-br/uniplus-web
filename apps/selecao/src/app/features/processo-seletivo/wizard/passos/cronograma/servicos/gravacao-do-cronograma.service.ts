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
  recusaDaEtapaDeNotaDoEnem,
  fasesComUnidadeNaoEncontrada,
  textoDaRecusaDaEtapa,
} from '../recusas-do-servidor-da-etapa';
import { indiceDaFaseEm, recusaDaBancaNaFase } from '../../fase/recusas-da-fase';
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

type ProblemaDaGravacao = Extract<ResultadoGravacao, { ok: false }>['problem'];

/** O que uma gravação do cronograma escreve, congelado no instante em que o operador manda gravar. */
interface ConteudoDaGravacao {
  readonly processoId: string;
  readonly geracao: number;
  readonly enviadas: readonly FormGroup<FaseForm>[];
  readonly fases: readonly FaseDoCronograma[];
  readonly grupos: readonly FormGroup<EtapaForm>[];
  readonly etapas: readonly EtapaPontuada[];
}

/** O texto da recusa à regra de uma banca da fase, com a fase de origem quando o caminho a nomeia. */
function mensagemDaBancaDaFase(erro: Parameters<typeof recusaDaBancaNaFase>[0]): string | null {
  const recusa = recusaDaBancaNaFase(erro);
  if (recusa === undefined) return null;
  const indice = indiceDaFaseEm(erro.field);
  return indice === null ? recusa.mensagem : `Fase ${indice + 1}: ${recusa.mensagem}`;
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
   * Grava o cronograma na ordem fases, etapas, releitura dos identificadores, exigências
   * documentais e, por último, a convenção de contagem de prazo — só quando o rascunho declara
   * uma. Para na primeira recusa.
   *
   * As fases vão primeiro, sempre: a etapa declara a fase em que acontece, e o servidor recusa
   * etapa cuja fase ainda não está no cronograma. Um certame montado do zero não teria como
   * gravar etapa nenhuma na ordem inversa; remover uma fase também é seguro por aqui, porque o
   * agregado poda as etapas dela. Fases e etapas vão juntas mesmo quando só uma mudou: a
   * conferência anterior recusa e aponta a etapa malformada antes de qualquer envio, e um `PUT`
   * que substitui a coleção pelo mesmo conteúdo não muda nada no servidor.
   *
   * Depois das etapas, a releitura recolhe os identificadores que o servidor atribuiu: deixá-la
   * para o fim a perderia se uma etapa seguinte fosse recusada, e a tentativa seguinte recriaria
   * etapas que já existem. Se ela falha, a tela trava, porque o rascunho ainda tem `id: null`
   * nas etapas criadas. As exigências documentais dependem das fases e dos ids das etapas.
   *
   * A convenção é opcional: ausência é estado válido enquanto rascunho, e o endpoint recusa
   * código ou versão nulos. Uma vez gravada, não existe remoção, e o seletor deixa de oferecer
   * "nenhuma convenção". Se ela falhar, o restante já foi gravado, e a mensagem diz isso em vez
   * de tratar a falha como se nada tivesse sido salvo.
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

    const conteudo = this.congelarConteudo(processoId);
    this.store.salvando.set(true);
    try {
      return (await this.gravarEmSequencia(conteudo)) ?? { valid: true };
    } finally {
      if (conteudo.geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  private congelarConteudo(processoId: string): ConteudoDaGravacao {
    return {
      processoId,
      geracao: this.store.geracao(),
      enviadas: [...this.cronograma.fases.controls],
      fases: this.cronograma.fases.controls.map(faseDoFormulario),
      grupos: [...this.cronograma.etapas.controls],
      etapas: this.cronograma.etapasParaEnvio(),
    };
  }

  private async gravarEmSequencia(conteudo: ConteudoDaGravacao): Promise<ValidacaoDoPasso | null> {
    const passos = [
      () => this.gravarFases(conteudo),
      () => this.gravarEtapas(conteudo),
      () => this.recolherIdentificadores(conteudo),
      () => this.gravarExigencias(conteudo),
      () => this.gravarConvencao(conteudo),
    ];
    for (const passo of passos) {
      const recusa = await passo();
      if (recusa !== null) return recusa;
    }
    return null;
  }

  private superada(conteudo: ConteudoDaGravacao): boolean {
    return conteudo.geracao !== this.store.geracao();
  }

  private async gravarFases(conteudo: ConteudoDaGravacao): Promise<ValidacaoDoPasso | null> {
    const cronograma = await gravarCronogramaFases(
      this.cadastro,
      conteudo.processoId,
      conteudo.fases,
    );
    if (this.superada(conteudo)) return GRAVACAO_SUPERADA;
    if (!cronograma.ok) return this.recusarFases(conteudo, cronograma.problem);

    this.unidades.limparRecusadas();
    this.recusas.limpar();
    return null;
  }

  private recusarFases(
    conteudo: ConteudoDaGravacao,
    problema: ProblemaDaGravacao,
  ): ValidacaoDoPasso {
    this.recusarUnidades(conteudo.enviadas, fasesComUnidadeNaoEncontrada(problema.errors ?? []));
    return { valid: false, messages: this.mensagensDaRecusaDasFases(problema) };
  }

  private mensagensDaRecusaDasFases(problema: ProblemaDaGravacao): string[] {
    return resumoDaRecusa(problema, mensagemDaBancaDaFase, () =>
      this.explicarRecusa(problema.code, problema),
    );
  }

  private async gravarEtapas(conteudo: ConteudoDaGravacao): Promise<ValidacaoDoPasso | null> {
    const gravacao = await this.cadastro.definirEtapas(
      conteudo.processoId,
      conteudo.etapas.map(comoComandoDeEtapa),
    );
    if (this.superada(conteudo)) return GRAVACAO_SUPERADA;
    if (gravacao.ok) return null;

    this.recusas.aplicar(conteudo.grupos, gravacao.problem.errors ?? []);
    return { valid: false, messages: this.mensagensDaRecusaDasEtapas(gravacao.problem, conteudo) };
  }

  private mensagensDaRecusaDasEtapas(
    problema: ProblemaDaGravacao,
    conteudo: ConteudoDaGravacao,
  ): string[] {
    const daRaiz = recusaDaEtapaDeNotaDoEnem(problema.code);
    const resumo = resumoDaRecusa(
      problema,
      (erro) => this.mensagemDoErroDaEtapa(erro, conteudo.etapas),
      () => this.problemI18n.resolve(problema).title,
    );
    return daRaiz === null || resumo.includes(daRaiz) ? resumo : [daRaiz, ...resumo];
  }

  private mensagemDoErroDaEtapa(
    erro: { readonly code: string; readonly field: string; readonly message?: string },
    etapas: ConteudoDaGravacao['etapas'],
  ): string | null {
    const recusa = textoDaRecusaDaEtapa(erro);
    if (recusa === null) return recusaDaEtapaDeNotaDoEnem(erro.code);
    if (recusa.indice === null) return recusa.texto;
    const nome = etapas[recusa.indice]?.nome.trim() ?? '';
    return `${nome === '' ? `Etapa ${recusa.indice + 1}` : nome}: ${recusa.texto}`;
  }

  private async recolherIdentificadores(
    conteudo: ConteudoDaGravacao,
  ): Promise<ValidacaoDoPasso | null> {
    const recolheu = await this.releituraDasEtapas.recolherIdentificadoresDasEtapas(
      conteudo.processoId,
    );
    if (this.superada(conteudo)) return GRAVACAO_SUPERADA;
    if (recolheu) return null;

    this.releituraDasEtapas.releituraPendente.set(true);
    return { valid: false, messages: [AGUARDA_RELEITURA] };
  }

  private async gravarExigencias(conteudo: ConteudoDaGravacao): Promise<ValidacaoDoPasso | null> {
    const exigencias = await this.exigencias.gravar(conteudo.processoId);
    if (this.superada(conteudo)) return GRAVACAO_SUPERADA;
    return exigencias.valid ? null : exigencias;
  }

  private async gravarConvencao(conteudo: ConteudoDaGravacao): Promise<ValidacaoDoPasso | null> {
    const formulario = this.cronograma.formulario.controls;
    const codigo = formulario.algoritmoContagemCodigo.value;
    if (codigo === '') return null;

    const algoritmo = await this.cadastro.definirAlgoritmoContagemPrazo(conteudo.processoId, {
      codigo,
      versao: formulario.algoritmoContagemVersao.value,
    });
    if (this.superada(conteudo)) return GRAVACAO_SUPERADA;
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
