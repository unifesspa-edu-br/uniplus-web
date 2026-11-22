import { computed, DestroyRef, effect, inject, Injectable } from '@angular/core';

import { ValidacaoDoPasso } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogoDeFases } from '../../cronograma/catalogos/catalogo-de-fases.service';
import { mensagensDePublicacao } from '../comando-de-publicacao';
import { dataReferenciaLegalDe } from '../periodo-de-inscricao';
import { agruparPorDimensao, comoAvisosDaRevisao, comoGruposDaRevisao } from '../grupos-da-revisao';
import { ProntidaoDaPublicacao } from '../prontidao-da-publicacao.service';
import {
  eErroDeDocumentoOuAto,
  eErroDeFaseSemUnidade,
  type ObrigatoriedadeReprovadaProblem,
} from '../problemas-da-publicacao';
import { RecusasDaPublicacao } from '../../../shared/recusas/recusas-da-publicacao.service';

function recusado(mensagem: string): ValidacaoDoPasso {
  return { valid: false, messages: [mensagem] };
}

/**
 * A conferência da publicação: o que o servidor diz estar pendente, estrutural e legalmente, e se
 * a tela já tem o que falta para publicar. Os dois checklists vêm da leitura do servidor, e é ela
 * que a tela relê depois de uma publicação recusada: a recusa e o checklist são duas visões da
 * mesma conferência, sem chave comum, e por isso um não é casado com o outro. Só quando a leitura
 * não está em tela (falhou) vale o que a resposta recusada disse do checklist, e a leitura que
 * chega o substitui. Da recusa a conferência usa também o que nenhum dos dois checklists diz,
 * lido do registro da última resposta recusada.
 */
@Injectable()
export class ConferenciaDaPublicacao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly prontidao = inject(ProntidaoDaPublicacao);
  private readonly catalogoDeFases = inject(CatalogoDeFases);
  private readonly recusasDaPublicacao = inject(RecusasDaPublicacao);

  /** Os itens estruturais em tela: os da leitura, ou os da resposta recusada quando não há leitura. */
  private readonly itensEstruturais = computed(() => {
    const lidos = this.prontidao.estrutural();
    if (lidos !== null) return lidos;
    const daResposta = this.recusasDaPublicacao.checklist()?.pendencias ?? [];
    return daResposta.length === 0 ? null : daResposta.map((item) => ({ ...item, ok: false }));
  });

  /** As reprovações da conformidade legal em tela; `null` enquanto ela não foi avaliada nem dita pela resposta. */
  private readonly obrigatoriedadesReprovadas = computed<
    readonly ObrigatoriedadeReprovadaProblem[] | null
  >(() => {
    const legal = this.prontidao.legal();
    if (legal !== null) return legal.regras.filter((regra) => !regra.aprovada);
    const daResposta = this.recusasDaPublicacao.checklist()?.obrigatoriedadesReprovadas ?? [];
    return daResposta.length === 0 ? null : daResposta;
  });

  readonly gruposEstruturais = computed(() => {
    const itens = this.itensEstruturais();
    return itens === null ? null : comoGruposDaRevisao(agruparPorDimensao(itens));
  });

  /**
   * O erro de documento ou de ato da última recusa, quando "Onde corrigir" não o traz: a resposta
   * que o disse em `errors[]` já o mostra ali, e repeti-lo aqui seria a mesma frase duas vezes.
   */
  readonly erroDeDocumentoOuAto = computed(() => {
    const resposta = this.recusasDaPublicacao.resposta();
    if (resposta === null || this.recusasDaPublicacao.recusas().length > 0) return null;
    return eErroDeDocumentoOuAto(resposta.codigo) ? resposta.titulo : null;
  });

  /** Avisos que não impedem publicar: nunca entram em `estruturalOk()` nem em `validar()`. */
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
    const resposta = this.recusasDaPublicacao.resposta();
    if (resposta === null || !eErroDeFaseSemUnidade(resposta.codigo)) return [];
    const nomeDaFase = this.catalogoDeFases.nomeDaFase();
    return this.store
      .draft()
      .cronograma.fases.filter((fase) => fase.unidadeResponsavelId === null)
      .map((fase) => ({ codigo: fase.codigo, nome: nomeDaFase(fase.codigo) }));
  });

  constructor() {
    // Os outros passos leem da conferência o que lhes cabe; ao sair da Revisão ela deixa de valer.
    const codigosPendentes = computed(() =>
      (this.itensEstruturais() ?? []).filter((item) => !item.ok).map((item) => item.codigo),
    );
    effect(() => this.store.classificacao.pendenciasDaConferencia.set(codigosPendentes()));
    inject(DestroyRef).onDestroy(() => this.store.classificacao.pendenciasDaConferencia.set([]));
  }

  /** O dia civil contra o qual a conformidade legal é avaliada, ou `null` enquanto não se conhece. */
  dataReferenciaLegal(): string | null {
    return dataReferenciaLegalDe(this.store.draft(), this.catalogoDeFases.fasePorId());
  }

  /** Relê o checklist do servidor; a recusa da publicação não muda, porque só uma resposta da publicação a troca. */
  async atualizar(): Promise<void> {
    const id = this.store.processoSeletivoId();
    if (id === null) return;
    await this.prontidao.recarregar(id, this.dataReferenciaLegal());
  }

  /** O que falta nesta tela: campo em branco, checklist reprovado ou documento ainda não escolhido. */
  validar(): ValidacaoDoPasso {
    const aindaSemChecklist = this.recusaPorChecklistIndisponivel();
    if (aindaSemChecklist !== null) return aindaSemChecklist;

    const messages = [
      ...this.pendenciasDoChecklist(),
      ...mensagensDePublicacao(
        this.store.draft(),
        this.documentoAPublicarId(),
        this.catalogoDeFases.fasePorId(),
      ),
    ];
    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /** A recusa de quando não há checklist a conferir: sem processo, com falha de leitura ou ainda carregando. */
  private recusaPorChecklistIndisponivel(): ValidacaoDoPasso | null {
    if (this.store.processoSeletivoId() === null) {
      return recusado('Conclua a identificação do processo antes de revisar a conformidade.');
    }

    const erroDaProntidao = this.prontidao.erro();
    if (erroDaProntidao !== null) return recusado(erroDaProntidao);

    if (this.prontidao.carregando() || this.prontidao.estrutural() === null) {
      return recusado('Aguarde o carregamento do checklist de conformidade.');
    }
    return null;
  }

  private pendenciasDoChecklist(): string[] {
    return [this.pendenciaEstrutural(), this.pendenciaLegal(), this.pendenciaDoDocumento()].filter(
      (mensagem) => mensagem !== null,
    );
  }

  private pendenciaEstrutural(): string | null {
    return this.estruturalOk()
      ? null
      : 'Há pendências estruturais no checklist. Corrija-as antes de publicar.';
  }

  private pendenciaLegal(): string | null {
    const legalIndisponivel = this.prontidao.legalIndisponivel();
    // Dizer "há obrigatoriedades reprovadas" mandaria procurar uma reprovação que não existe.
    if (legalIndisponivel !== null) return legalIndisponivel;
    if (this.legalDesatualizada()) {
      return 'A data de referência do checklist legal mudou desde a última carga. Use "Atualizar checklist" antes de publicar.';
    }
    return this.legalOk()
      ? null
      : 'Há obrigatoriedades legais reprovadas. Corrija-as antes de publicar.';
  }

  private pendenciaDoDocumento(): string | null {
    return this.precisaEscolherDocumento()
      ? 'Há mais de um documento confirmado. Escolha o oficial na Identificação antes de publicar.'
      : null;
  }
}
