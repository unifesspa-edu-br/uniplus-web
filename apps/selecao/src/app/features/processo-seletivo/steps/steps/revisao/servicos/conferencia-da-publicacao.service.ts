import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ProblemDetails } from '@uniplus/shared-core/http';

import { StepValidation } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogosDoCronograma } from '../../cronograma/catalogos-do-cronograma.service';
import { mensagensDePublicacao } from '../comando-de-publicacao';
import { dataReferenciaLegalDe } from '../periodo-de-inscricao';
import { agruparPorDimensao, comoAvisosDaRevisao, comoGruposDaRevisao } from '../grupos-da-revisao';
import { ProntidaoDaPublicacao } from '../prontidao-da-publicacao.service';
import {
  comoRecusaDePublicacao,
  ObrigatoriedadeReprovadaProblem,
  RecusaDePublicacao,
} from '../problemas-da-publicacao';

function recusado(mensagem: string): StepValidation {
  return { valid: false, messages: [mensagem] };
}

/**
 * A conferência da publicação: o que o servidor diz estar pendente, estrutural e legalmente, e se
 * a tela já tem o que falta para publicar. Reúne a leitura do checklist com a última recusa da
 * publicação, e é aqui que a recusa tem precedência sobre a leitura: o `GET` anterior pode estar
 * desatualizado, e mostrar os grupos antigos ao lado de um banner verde contradiria a própria tela.
 */
