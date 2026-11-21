import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';

import type { EtapaPontuada, WizardDraft } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { mesmoConteudo } from '../../../shared/conteudo-canonico';
import { descreverFase, renumerar, type DescricaoDaFase } from '../../../shared/descricao-da-fase';
import { exigenciasDaFase } from '../../../shared/exigencias/consulta-das-exigencias';
import { semAEtapa, semAFase } from '../../../shared/exigencias/exigencias-documentais';
import { CatalogoDeFases } from '../catalogos/catalogo-de-fases.service';
import { CatalogoDeTiposDeEtapa } from '../catalogos/catalogo-de-tipos-de-etapa.service';
import {
  etapaComoNoFormulario,
  etapaDoFormulario,
  etapaRecemAcrescentada,
  faseComoNoFormulario,
  faseDoFormulario,
  faseRecemAcrescentada,
  grupoDaEtapa,
  grupoDaFase,
  novoFormularioDoCronograma,
  type FaseForm,
} from '../cronograma-form';
import { etapaComOQueDeclara } from '../regras-da-etapa';
import { espelharFasesNoFormulario } from './espelho-das-fases-no-formulario';
import { RecusasDoServidorNasFases } from './recusas-do-servidor-nas-fases.service';
import { SequenciaDasFases } from './sequencia-das-fases';
import { ReleituraDosIdentificadores } from './releitura-dos-identificadores.service';
import { UnidadesResponsaveisDasFases } from './unidades-responsaveis-das-fases.service';

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
  private readonly catalogoDeFases = inject(CatalogoDeFases);
  private readonly catalogoDeTiposDeEtapa = inject(CatalogoDeTiposDeEtapa);
  private readonly unidades = inject(UnidadesResponsaveisDasFases);
  private readonly releituraDosIdentificadores = inject(ReleituraDosIdentificadores);
  private readonly recusasDasFases = inject(RecusasDoServidorNasFases);

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
  private escritaSuspensa = false;

  readonly fases = this.formulario.controls.fases;
  readonly sequencia = new SequenciaDasFases(this.fases);
  readonly etapas = this.formulario.controls.etapas;

  /**
   * O que a tela aceita editar: o que o wizard já permite, menos o intervalo em
   * que as etapas gravadas seguem sem identificador. Duas origens para a mesma
   * resposta, resolvidas aqui para que nenhum controle repita a conjunção.
   */
  readonly edicaoLiberada = computed(
    () => this.store.aceitaEdicao() && this.releituraDosIdentificadores.pendente() === null,
  );

  /**
   * A fase como a tela precisa dela, pela mesma resolução que a conferência
   * usa: o que a fase congelou vale sobre o catálogo, e o catálogo descreve a
   * que acabou de entrar. Duas resoluções separadas divergiriam, e a tela
   * mostraria uma coisa enquanto a validação cobraria outra.
   */
  readonly linhaDoTempo = computed<readonly FaseNaLinhaDoTempo[]>(() => {
    this.versao();
    const fasePorId = this.catalogoDeFases.fasePorId();

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
    return this.catalogoDeFases.fasesEmOrdemSugerida().filter((fase) => !usadas.has(fase.id));
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
        this.catalogoDeTiposDeEtapa.tipoEtapaPorId().get(etapa.tipoEtapaOrigemId),
      );
    });
  }

  acrescentarFase(): void {
    const escolhida = this.formulario.controls.faseAAcrescentar.value;
    if (escolhida === '') return;

    const fase = faseRecemAcrescentada({
      faseCanonicaId: escolhida,
      codigo: this.catalogoDeFases.fasePorId().get(escolhida)?.codigo ?? '',
      ordem: this.fases.length + 1,
      unidadeResponsavelId: this.unidades.unidadeInicialDaFase(escolhida),
    });
    this.fases.push(grupoDaFase(fase));
    this.formulario.controls.faseAAcrescentar.setValue('');
  }

  acrescentarEtapa(faseCodigo = ''): void {
    this.etapas.push(
      grupoDaEtapa(etapaRecemAcrescentada({ ordem: this.etapas.length + 1, faseCodigo })),
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
    this.numerarEtapas();
    this.etapas.updateValueAndValidity();
  }

  /** Numera sem emitir: a remoção da fase emite uma só vez, depois de tirar tudo o que era dela. */
  private numerarEtapas(): void {
    for (const [posicao, grupo] of this.etapas.controls.entries()) {
      grupo.controls.ordem.setValue(posicao + 1, { emitEvent: false });
    }
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

    this.semEscreverNoRascunho(() => {
      this.removerEtapasDaFase(codigo);
      this.sequencia.retirar(indice);
    });
    this.escreverSemAFase(codigo);
  }

  /** Documentos e cronograma saem do rascunho juntos, na mesma escrita. */
  private escreverSemAFase(codigo: string): void {
    this.store.patchSections({
      documentos: semAFase(this.store.draft().documentos, codigo),
      cronograma: { ...this.store.draft().cronograma, ...this.cronogramaDoFormulario() },
    });
    this.recusasDasFases.registrarAlteracao();
  }

  /**
   * O formulário muda por etapas, mas o rascunho precisa de uma só escrita já completa: com a
   * escrita suspensa, nenhum intervalo do rascunho tem a fase sem as etapas dela.
   */
  private semEscreverNoRascunho(alteracao: () => void): void {
    this.escritaSuspensa = true;
    try {
      alteracao();
    } finally {
      this.escritaSuspensa = false;
    }
  }

  /** As etapas daquela fase, e só elas — identificadas pelo código que cada uma declara. */
  private removerEtapasDaFase(codigo: string): void {
    for (let posicao = this.etapas.length - 1; posicao >= 0; posicao -= 1) {
      if (this.etapas.at(posicao).controls.faseCodigo.value === codigo) {
        this.etapas.removeAt(posicao, { emitEvent: false });
      }
    }
    this.numerarEtapas();
  }

  private jaEspelha(cronograma: WizardDraft['cronograma']): boolean {
    const controles = this.formulario.controls;
    return (
      this.fasesJaEspelhadas(cronograma.fases) &&
      this.etapasJaEspelhadas(cronograma.etapas) &&
      controles.algoritmoContagemCodigo.value === cronograma.algoritmoContagemCodigo &&
      controles.algoritmoContagemVersao.value === cronograma.algoritmoContagemVersao
    );
  }

  /**
   * Compara com o rascunho como o formulário o mostraria, não como foi escrito: o rascunho que
   * chega de fora pode omitir campos opcionais ou trazer a janela em outro formato, e tratar isso
   * como mudança recriaria os controles na primeira edição, quando o caminho de volta reescreve
   * o rascunho na forma do formulário.
   */
  private fasesJaEspelhadas(fases: WizardDraft['cronograma']['fases']): boolean {
    return mesmoConteudo(
      this.fases.controls.map(faseDoFormulario),
      fases.map(faseComoNoFormulario),
    );
  }

  private etapasJaEspelhadas(etapas: WizardDraft['cronograma']['etapas']): boolean {
    return mesmoConteudo(
      this.etapas.controls.map(etapaDoFormulario),
      etapas.map(etapaComoNoFormulario),
    );
  }

  /**
   * Reconstrói só o que difere. A ordem das etapas vem resolvida da hidratação, que renumera o
   * que o servidor devolveu: corrigir de novo aqui deixaria o formulário e o rascunho
   * descrevendo posições diferentes.
   */
  private reconstruirDe(cronograma: WizardDraft['cronograma']): void {
    if (!this.fasesJaEspelhadas(cronograma.fases)) {
      espelharFasesNoFormulario(this.fases, renumerar(cronograma.fases));
    }
    if (!this.etapasJaEspelhadas(cronograma.etapas)) this.recriarEtapas(cronograma.etapas);

    const controles = this.formulario.controls;
    const semEvento = { emitEvent: false };
    controles.algoritmoContagemCodigo.setValue(cronograma.algoritmoContagemCodigo, semEvento);
    controles.algoritmoContagemVersao.setValue(cronograma.algoritmoContagemVersao, semEvento);
  }

  private recriarEtapas(etapas: WizardDraft['cronograma']['etapas']): void {
    this.etapas.clear({ emitEvent: false });
    for (const etapa of etapas) this.etapas.push(grupoDaEtapa(etapa), { emitEvent: false });
  }

  /**
   * Traz o rascunho para o formulário, sem desfazer a digitação em curso.
   *
   * Reconstrói os arrays só quando o conteúdo difere do que já está na tela: o
   * rascunho é atualizado a cada tecla pelo caminho de volta, e recriar os
   * controles a cada uma tiraria o foco do campo que está sendo preenchido.
   */
  private espelharRascunho(cronograma: WizardDraft['cronograma']): void {
    if (this.jaEspelha(cronograma)) return;

    this.espelhando = true;
    try {
      this.reconstruirDe(cronograma);
      if (!this.edicaoLiberada()) this.formulario.disable({ emitEvent: false });
      this.versao.update((versao) => versao + 1);
    } finally {
      this.espelhando = false;
    }
  }

  constructor() {
    this.espelharRascunho(this.store.draft().cronograma);
    this.acompanharORascunho();
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.aoEditar());
    this.acompanharAEdicaoLiberada();
  }

  /** Rascunho → formulário: a hidratação e a reconciliação da gravação, que não vêm da digitação. */
  private acompanharORascunho(): void {
    effect(() => {
      const cronograma = this.store.draft().cronograma;
      untracked(() => this.espelharRascunho(cronograma));
    });
  }

  /** Formulário → rascunho, que é o que persiste entre passos e alimenta a gravação. */
  private aoEditar(): void {
    this.versao.update((versao) => versao + 1);
    if (this.espelhando || this.escritaSuspensa) return;
    this.store.patchObjectSection('cronograma', this.cronogramaDoFormulario());
    this.recusasDasFases.registrarAlteracao();
  }

  private cronogramaDoFormulario(): Partial<WizardDraft['cronograma']> {
    return {
      fases: this.fases.controls.map(faseDoFormulario),
      etapas: this.etapas.controls.map(etapaDoFormulario),
      algoritmoContagemCodigo: this.formulario.controls.algoritmoContagemCodigo.value,
      algoritmoContagemVersao: this.formulario.controls.algoritmoContagemVersao.value,
    };
  }

  /** Fora de rascunho o servidor recusa qualquer gravação: o formulário segue `edicaoLiberada`. */
  private acompanharAEdicaoLiberada(): void {
    effect(() => {
      const editavel = this.edicaoLiberada();
      untracked(() => {
        if (editavel) this.formulario.enable({ emitEvent: false });
        else this.formulario.disable({ emitEvent: false });
      });
    });
  }
}
