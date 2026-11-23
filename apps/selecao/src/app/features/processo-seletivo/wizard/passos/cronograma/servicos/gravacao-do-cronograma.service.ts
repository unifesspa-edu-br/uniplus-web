import { RecusasDasExigencias } from '../../fase/documentos/recusas-das-exigencias.service';
import { computed, effect, inject, Injectable, Injector, signal, untracked } from '@angular/core';
import {
  ProblemI18nService,
  recusasDoProblema,
  type RecusaDoProblema,
} from '@uniplus/shared-core/http';

import type { ValidacaoDoPasso } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import { VocabulariosDaRegra } from '../../../shared/deliberacao/vocabularios-da-regra.service';
import { focarAposRenderizar } from '../../../shared/foco-apos-renderizar';
import { NumeracaoDasRespostasRecusadas } from '../../../shared/recusas/numeracao-das-respostas-recusadas';
import { resumoDaGravacaoRecusada } from '../../../shared/recusas/texto-da-recusa-no-resumo';
import { CatalogoDeUnidadesDoCadastro } from '../catalogos/catalogo-de-unidades-do-cadastro.service';
import { alvosDaRecusaDaFase } from '../../fase/alvo-da-recusa-da-fase';
import { campoNaTela } from '../../fase/campo-da-fase';
import { etapaDoFormulario, faseDoFormulario } from '../cronograma-form';
import { comoComandoDeEtapa } from '../cronograma-para-comando';
import { ConferenciaDoCronograma } from './conferencia-do-cronograma.service';
import type { ConteudoDaGravacao, ProblemaDaGravacao } from './conteudo-da-gravacao';
import type { ControleNaTela } from './distribuicao-das-recusas-das-fases';
import { ExpansaoDoCronograma } from './expansao-do-cronograma.service';
import { ApresentacaoDasRecusasDasExigencias } from './apresentacao-das-recusas-das-exigencias.service';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';
import {
  gravarCronogramaFases,
  ORIENTACAO_DE_PERMUTACAO,
  PERMUTACAO_DE_ORDEM,
} from './gravar-cronograma-fases';
import { GravacaoDasExigenciasDocumentais } from './gravacao-das-exigencias-documentais.service';
import { RecusaDaGravacaoDasEtapas } from './recusa-da-gravacao-das-etapas.service';
import {
  ReleituraDosIdentificadores,
  AVISO_DIVERGENCIA,
  TEXTOS_RELEITURA,
} from './releitura-dos-identificadores.service';
import { RecusasDoServidorNasEtapas } from './recusas-do-servidor-nas-etapas.service';
import { RecusasDoServidorNasFases } from './recusas-do-servidor-nas-fases.service';

/** A unidade responsável escolhida para a fase saiu do cadastro de Organização. */
const UNIDADE_RESPONSAVEL_NAO_ENCONTRADA =
  'uniplus.selecao.fase_cronograma.unidade_responsavel_nao_encontrada';

/** A falha não trouxe causa nenhuma: a API não respondeu sobre os campos, e não houve conferência. */
function semCausas(problema: ProblemaDaGravacao): boolean {
  return (problema.errors ?? []).length === 0;
}

/** A gravação foi superada por troca de processo ou de rascunho: nada a relatar ao operador. */
const GRAVACAO_SUPERADA: ValidacaoDoPasso = { valid: false, messages: [] };

const SEM_PROCESSO: ValidacaoDoPasso = {
  valid: false,
  messages: ['O cadastro do processo precisa estar concluído antes de montar o cronograma.'],
};