@Injectable()
export class ConferenciaDaPublicacao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly prontidao = inject(ProntidaoDaPublicacao);
  private readonly catalogosDoCronograma = inject(CatalogosDoCronograma);

  /** A última recusa da publicação, ou `null` enquanto não houve tentativa (ou ela publicou). */
  readonly ultimaRecusa = signal<RecusaDePublicacao | null>(null);

  /** Os itens do checklist estrutural em tela; `null` enquanto nada foi lido. */
  private readonly itensEstruturais = computed(() => {
    const recusa = this.ultimaRecusa();
    if (recusa === null) return this.prontidao.estrutural();
    return recusa.pendencias.map((pendencia) => ({ ...pendencia, ok: false }));
  });

  /** As obrigatoriedades reprovadas em tela; `null` enquanto a conformidade legal não foi avaliada. */
  private readonly obrigatoriedadesReprovadas = computed<
    readonly ObrigatoriedadeReprovadaProblem[] | null
  >(() => {
    const daRecusa = this.ultimaRecusa()?.obrigatoriedadesReprovadas;
    if (daRecusa !== null && daRecusa !== undefined) return daRecusa;

    const legal = this.prontidao.legal();
    if (legal === null) return null;
    return legal.regras.filter((regra) => !regra.aprovada);
  });

  readonly gruposEstruturais = computed(() => {
    const itens = this.itensEstruturais();
    return itens === null ? null : comoGruposDaRevisao(agruparPorDimensao(itens));
  });

  /** Avisos que não impedem publicar: nunca entram em `estruturalOk()` nem em `validate()`. */
  readonly avisosDaRevisao = computed(() => comoAvisosDaRevisao(this.prontidao.avisos()));

  readonly estruturalOk = computed(
    () => this.itensEstruturais()?.every((item) => item.ok) ?? false,
  );

  readonly regrasLegaisReprovadas = computed(() => this.obrigatoriedadesReprovadas() ?? []);

  readonly legalOk = computed(() => this.obrigatoriedadesReprovadas()?.length === 0);

  /**
   * O checklist legal em tela foi avaliado para uma `dataReferencia` que já não é a que o rascunho
   * declara agora. Não recarrega sozinho, porque a data muda a cada tecla no campo de período; o
   * operador usa "Atualizar checklist".
   */
  readonly legalDesatualizada = computed(
    () =>
      this.prontidao.legal() !== null &&
      this.prontidao.dataReferenciaCarregada() !== this.dataReferenciaLegal(),
  );

  /** O edital confirmado escolhido para a publicação, ou `null` enquanto não há um só vinculado. */
  readonly documentoAPublicarId = computed(() => {
    const upload = this.store.draft().identificacao.uploads[0];
    return upload && upload.fase === 'confirmado' ? (upload.documentoAPublicarId ?? null) : null;
  });

  /** Mais de um documento confirmado aguardando a escolha, que é feita na Identificação. */
  readonly precisaEscolherDocumento = computed(() => this.store.documentosParaEscolha().length > 0);

  /** As fases do rascunho sem unidade responsável, quando é isso que a recusa cita. */
  readonly fasesSemUnidadeDaRecusa = computed(() => {
    if (!this.ultimaRecusa()?.citaFaseSemUnidade) return [];
    const nomeDaFase = this.catalogosDoCronograma.nomeDaFase();
    return this.store
      .draft()
      .cronograma.fases.filter((fase) => fase.unidadeResponsavelId === null)
      .map((fase) => ({ codigo: fase.codigo, nome: nomeDaFase(fase.codigo) }));
  });

  constructor() {
    effect(() => {
      this.store.geracao();
      untracked(() => this.ultimaRecusa.set(null));
    });

    // Os outros passos leem da conferência o que lhes cabe; ao sair da Revisão ela deixa de valer.
    const codigosPendentes = computed(() =>
      (this.itensEstruturais() ?? []).filter((item) => !item.ok).map((item) => item.codigo),
    );
    effect(() => this.store.classificacao.pendenciasDaConferencia.set(codigosPendentes()));
    inject(DestroyRef).onDestroy(() => this.store.classificacao.pendenciasDaConferencia.set([]));
  }

  /** O dia civil contra o qual a conformidade legal é avaliada, ou `null` enquanto não se conhece. */
  dataReferenciaLegal(): string | null {
    return dataReferenciaLegalDe(this.store.draft(), this.catalogosDoCronograma.fasePorId());
  }

  /** Guarda o que o servidor recusou; `titulo` é o texto que o operador lê da recusa. */
  registrarRecusa(problem: ProblemDetails, titulo: string): void {
    this.ultimaRecusa.set(comoRecusaDePublicacao(problem, titulo));
  }

  descartarRecusa(): void {
    this.ultimaRecusa.set(null);
  }

  /** Relê o checklist do servidor e descarta a recusa, que a leitura nova substitui. */
  async atualizar(): Promise<void> {
    const id = this.store.processoSeletivoId();
    if (id === null) return;
    this.descartarRecusa();
    await this.prontidao.recarregar(id, this.dataReferenciaLegal());
  }

  /** O que falta nesta tela: campo em branco, checklist reprovado ou documento ainda não escolhido. */
  validate(): StepValidation {
    if (this.store.processoSeletivoId() === null) {
      return recusado('Conclua a identificação do processo antes de revisar a conformidade.');
    }

    const erroDaProntidao = this.prontidao.erro();
    if (erroDaProntidao !== null) return recusado(erroDaProntidao);

    if (this.prontidao.carregando() || this.prontidao.estrutural() === null) {
      return recusado('Aguarde o carregamento do checklist de conformidade.');
    }

    const messages = [
      ...this.pendenciasDoChecklist(),
      ...mensagensDePublicacao(
        this.store.draft(),
        this.documentoAPublicarId(),
        this.catalogosDoCronograma.fasePorId(),
      ),
    ];
    return messages.length ? { valid: false, messages } : { valid: true };
  }

  private pendenciasDoChecklist(): string[] {
    const messages: string[] = [];
    if (!this.estruturalOk()) {
      messages.push('Há pendências estruturais no checklist. Corrija-as antes de publicar.');
    }

    const legalIndisponivel = this.prontidao.legalIndisponivel();
    if (legalIndisponivel !== null) {
      // Dizer "há obrigatoriedades reprovadas" mandaria procurar uma reprovação que não existe.
      messages.push(legalIndisponivel);
    } else if (this.legalDesatualizada()) {
      messages.push(
        'A data de referência do checklist legal mudou desde a última carga. Use "Atualizar checklist" antes de publicar.',
      );
    } else if (!this.legalOk()) {
      messages.push('Há obrigatoriedades legais reprovadas. Corrija-as antes de publicar.');
    }

    if (this.precisaEscolherDocumento()) {
      messages.push(
        'Há mais de um documento confirmado. Escolha o oficial na Identificação antes de publicar.',
      );
    }
    return messages;
  }
}
