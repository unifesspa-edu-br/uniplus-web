import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import {
  comRecusaDePermissaoTratadaNaChamada,
  isApiOk,
  ProblemI18nService,
  type ApiResult,
} from '@uniplus/shared-core/http';
import { ModelosFormularioApi, type ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import { acompanharLeitura } from '@uniplus/shared-ui/components';

import type { FormularioDoProcessoNoRascunho } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { LeiturasEmOrdem } from '../../../../leitura';
import { tituloDoPasso } from '../../../shared/titulo-do-passo';
import { comFormulario, formularioDoCodigo } from '../formularios-do-rascunho';
import {
  comAplicacaoDoServidor,
  modelosOferecidos,
  resumoDaAplicacao,
  textoDaAplicacaoEmAberto,
  type ModeloOferecido,
  type AplicacaoEmAberto,
} from '../modelo-de-formulario';
import { CatalogosDoFormulario } from './catalogos-do-formulario.service';
import { GravacaoDosFormularios } from './gravacao-dos-formularios.service';
import { AplicacaoNoServidor, type DesfechoDaAplicacao } from './aplicacao-no-servidor.service';
import { semChave } from './sem-chave';

interface AplicacaoPedida {
  readonly formulario: FormularioDoProcessoNoRascunho;
  /** Se o formulário é o que o candidato responde ao se inscrever. */
  readonly daInscricao: boolean;
  readonly modelo: ModeloOferecido;
}

const nomeDoFormulario = (codigo: string): string => `formulário ${codigo}`;

function textoDaRecusa(
  codigo: string,
  desfecho: Extract<DesfechoDaAplicacao, { ok: false }>,
  emAberto: AplicacaoEmAberto | undefined,
): string {
  const nome = nomeDoFormulario(codigo);
  if (emAberto === undefined) return `O modelo não foi aplicado ao ${nome}. ${desfecho.recusa}`;
  const texto = textoDaAplicacaoEmAberto(nome, emAberto);
  return desfecho.copiaConfirmada === null
    ? `A nova tentativa foi recusada: ${desfecho.recusa} ${texto}`
    : texto;
}

/**
 * Partir de um modelo da Configuração: os modelos que servem ao tipo do processo, a escolha em
 * cada aba, a confirmação, a cópia no servidor — que não espera a gravação do passo — e o resumo
 * ou a recusa que ficam em texto na aba.
 */
@Injectable()
export class AplicacaoDeModelo {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly servidor = inject(AplicacaoNoServidor);
  private readonly modelosApi = inject(ModelosFormularioApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dados = inject(CatalogosDoFormulario);
  private readonly gravacao = inject(GravacaoDosFormularios);

  /** Os modelos ativos que servem ao tipo do processo. */
  readonly modelos = signal<readonly ModeloOferecido[]>([]);
  readonly modelosCarregando = signal(false);
  readonly modelosErro = signal<string | null>(null);
  private readonly ordemDosModelos = new LeiturasEmOrdem();
  readonly leituraDosModelos = acompanharLeitura({
    falha: this.modelosErro,
    pendente: this.modelosCarregando,
    recarregar: () => this.carregarModelos(),
    destino: tituloDoPasso,
  });
  /** O modelo escolhido em cada aba, pelo id. */
  readonly escolhidos = signal<ReadonlyMap<string, string>>(new Map());
  /** A aplicação que aguarda confirmação: o formulário e o modelo. */
  readonly pendente = signal<AplicacaoPedida | null>(null);
  /** O resumo da última aplicação, por código: fica na aba do formulário que a recebeu. */
  readonly resumos = signal<ReadonlyMap<string, readonly string[]>>(new Map());
  /** A recusa da aplicação, por código, já com o desfecho dito: fica na aba do formulário. */
  readonly recusas = signal<ReadonlyMap<string, string>>(new Map());
  /** As abas cuja recusa só diz que outra cópia está sem desfecho: saem quando ela se resolve. */
  private readonly bloqueadasPorCopiaEmAberto = signal<ReadonlySet<string>>(new Set());

  constructor() {
    // O que o passo guarda de um processo não pode valer para o seguinte.
    effect(() => {
      this.store.geracao();
      untracked(() => this.esquecerOProcessoAnterior());
    });

    // Os modelos só servem para editar, e dependem do tipo, que o passo 1 escolhe.
    effect(() => {
      if (this.store.emConsulta()) return;
      const tipo = this.tipoDoProcesso();
      untracked(() => (tipo === '' ? this.abandonarLeituraDosModelos() : this.carregarModelos()));
    });
  }

  /** Sem tipo não há o que ler. */
  private abandonarLeituraDosModelos(): void {
    this.ordemDosModelos.descartar();
    this.modelosCarregando.set(false);
  }

  private esquecerOProcessoAnterior(): void {
    this.bloqueadasPorCopiaEmAberto.set(new Set());
    this.pendente.set(null);
    this.escolhidos.set(new Map());
    this.resumos.set(new Map());
    this.recusas.set(new Map());
  }

  /** Sem cópia em aberto, a recusa das abas bloqueadas por ela não vale mais. */
  private esquecerBloqueios(): void {
    const bloqueadas = this.bloqueadasPorCopiaEmAberto();
    this.recusas.update((atuais) => new Map([...atuais].filter(([aba]) => !bloqueadas.has(aba))));
    this.bloqueadasPorCopiaEmAberto.set(new Set());
  }

  /** O código do tipo do processo — o que filtra os modelos oferecidos. */
  private readonly tipoDoProcesso = computed(() => this.store.draft().tipoProcesso.codigo);

  /**
   * Busca os modelos ativos que servem ao tipo do processo. Exposto porque a tela oferece nova
   * tentativa, como no catálogo.
   */
  carregarModelos(): void {
    const tipo = this.tipoDoProcesso();
    const aindaVale = this.ordemDosModelos.iniciar();
    this.modelosCarregando.set(true);
    this.modelosErro.set(null);
    this.modelosApi
      .listarTodos({ tipoProcesso: tipo, ativo: true }, comRecusaDePermissaoTratadaNaChamada())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        // A resposta de uma leitura anterior (outro tipo, ou o mesmo pedido de novo) chegaria por
        // cima da atual.
        if (!aindaVale()) return;
        this.receberModelos(resultado);
      });
  }

  private receberModelos(resultado: ApiResult<readonly ModeloFormularioView[]>): void {
    this.modelosCarregando.set(false);
    if (!isApiOk(resultado)) {
      this.modelosErro.set(
        `Não foi possível carregar os modelos de formulário. ${this.problemI18n.resolve(resultado.problem).title}`,
      );
      return;
    }
    this.modelos.set(modelosOferecidos(resultado.data));
  }

  escolher(codigo: string, modeloId: string): void {
    this.escolhidos.update((atuais) => new Map([...atuais, [codigo, modeloId]]));
  }

  /** O código do formulário ainda não gravado mudou: a escolha do modelo segue com ele. */
  trocarCodigo(anterior: string, novo: string): void {
    const modeloId = this.escolhidos().get(anterior);
    if (modeloId === undefined || anterior === novo) return;
    this.escolhidos.update((atuais) => new Map([...semChave(atuais, anterior), [novo, modeloId]]));
  }

  /** Pede a aplicação do modelo escolhido na aba. Devolve a recusa a anunciar, quando houver. */
  pedir(formulario: FormularioDoProcessoNoRascunho, daInscricao: boolean): string | null {
    const modelo = this.modeloEscolhidoNa(formulario.codigo);
    if (modelo === undefined) return null;
    const bloqueio = this.aplicacaoQueBloqueia(formulario.codigo, modelo.id);
    if (bloqueio !== undefined) return this.recusarPorCopiaEmAberto(formulario.codigo, ...bloqueio);
    this.pendente.set({ formulario, daInscricao, modelo });
    return null;
  }

  private modeloEscolhidoNa(codigo: string): ModeloOferecido | undefined {
    const escolhido = this.escolhidos().get(codigo);
    return this.modelos().find((modelo) => modelo.id === escolhido);
  }

  /** As cópias compartilham fatos, derivações e chave em todo o processo. */
  private aplicacaoQueBloqueia(
    codigo: string,
    modeloId: string,
  ): [string, AplicacaoEmAberto] | undefined {
    return [...this.store.aplicacoesDeModeloEmAberto()].find(
      ([outra, emAberto]) =>
        emAberto.copiaConfirmada || outra !== codigo || emAberto.modeloId !== modeloId,
    );
  }

  private recusarPorCopiaEmAberto(
    codigo: string,
    outra: string,
    emAberto: AplicacaoEmAberto,
  ): string {
    const texto = textoDaAplicacaoEmAberto(nomeDoFormulario(outra), emAberto);
    this.mostrarRecusa(codigo, texto);
    this.bloqueadasPorCopiaEmAberto.update((atuais) => new Set([...atuais, codigo]));
    return texto;
  }

  private mostrarRecusa(codigo: string, texto: string): void {
    this.recusas.update((atuais) => new Map([...atuais, [codigo, texto]]));
  }

  cancelar(): void {
    this.pendente.set(null);
  }

  /** O que a confirmação diz antes de substituir: o formulário sai inteiro, com o que não foi gravado. */
  readonly aviso = computed(() => {
    const pendente = this.pendente();
    if (pendente === null) return '';
    const inscricao = pendente.daInscricao
      ? ' Os campos do modelo que outro formulário coleta passam para a inscrição, e esse formulário volta ao que está gravado no processo.'
      : '';
    return (
      `O ${nomeDoFormulario(pendente.formulario.codigo)} passa a ser a cópia do modelo "${pendente.modelo.nome}": ` +
      `as páginas, os campos e os termos que ele tem agora saem, inclusive as edições desta aba ainda não gravadas.${inscricao} Não há como desfazer.`
    );
  });

  /**
   * Aplica o modelo confirmado. A aplicação vai à API na hora — não espera a gravação do passo — e
   * trava o passo enquanto está no ar: um PUT da aba chegando depois substituiria a cópia pelo que
   * estava na tela. Depois, o rascunho recebe o que o servidor ficou tendo, e a reconciliação
   * devolve ao formulário o que o processo pressupõe e o modelo não trazia — a cópia não confere as
   * exigências. O resumo e a recusa ficam em texto na aba, e o texto também volta para ser anunciado.
   */
  async confirmar(reconciliar: () => readonly string[]): Promise<string | null> {
    const pendente = this.pendente();
    this.pendente.set(null);
    const processoId = this.store.processoSeletivoId();
    if (pendente === null || processoId === null) return null;
    this.esquecerAplicacaoAnterior(pendente.formulario.codigo);
    const desfecho = await this.aplicarTravandoOPasso(processoId, pendente);
    if (desfecho === null) return null;
    if (!desfecho.ok) return this.registrarRecusa(pendente, desfecho);
    return this.registrarAplicacao(pendente, desfecho, reconciliar);
  }

  private registrarAplicacao(
    pedida: AplicacaoPedida,
    desfecho: Extract<DesfechoDaAplicacao, { ok: true }>,
    reconciliar: () => readonly string[],
  ): string {
    const codigo = pedida.formulario.codigo;
    this.store.aplicacoesDeModeloEmAberto.update((atuais) => semChave(atuais, codigo));
    if (this.store.aplicacoesDeModeloEmAberto().size === 0) this.esquecerBloqueios();
    if (pedida.daInscricao)
      this.store.camposPostosPelasExigencias.update((atual) => atual.esvaziada());
    this.projetar(desfecho, pedida.formulario.faseCodigo);
    return this.registrarResumo(codigo, pedida.modelo, desfecho, reconciliar());
  }

  private esquecerAplicacaoAnterior(codigo: string): void {
    this.recusas.update((atuais) => semChave(atuais, codigo));
    this.bloqueadasPorCopiaEmAberto.update(
      (atuais) => new Set([...atuais].filter((aba) => aba !== codigo)),
    );
    this.resumos.update((atuais) => semChave(atuais, codigo));
  }

  /** Aplica no servidor com o passo travado; `null` quando o processo mudou no meio. */
  private async aplicarTravandoOPasso(
    processoId: string,
    pedida: AplicacaoPedida,
  ): Promise<DesfechoDaAplicacao | null> {
    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const desfecho = await this.servidor.aplicar(processoId, pedida.formulario, pedida.modelo.id);
      return geracao === this.store.geracao() ? desfecho : null;
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * Guarda a recusa na aba. Enquanto houver cópia sem desfecho — desta tentativa ou de uma
   * anterior —, a aba diz o mesmo que a trava do passo: uma recusa nova não desfaz a cópia que pode
   * ter chegado. A recusa da nova tentativa vem antes, para o operador saber o que corrigir.
   */
  private registrarRecusa(
    pedida: AplicacaoPedida,
    desfecho: Extract<DesfechoDaAplicacao, { ok: false }>,
  ): string {
    if (desfecho.copiaConfirmada !== null)
      this.guardarCopiaSemDesfecho(pedida, desfecho.copiaConfirmada);
    const codigo = pedida.formulario.codigo;
    if (desfecho.formularioNoServidor) this.marcarComoGravado(codigo);
    const emAberto = this.store.aplicacoesDeModeloEmAberto().get(codigo);
    const texto = textoDaRecusa(codigo, desfecho, emAberto);
    this.mostrarRecusa(codigo, texto);
    return texto;
  }

  /** O cabeçalho gravado criou o formulário no servidor: o rascunho passa a tratá-lo como gravado. */
  private marcarComoGravado(codigo: string): void {
    const rascunho = this.store.draft().formulario;
    const atual = formularioDoCodigo(rascunho, codigo);
    if (atual === null || atual.gravado) return;
    this.store.projetarSecao('formulario', comFormulario(rascunho, { ...atual, gravado: true }));
  }

  private guardarCopiaSemDesfecho(pedida: AplicacaoPedida, copiaConfirmada: boolean): void {
    const emAberto = {
      modeloId: pedida.modelo.id,
      modeloNome: pedida.modelo.nome,
      copiaConfirmada,
    };
    this.store.aplicacoesDeModeloEmAberto.update(
      (atuais) => new Map([...atuais, [pedida.formulario.codigo, emAberto]]),
    );
  }

  /**
   * O rascunho recebe o que o servidor ficou tendo. O que ele marcava como posto pelas exigências
   * era do formulário que saiu: a cópia é decisão do modelo.
   */
  private projetar(desfecho: Extract<DesfechoDaAplicacao, { ok: true }>, faseDaAba: string): void {
    this.store.projetarSecao(
      'formulario',
      comAplicacaoDoServidor(
        this.store.draft().formulario,
        desfecho.servidor,
        desfecho.relato,
        faseDaAba,
      ),
    );
  }

  /** O resumo da aplicação, guardado na aba. Só o que a reconciliação acrescentar volta a ser dela. */
  private registrarResumo(
    codigo: string,
    modelo: ModeloOferecido,
    desfecho: Extract<DesfechoDaAplicacao, { ok: true }>,
    acrescentados: readonly string[],
  ): string {
    this.gravacao.esquecerRecusasDa(codigo);
    const resumo = this.linhasDoResumo(modelo, desfecho, acrescentados);
    this.resumos.update((atuais) => new Map([...atuais, [codigo, resumo]]));
    return resumo.join(' ');
  }
  private linhasDoResumo(
    modelo: ModeloOferecido,
    desfecho: Extract<DesfechoDaAplicacao, { ok: true }>,
    acrescentados: readonly string[],
  ): readonly string[] {
    const nomeDoFato = new Map(this.dados.catalogo().map((fato) => [fato.codigo, fato.nome]));
    const nome = (codigo: string) => nomeDoFato.get(codigo) ?? codigo;
    return [
      ...resumoDaAplicacao(desfecho.relato, modelo.nome, acrescentados, nome),
      ...(desfecho.avisoDaFase === null ? [] : [desfecho.avisoDaFase]),
    ];
  }
}
