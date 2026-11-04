import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';

import type { EtapaPontuada, WizardDraft } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { mesmoConteudo } from '../../../shared/conteudo-canonico';
import { descreverFase, renumerar, type DescricaoDaFase } from '../../../shared/descricao-da-fase';
import { exigenciasDaFase } from '../../../shared/exigencias/consulta-das-exigencias';
import { semAEtapa, semAFase } from '../../../shared/exigencias/exigencias-documentais';
import { CatalogosDoCronograma } from '../catalogos-do-cronograma.service';
import {
  etapaDoFormulario,
  faseDoFormulario,
  grupoDaEtapa,
  grupoDaFase,
  novoFormularioDoCronograma,
  type FaseForm,
} from '../cronograma-form';
import { etapaComOQueDeclara } from '../regras-da-etapa';
import { ReconciliacaoDasEtapas } from './reconciliacao-das-etapas.service';
import { UnidadesDasFases } from './unidades-das-fases.service';

/**
 * A fase na tela: o formulário que o operador edita, junto do que o catálogo
 * congela sobre ela. O componente monta este par uma vez e o template lê os dois
 * lados sem procurar a fase canônica a cada célula.
 */
export interface FaseNaLinhaDoTempo extends DescricaoDaFase {
  readonly grupo: FormGroup<FaseForm>;
  readonly indice: number;
  /** Rótulo da unidade responsável, ou `null` com a fase sem unidade. */
  readonly unidade: string | null;
}

