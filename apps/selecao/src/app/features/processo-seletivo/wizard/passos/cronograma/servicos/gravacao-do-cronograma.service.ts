import { computed, effect, inject, Injectable, Injector, signal, untracked } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import {
  ProblemI18nService,
  recusasDoProblema,
  separarCausas,
  type RecusaDoProblema,
} from '@uniplus/shared-core/http';

import type {
  EtapaPontuada,
  FaseDoCronograma,
  ValidacaoDoPasso,
} from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial, type ResultadoGravacao } from '../../../shared/cadastro-inicial.service';
import { focarAposRenderizar } from '../../../shared/foco-apos-renderizar';
import { NumeracaoDasRespostasRecusadas } from '../../../shared/recusas/numeracao-das-respostas-recusadas';
import { resumoDasRecusasSemLugar } from '../../../shared/recusas/texto-da-recusa-no-resumo';
import { resumoDaRecusa } from '../../../shared/resumo-da-recusa';
import { CatalogoDeUnidadesDoCadastro } from '../catalogos/catalogo-de-unidades-do-cadastro.service';
import { alvosDaRecusaDaFase } from '../../fase/alvo-da-recusa-da-fase';
import { campoNaTela } from '../../fase/campo-da-fase';
import { type EtapaForm, faseDoFormulario } from '../cronograma-form';
import { comoComandoDeEtapa } from '../cronograma-para-comando';
import { recusaDaEtapaDeNotaDoEnem, textoDaRecusaDaEtapa } from '../recusas-do-servidor-da-etapa';
import { ConferenciaDoCronograma } from './conferencia-do-cronograma.service';
import type { ControleNaTela } from './distribuicao-das-recusas-das-fases';
import { ExpansaoDoCronograma } from './expansao-do-cronograma.service';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';
import {
  gravarCronogramaFases,
  ORIENTACAO_DE_PERMUTACAO,
  PERMUTACAO_DE_ORDEM,
} from './gravar-cronograma-fases';
import { GravacaoDasExigenciasDocumentais } from './gravacao-das-exigencias-documentais.service';
import { ReleituraDasEtapas, AGUARDA_RELEITURA } from './releitura-das-etapas.service';
import { RecusasDoServidorNasEtapas } from './recusas-do-servidor-nas-etapas.service';
import { RecusasDoServidorNasFases } from './recusas-do-servidor-nas-fases.service';

/** A unidade responsável escolhida para a fase saiu do cadastro de Organização. */
const UNIDADE_RESPONSAVEL_NAO_ENCONTRADA =
  'uniplus.selecao.fase_cronograma.unidade_responsavel_nao_encontrada';

type ProblemaDaGravacao = Extract<ResultadoGravacao, { ok: false }>['problem'];

/** O que uma gravação do cronograma escreve, congelado no instante em que o operador manda gravar. */
interface ConteudoDaGravacao {
  readonly processoId: string;
  readonly geracao: number;
  readonly fases: readonly FaseDoCronograma[];
  readonly grupos: readonly FormGroup<EtapaForm>[];
  readonly etapas: readonly EtapaPontuada[];
}

/**
 * A gravação foi recusada e toda recusa achou o campo dela. O resumo não pode ficar vazio: lista
 * vazia é o sinal de gravação superada, que sai calada, e a recusa precisa contar como pendência.
 */
const RECUSA_MOSTRADA_NOS_CAMPOS =
  'A gravação do cronograma foi recusada. A mensagem de cada recusa está no campo a que ela se refere.';

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
  private readonly catalogoDeUnidades = inject(CatalogoDeUnidadesDoCadastro);
  private readonly cadastro = inject(CadastroInicial);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly exigencias = inject(GravacaoDasExigenciasDocumentais);
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly conferencia = inject(ConferenciaDoCronograma);
  private readonly releituraDasEtapas = inject(ReleituraDasEtapas);
  private readonly recusas = inject(RecusasDoServidorNasEtapas);
  private readonly recusasDasFases = inject(RecusasDoServidorNasFases);
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
    this.store.salvando.set(true);
    try {
      return (await this.gravarEmSequencia(conteudo)) ?? { valid: true };
    } finally {
      if (conteudo.geracao === this.store.geracao()) this.store.salvando.set(false);
    }
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

    this.recusasDasFases.limpar();
    this.recusas.limpar();
    return null;
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

  /**
   * O resumo traz só o que não achou campo; se tudo achou, uma frase diz que a gravação foi
   * recusada e onde ver. Sem nenhuma causa em `errors[]`, a recusa é da raiz e
   * o `code` dela é que se explica.
   */
  /** O que a linha do tempo mostra de cada fase agora, para a recusa não apontar controle que não existe. */
  private controleNaTela(): ControleNaTela {
    const exigencias = new Map(
      this.cronograma
        .linhaDoTempo()
        .map((item) => [item.grupo.controls.faseCanonicaId.value, item.exigencias] as const),
    );
    return (faseCanonicaId, campo) => campoNaTela(campo, exigencias.get(faseCanonicaId) ?? null);
  }

  private resumoDaRecusaDasFases(
    problema: ProblemaDaGravacao,
    semLugar: readonly RecusaDoProblema[],
  ): string[] {
    const { deCampo, gerais } = separarCausas(problema.errors);
    if (deCampo.length === 0 && gerais.length === 0) {
      return [this.explicarRecusa(problema.code, problema)];
    }
    const resumo = resumoDasRecusasSemLugar(problema, semLugar);
    return resumo.length > 0 ? resumo : [RECUSA_MOSTRADA_NOS_CAMPOS];
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

    this.recusas.aplicar(conteudo.grupos, separarCausas(gravacao.problem.errors).deCampo);
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