/** A sequência de gravação do passo: fases, etapas, releitura, exigências documentais e convenção de contagem. */
@Injectable()
export class GravacaoDoCronograma {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly vocabularios = inject(VocabulariosDaRegra);
  private readonly catalogoDeUnidades = inject(CatalogoDeUnidadesDoCadastro);
  private readonly cadastro = inject(CadastroInicial);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly exigencias = inject(GravacaoDasExigenciasDocumentais);
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly conferencia = inject(ConferenciaDoCronograma);
  private readonly releituraDosIdentificadores = inject(ReleituraDosIdentificadores);
  private readonly recusas = inject(RecusasDoServidorNasEtapas);
  private readonly recusaDasEtapas = inject(RecusaDaGravacaoDasEtapas);
  private readonly recusasDasFases = inject(RecusasDoServidorNasFases);
  private readonly recusasDasExigencias = inject(RecusasDasExigencias);
  private readonly apresentacaoDasRecusas = inject(ApresentacaoDasRecusasDasExigencias);
  private readonly numeracao = inject(NumeracaoDasRespostasRecusadas);
  private readonly injetor = inject(Injector);
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
    if (processoId === null) return SEM_PROCESSO;
    const conferencia = this.conferencia.validar();
    if (!conferencia.valid) return this.recusarAConferencia(conferencia);
    const conteudo = this.congelarConteudo(processoId);
    const recusa = this.recusaDasOpcoes(conteudo);
    if (recusa !== null) return recusa;
    this.store.salvando.set(true);
    try {
      return (await this.gravarEmSequencia(conteudo)) ?? { valid: true };
    } finally {
      if (conteudo.geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  private recusaDasOpcoes(conteudo: ConteudoDaGravacao): ValidacaoDoPasso | null {
    if (!this.temRegra(conteudo) || this.vocabularios.pronta()) return null;
    return { valid: false, messages: ['As opções da regra de deliberação não estão disponíveis.'] };
  }

  private temRegra(conteudo: ConteudoDaGravacao): boolean {
    const bancas = [
      ...conteudo.fases.flatMap((fase) => fase.bancasRequeridas),
      ...conteudo.etapas.flatMap((etapa) => etapa.bancas),
    ];
    return bancas.some((banca) => banca.regraDeDeliberacao !== null);
  }

  private recusarAConferencia(conferencia: ValidacaoDoPasso): ValidacaoDoPasso {
    this.expansao.expandirTodasAsFases(this.cronograma.linhaDoTempo().map((item) => item.indice));
    return conferencia;
  }

  private congelarConteudo(processoId: string): ConteudoDaGravacao {
    return {
      processoId,
      geracao: this.store.geracao(),
      fases: this.cronograma.fases.controls.map(faseDoFormulario),
      grupos: [...this.cronograma.etapas.controls],
      etapasNoFormulario: this.cronograma.etapas.controls.map(etapaDoFormulario),
      etapas: this.cronograma.etapasParaEnvio(),
    };
  }

  private async gravarEmSequencia(conteudo: ConteudoDaGravacao): Promise<ValidacaoDoPasso | null> {
    const passos = [
      () => this.gravarFases(conteudo),
      () => this.recolherIdentificadoresDasFases(conteudo),
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
    if (!cronograma.ok) return this.tratarAFalhaDasFases(conteudo, cronograma.problem);

    this.recusasDasFases.limpar();
    this.recusas.limpar();
    return null;
  }

  /** Só a resposta que traz causas confere os campos e troca as recusas guardadas; a falha sem elas as mantém. */
  private tratarAFalhaDasFases(
    conteudo: ConteudoDaGravacao,
    problema: ProblemaDaGravacao,
  ): ValidacaoDoPasso {
    if (!semCausas(problema)) return this.recusarFases(conteudo, problema);
    return { valid: false, messages: this.resumoDaRecusaDasFases(problema, []) };
  }

  private recusarFases(
    conteudo: ConteudoDaGravacao,
    problema: ProblemaDaGravacao,
  ): ValidacaoDoPasso {
    const { deCampo } = recusasDoProblema(problema);
    const resposta = this.numeracao.proxima();
    const { porFase, semLugar } = this.recusasDasFases.registrar(
      resposta,
      conteudo.fases,
      deCampo,
      this.controleNaTela(),
    );
    this.mostrarAsRecusasDasFases(conteudo, deCampo, [...porFase.keys()]);
    return { valid: false, messages: this.resumoDaRecusaDasFases(problema, semLugar) };
  }

  /** O que a linha do tempo mostra de cada fase agora, para a recusa não apontar controle que não existe. */
  private controleNaTela(): ControleNaTela {
    const exigencias = new Map(
      this.cronograma
        .linhaDoTempo()
        .map((item) => [item.grupo.controls.faseCanonicaId.value, item.exigencias] as const),
    );
    return (faseCanonicaId, campo) => campoNaTela(campo, exigencias.get(faseCanonicaId) ?? null);
  }

  /**
   * O resumo traz só o que não achou campo; se tudo achou, uma frase diz que a gravação foi
   * recusada e onde ver. A recusa de permutação de ordem leva a orientação do que fazer.
   */
  private resumoDaRecusaDasFases(
    problema: ProblemaDaGravacao,
    semLugar: readonly RecusaDoProblema[],
  ): string[] {
    return resumoDaGravacaoRecusada(problema, semLugar, {
      doCodigo: problema.code === PERMUTACAO_DE_ORDEM ? ORIENTACAO_DE_PERMUTACAO : null,
      titulo: () => this.problemI18n.resolve(problema).title,
    });
  }

  /**
   * Abre as fases que receberam recusa, recarrega as unidades quando o servidor não encontrou a
   * escolhida e leva o foco ao alvo da primeira recusa que a pessoa ainda precisa tratar.
   */
  private mostrarAsRecusasDasFases(
    conteudo: ConteudoDaGravacao,
    recusas: readonly RecusaDoProblema[],
    fasesComRecusa: readonly string[],
  ): void {
    const indices = conteudo.fases.flatMap((fase, indice) =>
      fasesComRecusa.includes(fase.faseCanonicaId) ? [indice] : [],
    );
    this.expansao.abrirFases(indices);
    if (recusas.some((recusa) => recusa.codigo === UNIDADE_RESPONSAVEL_NAO_ENCONTRADA)) {
      this.catalogoDeUnidades.recarregar();
    }
    this.focarAPrimeiraRecusa(conteudo);
  }

  private focarAPrimeiraRecusa(conteudo: ConteudoDaGravacao): void {
    const primeira = this.recusasDasFases.primeiraRecusaAtiva();
    const indice = conteudo.fases.findIndex(
      (fase) => fase.faseCanonicaId === primeira?.faseCanonicaId,
    );
    if (primeira === null || indice < 0) return;
    const alvos = alvosDaRecusaDaFase(primeira.recusa.campo, conteudo.fases[indice], indice);
    focarAposRenderizar(this.injetor, ...alvos);
  }

  private async gravarEtapas(conteudo: ConteudoDaGravacao): Promise<ValidacaoDoPasso | null> {
    const gravacao = await this.cadastro.definirEtapas(
      conteudo.processoId,
      conteudo.etapas.map(comoComandoDeEtapa),
    );
    if (this.superada(conteudo)) return GRAVACAO_SUPERADA;
    if (gravacao.ok) return null;

    return this.recusaDasEtapas.recusar(conteudo, gravacao.problem);
  }

  private async recolherIdentificadoresDasFases(
    conteudo: ConteudoDaGravacao,
  ): Promise<ValidacaoDoPasso | null> {
    if (!conteudo.fases.some((fase) => fase.bancasRequeridas.some((banca) => banca.id === null)))
      return null;
    return this.relerAposGravacao(conteudo, 'fases');
  }

  private async recolherIdentificadores(
    conteudo: ConteudoDaGravacao,
  ): Promise<ValidacaoDoPasso | null> {
    return this.relerAposGravacao(conteudo, 'etapas');
  }

  private async relerAposGravacao(
    conteudo: ConteudoDaGravacao,
    escopo: 'fases' | 'etapas',
  ): Promise<ValidacaoDoPasso | null> {
    const resultado = await this.releituraDosIdentificadores.recolher(conteudo.processoId, escopo);
    if (this.superada(conteudo)) return GRAVACAO_SUPERADA;
    if (resultado === 'confere') return null;
    if (resultado === 'divergencia') return { valid: false, messages: [AVISO_DIVERGENCIA] };
    this.releituraDosIdentificadores.pendente.set(escopo);
    return { valid: false, messages: [TEXTOS_RELEITURA[escopo]] };
  }

  private async gravarExigencias(conteudo: ConteudoDaGravacao): Promise<ValidacaoDoPasso | null> {
    this.recusasDasExigencias.limpar();
    const exigencias = await this.exigencias.gravar(conteudo.processoId);
    if (this.superada(conteudo)) return GRAVACAO_SUPERADA;
    this.recusasDasExigencias.registrar(exigencias.recusas ?? []);
    if (!exigencias.valid) this.apresentacaoDasRecusas.apresentar();
    return exigencias.valid ? null : exigencias;
  }

  private async gravarConvencao(conteudo: ConteudoDaGravacao): Promise<ValidacaoDoPasso | null> {
    const convencao = this.convencaoDeclarada();
    if (convencao === null) return null;

    const algoritmo = await this.cadastro.definirAlgoritmoContagemPrazo(
      conteudo.processoId,
      convencao,
    );
    if (this.superada(conteudo)) return GRAVACAO_SUPERADA;
    if (!algoritmo.ok) return this.recusarAConvencao(algoritmo.problem);

    this.algoritmoConfirmadoNestaSessao.set(true);
    return null;
  }

  private convencaoDeclarada(): { codigo: string; versao: string } | null {
    const formulario = this.cronograma.formulario.controls;
    const codigo = formulario.algoritmoContagemCodigo.value;
    return codigo === '' ? null : { codigo, versao: formulario.algoritmoContagemVersao.value };
  }

  private recusarAConvencao(problema: ProblemaDaGravacao): ValidacaoDoPasso {
    const titulo = this.problemI18n.resolve(problema).title;
    return {
      valid: false,
      messages: [`As etapas e o cronograma de fases foram gravados. ${titulo}`],
    };
  }

  constructor() {
    effect(() => {
      this.store.geracao();
      untracked(() => this.algoritmoConfirmadoNestaSessao.set(false));
    });
  }
}