@Injectable()
export class FormularioDoCronograma {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDoCronograma);
  private readonly unidades = inject(UnidadesDasFases);
  private readonly reconciliacao = inject(ReconciliacaoDasEtapas);

  readonly formulario = novoFormularioDoCronograma();

  /**
   * O conteúdo do formulário, como signal, para que os valores derivados
   * reajam à digitação. `valueChanges` alimenta este sinal; ele não é a fonte
   * do dado, só a forma de o template e os `computed` acompanharem a edição.
   */
  readonly versao = signal(0);

  /**
   * Enquanto o rascunho está sendo espelhado no formulário, o caminho de volta
   * fica fechado: sem isso, cada projeção vinda do servidor dispararia uma
   * escrita no rascunho, que dispararia outra projeção.
   */
  private espelhando = false;

  /**
   * Orientação da recusa de permutação, quando a reordenação pedida forma um
   * ciclo que o servidor não persiste numa chamada só.
   */
  readonly avisoDeReordenacao = signal<string | null>(null);

  readonly fases = this.formulario.controls.fases;
  readonly etapas = this.formulario.controls.etapas;

  /**
   * O que a tela aceita editar: o que o wizard já permite, menos o intervalo em
   * que as etapas gravadas seguem sem identificador. Duas origens para a mesma
   * resposta, resolvidas aqui para que nenhum controle repita a conjunção.
   */
  readonly edicaoLiberada = computed(
    () => this.store.aceitaEdicao() && !this.reconciliacao.reconciliacaoPendente(),
  );

  /**
   * A fase como a tela precisa dela, pela mesma resolução que a conferência
   * usa: o que a fase congelou vale sobre o catálogo, e o catálogo descreve a
   * que acabou de entrar. Duas resoluções separadas divergiriam, e a tela
   * mostraria uma coisa enquanto a validação cobraria outra.
   */
  readonly linhaDoTempo = computed<readonly FaseNaLinhaDoTempo[]>(() => {
    this.versao();
    const fasePorId = this.catalogos.fasePorId();

    return this.fases.controls.map((grupo, indice) => ({
      grupo,
      ...descreverFase(faseDoFormulario(grupo), fasePorId),
      indice,
      unidade: this.unidades.rotuloDaUnidade(grupo),
    }));
  });

  /**
   * Fases que ainda cabem no cronograma, na ordem que as precedências sugerem —
   * uma fase canônica entra uma vez só.
   */
  readonly fasesDisponiveis = computed(() => {
    this.versao();
    const usadas = new Set(this.fases.controls.map((grupo) => grupo.controls.faseCanonicaId.value));
    return this.catalogos.fasesEmOrdemSugerida().filter((fase) => !usadas.has(fase.id));
  });

  /**
   * As etapas como a conferência e o envio as leem: a escala e a avaliação só valem onde a tela
   * as pede. O que ficou num campo que a etapa não mostra não é conferido nem enviado.
   */
  etapasParaEnvio(): readonly EtapaPontuada[] {
    return this.etapas.controls.map((grupo) => {
      const etapa = etapaDoFormulario(grupo);
      return etapaComOQueDeclara(
        etapa,
        this.catalogos.tipoEtapaPorId().get(etapa.tipoEtapaOrigemId),
      );
    });
  }

  acrescentarFase(): void {
    const escolhida = this.formulario.controls.faseAAcrescentar.value;
    if (escolhida === '') return;

    this.fases.push(
      grupoDaFase({
        faseCanonicaId: escolhida,
        codigo: this.catalogos.fasePorId().get(escolhida)?.codigo ?? '',
        ordem: this.fases.length + 1,
        inicio: null,
        fim: null,
        unidadeResponsavelId: this.unidades.unidadeInicialDaFase(escolhida),
        produtos: [],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: null,
        congelados: null,
      }),
    );
    this.formulario.controls.faseAAcrescentar.setValue('');
  }

  acrescentarEtapa(faseCodigo = ''): void {
    this.etapas.push(
      grupoDaEtapa({
        id: null,
        nome: '',
        carater: '',
        tipoEtapaOrigemId: '',
        peso: '',
        notaMinima: '',
        notaMaxima: '',
        passoDoLancamento: '',
        ordem: this.etapas.length + 1,
        faseCodigo,
        produtos: [],
        inicio: '',
        fim: '',
        emiteParecerIndividual: false,
        bancas: [],
        recursos: [],
      }),
    );
  }

  removerEtapa(indice: number): void {
    const removida = this.etapas.at(indice).controls.id.value;
    this.etapas.removeAt(indice, { emitEvent: false });
    this.renumerarEtapas();
    this.desvincularDocumentosDaEtapa(removida);
  }

  /**
   * Tira a etapa removida do registro de quem a apontava como ponto de coleta. Sem isto o
   * rascunho reenviaria o identificador de uma etapa que não existe mais, e a gravação
   * seguinte seria recusada — sem que a tela mostrasse onde está o problema, porque o
   * seletor "Coletado em" não tem opção para um id que sumiu e exibe "A fase inteira".
   */
  private desvincularDocumentosDaEtapa(etapaId: string | null): void {
    if (etapaId === null || etapaId === '') return;

    this.store.patchSection('documentos', semAEtapa(this.store.draft().documentos, etapaId));
  }

  /**
   * Esvazia as etapas de uma vez. Existe para o cronograma que ficou sem a fase
   * que as agrupa: a conferência manda acrescentar a fase ou remover as etapas,
   * e remover uma a uma é o caminho longo para a mesma decisão.
   */
  removerTodasAsEtapas(): void {
    this.etapas.clear();
  }

  /**
   * Troca a etapa de lugar, movendo o grupo inteiro.
   *
   * Move o controle em vez de trocar os valores entre dois: é o `id` que
   * critério de desempate e regra de eliminação referenciam, e recriar a etapa
   * numa posição diferente lhe daria outro identificador no servidor, deixando
   * essas regras apontando para uma etapa que deixou de existir.
   */
  moverEtapa(indice: number, direcao: -1 | 1): void {
    const destino = indice + direcao;
    const atual = this.etapas.at(indice);
    if (atual === undefined || this.etapas.at(destino) === undefined) return;

    this.etapas.removeAt(indice, { emitEvent: false });
    this.etapas.insert(destino, atual, { emitEvent: false });
    this.renumerarEtapas();
  }

  /** Reescreve a posição das etapas de 1 a N, sem tocar nos identificadores. */
  private renumerarEtapas(): void {
    for (const [posicao, grupo] of this.etapas.controls.entries()) {
      grupo.controls.ordem.setValue(posicao + 1, { emitEvent: false });
    }
    this.etapas.updateValueAndValidity();
  }

  /**
   * O que a remoção da fase leva junto, para a confirmação dizer antes de acontecer.
   *
   * Etapas e documentos existem por causa da fase: a etapa declara em que fase acontece, e a
   * exigência documental declara em que fase é entregue. Some a fase, somem eles — mas o
   * operador precisa saber disso antes de clicar, não depois de perder a configuração.
   */
  dependentesDaFase(indice: number): { etapas: number; documentos: number } {
    const codigo = this.fases.at(indice)?.controls.codigo.value ?? '';
    if (codigo === '') return { etapas: 0, documentos: 0 };

    const etapas = this.etapas.controls.filter(
      (grupo) => grupo.controls.faseCodigo.value === codigo,
    ).length;

    // A contagem varre a árvore de exigências, que é como o rascunho as guarda.
    const documentos = exigenciasDaFase(this.store.draft().documentos, codigo).length;

    return { etapas, documentos };
  }

  /**
   * Tira a fase da linha do tempo, com o que era só dela: as etapas dela saem junto, em vez de
   * ficarem apontando para uma fase que não existe mais.
   */
  removerFase(indice: number): void {
    const removida = this.fases.at(indice);
    if (removida === undefined) return;

    const codigo = removida.controls.codigo.value;

    this.fases.removeAt(indice, { emitEvent: false });
    this.removerEtapasDaFase(codigo);
    this.removerDocumentosDaFase(codigo);
    this.renumerarFases();
    this.avisoDeReordenacao.set(null);
  }

  /** As etapas daquela fase, e só elas — identificadas pelo código que cada uma declara. */
  private removerEtapasDaFase(codigo: string): void {
    for (let posicao = this.etapas.length - 1; posicao >= 0; posicao -= 1) {
      if (this.etapas.at(posicao).controls.faseCodigo.value === codigo) {
        this.etapas.removeAt(posicao, { emitEvent: false });
      }
    }
  }

  /**
   * Tira a fase do alcance de cada documento. O documento que valia só ali deixa de ser
   * exigido; o que valia em mais fases continua, sem ela.
   */
  private removerDocumentosDaFase(codigo: string): void {
    this.store.patchSection('documentos', semAFase(this.store.draft().documentos, codigo));
  }

  /**
   * Troca a fase de lugar.
   *
   * A troca é sempre aplicada. Trocar duas fases adjacentes forma o ciclo de
   * ordem que o servidor não persiste numa chamada só — mas recusar aqui
   * deixaria a linha do tempo impossível de reordenar, porque toda troca entre
   * vizinhas tem essa forma. A edição aceita; quem arbitra é a gravação, e é lá
   * que a orientação aparece, com o cronograma que a provocou à vista.
   */
  mover(indice: number, direcao: -1 | 1): void {
    const destino = indice + direcao;
    const atual = this.fases.at(indice);
    const vizinha = this.fases.at(destino);
    if (atual === undefined || vizinha === undefined) return;

    this.fases.removeAt(indice, { emitEvent: false });
    this.fases.insert(destino, atual, { emitEvent: false });
    this.renumerarFases();
    this.avisoDeReordenacao.set(null);
  }

  /** Reescreve a posição de 1 a N na ordem em que as fases estão. */
  private renumerarFases(): void {
    for (const [posicao, grupo] of this.fases.controls.entries()) {
      grupo.controls.ordem.setValue(posicao + 1, { emitEvent: false });
    }
    this.fases.updateValueAndValidity();
  }

  /**
   * Traz o rascunho para o formulário, sem desfazer a digitação em curso.
   *
   * Reconstrói os arrays só quando o conteúdo difere do que já está na tela: o
   * rascunho é atualizado a cada tecla pelo caminho de volta, e recriar os
   * controles a cada uma tiraria o foco do campo que está sendo preenchido.
   */
  private espelharRascunho(cronograma: WizardDraft['cronograma']): void {
    const atuais = {
      fases: this.fases.controls.map(faseDoFormulario),
      etapas: this.etapas.controls.map(etapaDoFormulario),
    };
    const algoritmoIgual =
      this.formulario.controls.algoritmoContagemCodigo.value ===
        cronograma.algoritmoContagemCodigo &&
      this.formulario.controls.algoritmoContagemVersao.value === cronograma.algoritmoContagemVersao;

    if (
      mesmoConteudo(atuais.fases, cronograma.fases) &&
      mesmoConteudo(atuais.etapas, cronograma.etapas) &&
      algoritmoIgual
    ) {
      return;
    }

    this.espelhando = true;
    try {
      this.fases.clear({ emitEvent: false });
      for (const fase of renumerar(cronograma.fases)) {
        this.fases.push(grupoDaFase(fase), { emitEvent: false });
      }

      // A ordem das etapas vem resolvida da hidratação, que renumera o que o
      // servidor devolveu — corrigir de novo aqui deixaria o formulário e o
      // rascunho descrevendo posições diferentes.
      this.etapas.clear({ emitEvent: false });
      for (const etapa of cronograma.etapas) {
        this.etapas.push(grupoDaEtapa(etapa), { emitEvent: false });
      }

      this.formulario.controls.algoritmoContagemCodigo.setValue(
        cronograma.algoritmoContagemCodigo,
        { emitEvent: false },
      );
      this.formulario.controls.algoritmoContagemVersao.setValue(
        cronograma.algoritmoContagemVersao,
        { emitEvent: false },
      );

      if (!this.edicaoLiberada()) this.formulario.disable({ emitEvent: false });
      this.versao.update((versao) => versao + 1);
    } finally {
      this.espelhando = false;
    }
  }

  constructor() {
    this.espelharRascunho(this.store.draft().cronograma);

    // Rascunho → formulário: hidratação da leitura e reconciliação da gravação
    // chegam por aqui, e é a única entrada que não veio da digitação.
    effect(() => {
      const cronograma = this.store.draft().cronograma;
      untracked(() => this.espelharRascunho(cronograma));
    });

    // Formulário → rascunho, que é o que persiste entre passos e alimenta a
    // gravação.
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.versao.update((versao) => versao + 1);
      if (this.espelhando) return;
      this.store.patchObjectSection('cronograma', {
        fases: this.fases.controls.map(faseDoFormulario),
        etapas: this.etapas.controls.map(etapaDoFormulario),
        algoritmoContagemCodigo: this.formulario.controls.algoritmoContagemCodigo.value,
        algoritmoContagemVersao: this.formulario.controls.algoritmoContagemVersao.value,
      });
    });

    // Fora de rascunho o servidor recusa qualquer gravação; o formulário
    // acompanha o que o wizard já decide para os outros passos, e mais o que só
    // este passo sabe — as etapas gravadas à espera dos seus identificadores.
    effect(() => {
      const editavel = this.edicaoLiberada();
      untracked(() => {
        if (editavel) this.formulario.enable({ emitEvent: false });
        else this.formulario.disable({ emitEvent: false });
      });
    });
  }
}
