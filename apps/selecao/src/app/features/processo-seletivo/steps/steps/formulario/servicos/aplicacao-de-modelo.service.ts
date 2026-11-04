import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { ModelosFormularioApi } from '@uniplus/shared-data/configuracao';
import { FINALIDADE_INSCRICAO } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  comAplicacaoDoServidor,
  modelosPorFinalidade,
  resumoDaAplicacao,
  textoDaAplicacaoEmAberto,
  type ModeloOferecido,
} from '../modelo-de-formulario';
import { nomeDaFinalidade } from '../formularios-por-finalidade';
import { CatalogosDoFormularioService } from './catalogos-do-formulario.service';
import { GravacaoDosFormularios } from './gravacao-dos-formularios.service';
import {
  AplicacaoNoServidorService,
  type DesfechoDaAplicacao,
} from './aplicacao-no-servidor.service';
import { semChave } from './sem-chave';

/**
 * Partir de um modelo da Configuração: os modelos que servem ao tipo do processo, a escolha em
 * cada aba, a confirmação, a cópia no servidor — que não espera a gravação do passo — e o resumo
 * ou a recusa que ficam em texto na aba.
 */
@Injectable()
export class AplicacaoDeModeloService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly servidor = inject(AplicacaoNoServidorService);
  private readonly modelosApi = inject(ModelosFormularioApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dados = inject(CatalogosDoFormularioService);
  private readonly gravacao = inject(GravacaoDosFormularios);

  /** Os modelos ativos que servem ao tipo do processo, por finalidade. */
  readonly modelos = signal<ReadonlyMap<string, readonly ModeloOferecido[]>>(new Map());
  readonly modelosCarregando = signal(false);
  readonly modelosErro = signal<string | null>(null);
  /** O modelo escolhido em cada aba, pelo id. */
  readonly escolhidos = signal<ReadonlyMap<string, string>>(new Map());
  /** A aplicação que aguarda confirmação: a finalidade e o modelo. */
  readonly pendente = signal<{
    readonly finalidade: string;
    readonly modelo: ModeloOferecido;
  } | null>(null);
  /** O resumo da última aplicação, por finalidade: fica na aba do formulário que a recebeu. */
  readonly resumos = signal<ReadonlyMap<string, readonly string[]>>(new Map());
  /** A recusa da aplicação, por finalidade, já com o desfecho dito: fica na aba do formulário. */
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
      if (this.store.emConsulta() || this.tipoDoProcesso() === '') return;
      untracked(() => this.carregarModelos());
    });
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
    this.modelosCarregando.set(true);
    this.modelosErro.set(null);
    this.modelosApi
      .listar({ tipoProcesso: tipo, ativo: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        // A resposta de um tipo já trocado chegaria por cima da do tipo atual.
        if (tipo !== this.tipoDoProcesso()) return;
        this.modelosCarregando.set(false);
        if (!isApiOk(resultado)) {
          this.modelosErro.set(this.problemI18n.resolve(resultado.problem).title);
          return;
        }
        this.modelos.set(modelosPorFinalidade(resultado.data));
      });
  }

  escolher(finalidade: string, modeloId: string): void {
    this.escolhidos.update((atuais) => new Map([...atuais, [finalidade, modeloId]]));
  }

  /** Pede a aplicação do modelo escolhido na aba. Devolve a recusa a anunciar, quando houver. */
  pedir(finalidade: string): string | null {
    const escolhido = this.escolhidos().get(finalidade);
    const modelo = this.modelos()
      .get(finalidade)
      ?.find((oferecido) => oferecido.id === escolhido);
    if (modelo === undefined) return null;
    // Uma aplicação sem desfecho, em qualquer aba, só admite a nova tentativa dela: as cópias
    // mexem no que é do processo inteiro (fatos da inscrição, derivações) e dividem a mesma chave.
    const bloqueio = [...this.store.aplicacoesDeModeloEmAberto()].find(
      ([outra, emAberto]) =>
        emAberto.copiaConfirmada || outra !== finalidade || emAberto.modeloId !== modelo.id,
    );
    if (bloqueio !== undefined) {
      const [outra, emAberto] = bloqueio;
      const texto = textoDaAplicacaoEmAberto(nomeDaFinalidade(outra), emAberto);
      this.mostrarRecusa(finalidade, texto);
      this.bloqueadasPorCopiaEmAberto.update((atuais) => new Set([...atuais, finalidade]));
      return texto;
    }
    this.pendente.set({ finalidade, modelo });
    return null;
  }

  private mostrarRecusa(finalidade: string, texto: string): void {
    this.recusas.update((atuais) => new Map([...atuais, [finalidade, texto]]));
  }

  cancelar(): void {
    this.pendente.set(null);
  }

  /** O que a confirmação diz antes de substituir: o formulário sai inteiro, com o que não foi gravado. */
  readonly aviso = computed(() => {
    const pendente = this.pendente();
    if (pendente === null) return '';
    const inscricao =
      pendente.finalidade === FINALIDADE_INSCRICAO
        ? ' Os campos do modelo que outro formulário coleta passam para a inscrição, e esse formulário volta ao que está gravado no processo.'
        : '';
    return (
      `O formulário de ${nomeDaFinalidade(pendente.finalidade)} passa a ser a cópia do modelo "${pendente.modelo.nome}": ` +
      `as etapas, os campos e os termos que ele tem agora saem, inclusive as edições desta aba ainda não gravadas.${inscricao} Não há como desfazer.`
    );
  });

  /**
   * Aplica o modelo confirmado. A aplicação vai à API na hora — não espera a gravação do passo — e
   * trava o passo enquanto está no ar: um PUT da aba chegando depois substituiria a cópia pelo que
   * estava na tela. Depois, o rascunho recebe o que o servidor ficou tendo, e a reconciliação
   * devolve ao formulário o que o processo pressupõe e o modelo não trazia — a cópia não confere as
   * exigências. O resumo e a recusa ficam em texto na aba, e o texto também volta para ser anunciado.
   */
  async confirmar(
    faseDaAbaPor: (finalidade: string) => string,
    reconciliar: () => readonly string[],
  ): Promise<string | null> {
    const pendente = this.pendente();
    this.pendente.set(null);
    const processoId = this.store.processoSeletivoId();
    if (pendente === null || processoId === null) return null;
    const { finalidade, modelo } = pendente;
    const faseDaAba = faseDaAbaPor(finalidade);
    this.esquecerAplicacaoAnterior(finalidade);

    const desfecho = await this.aplicarTravandoOPasso(processoId, finalidade, modelo.id, faseDaAba);
    if (desfecho === null) return null;

    if (!desfecho.ok) return this.registrarRecusa(finalidade, modelo, desfecho);

    this.store.aplicacoesDeModeloEmAberto.update((atuais) => semChave(atuais, finalidade));
    if (this.store.aplicacoesDeModeloEmAberto().size === 0) this.esquecerBloqueios();
    this.projetar(finalidade, desfecho, faseDaAba);
    return this.registrarResumo(finalidade, modelo, desfecho, reconciliar());
  }

  private esquecerAplicacaoAnterior(finalidade: string): void {
    this.recusas.update((atuais) => semChave(atuais, finalidade));
    this.bloqueadasPorCopiaEmAberto.update(
      (atuais) => new Set([...atuais].filter((aba) => aba !== finalidade)),
    );
    this.resumos.update((atuais) => semChave(atuais, finalidade));
  }

  /** Aplica no servidor com o passo travado; `null` quando o processo mudou no meio. */
  private async aplicarTravandoOPasso(
    processoId: string,
    finalidade: string,
    modeloId: string,
    faseDaAba: string,
  ): Promise<DesfechoDaAplicacao | null> {
    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const desfecho = await this.servidor.aplicar(processoId, finalidade, modeloId, faseDaAba);
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
    finalidade: string,
    modelo: ModeloOferecido,
    desfecho: Extract<DesfechoDaAplicacao, { ok: false }>,
  ): string {
    if (desfecho.copiaConfirmada !== null) {
      const emAberto = {
        modeloId: modelo.id,
        modeloNome: modelo.nome,
        copiaConfirmada: desfecho.copiaConfirmada,
      };
      this.store.aplicacoesDeModeloEmAberto.update(
        (atuais) => new Map([...atuais, [finalidade, emAberto]]),
      );
    }
    const emAberto = this.store.aplicacoesDeModeloEmAberto().get(finalidade);
    const nome = nomeDaFinalidade(finalidade);
    const textoEmAberto = emAberto === undefined ? null : textoDaAplicacaoEmAberto(nome, emAberto);
    const texto =
      textoEmAberto === null
        ? `O modelo não foi aplicado ao formulário de ${nome}. ${desfecho.recusa}`
        : desfecho.copiaConfirmada === null
          ? `A nova tentativa foi recusada: ${desfecho.recusa} ${textoEmAberto}`
          : textoEmAberto;
    this.mostrarRecusa(finalidade, texto);
    return texto;
  }

  /**
   * O rascunho recebe o que o servidor ficou tendo. O que ele marcava como posto pelas exigências
   * era do formulário que saiu: a cópia é decisão do modelo.
   */
  private projetar(
    finalidade: string,
    desfecho: Extract<DesfechoDaAplicacao, { ok: true }>,
    faseDaAba: string,
  ): void {
    if (finalidade === FINALIDADE_INSCRICAO) this.store.camposPostosPelasExigencias.set(new Set());
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
    finalidade: string,
    modelo: ModeloOferecido,
    desfecho: Extract<DesfechoDaAplicacao, { ok: true }>,
    acrescentados: readonly string[],
  ): string {
    this.gravacao.esquecerRecusasDa(finalidade);
    const nomeDoFato = new Map(this.dados.catalogo().map((fato) => [fato.codigo, fato.nome]));
    const resumo = [
      ...resumoDaAplicacao(
        desfecho.relato,
        modelo.nome,
        acrescentados,
        (codigo) => nomeDoFato.get(codigo) ?? codigo,
      ),
      ...(desfecho.avisoDaFase === null ? [] : [desfecho.avisoDaFase]),
    ];
    this.resumos.update((atuais) => new Map([...atuais, [finalidade, resumo]]));
    return resumo.join(' ');
  }
}
