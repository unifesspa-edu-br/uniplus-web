import { computed, linkedSignal, type Signal } from '@angular/core';

import { anunciarMudancaDaAvaliacao, type DecisaoDaAvaliacao } from './anuncios-do-formulario';
import {
  aguardaVerificacaoDeObrigatorio,
  haArquivoEmVerificacao,
  situacoesEArquivosDosDocumentos,
} from './documentos-avaliados';
import { documentosDaAvaliacao, documentosDaFase, iguaisPorJson } from './documentos-na-avaliacao';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import type { OcorrenciaSimulada } from './interpretador/regras-do-formulario';
import {
  type AvaliacaoNaTela,
  conhecidas,
  type ModalidadesAvaliadas,
} from './modalidades-avaliadas';

/** O que as decisões da API dependem de ler do formulário. */
export interface FontesDasDecisoes {
  readonly avaliacao: Signal<AvaliacaoNaTela | null>;
  readonly formulario: Signal<FormularioDoCandidato>;
  readonly grupos: () => Readonly<Record<string, readonly OcorrenciaSimulada[]>>;
}

/**
 * O que a API calculou das respostas (ADR-0143) e a tela usa: as modalidades que a inscrição define, os
 * documentos exigidos com a situação e os arquivos de cada um, e o anúncio, para o leitor de tela, do que
 * mudou. Só lê a avaliação: não guarda resposta alguma.
 */
export class DecisoesDaAvaliacao {
  /**
   * O último conjunto decidido das modalidades. Enquanto falta responder, ele fica: o conjunto que vier
   * depois é comparado com o que o candidato tinha antes de abrir a pendência.
   */
  private readonly conjuntoConhecido = linkedSignal<
    ModalidadesAvaliadas | null,
    ModalidadesAvaliadas | null
  >({
    source: computed(() => this.fontes.avaliacao()?.modalidades ?? null),
    computation: (atuais, anterior) => (conhecidas(atuais) ? atuais : (anterior?.value ?? null)),
  });
  /** O último conjunto decidido das modalidades da 2ª opção de curso, mantido como o da 1ª. */
  private readonly conjuntoConhecidoDaSegundaOpcao = linkedSignal<
    ModalidadesAvaliadas | null,
    ModalidadesAvaliadas | null
  >({
    source: computed(() => this.fontes.avaliacao()?.modalidadesSegundaOpcao ?? null),
    // Sem 2ª opção, não há conjunto a guardar: o da opção retirada não volta.
    computation: (atuais, anterior) =>
      atuais === null ? null : conhecidas(atuais) ? atuais : (anterior?.value ?? null),
  });

  /** Os documentos da fase e da finalidade do formulário, como a avaliação da API os traz. */
  private readonly documentosDaFase = computed(() => {
    // O formulário só é lido com avaliação: quem hospeda consulta antes de ele ter entradas.
    const avaliacao = this.fontes.avaliacao();
    return avaliacao?.documentos == null
      ? null
      : documentosDaFase(avaliacao, this.fontes.formulario());
  });
  private readonly documentos = computed(() => this.documentosDaFase()?.documentos ?? []);
  /** Os documentos que a avaliação pede no próprio formulário; nulos antes da primeira avaliação. */
  readonly documentosDaAvaliacao = computed(
    () => {
      const daFase = this.documentosDaFase();
      return daFase === null
        ? null
        : documentosDaAvaliacao(daFase, this.fontes.formulario(), this.fontes.grupos());
    },
    { equal: iguaisPorJson },
  );
  /** A situação e os arquivos de cada exigência da fase, como a avaliação da API os traz. */
  private readonly situacaoEArquivos = computed(
    () => situacoesEArquivosDosDocumentos(this.documentos()),
    { equal: iguaisPorJson },
  );
  readonly situacoes = computed(() => this.situacaoEArquivos().situacoes);
  readonly arquivos = computed(() => this.situacaoEArquivos().arquivos);
  /**
   * Há documento obrigatório com o arquivo em verificação: a inscrição só segue depois do resultado
   * (UNI-REQ-0028). Quem hospeda usa para barrar o envio.
   */
  readonly aguardaVerificacao = computed(() => aguardaVerificacaoDeObrigatorio(this.documentos()));
  /**
   * Algum arquivo da fase, obrigatório ou não, espera o resultado: quem hospeda segue consultando a
   * avaliação enquanto isso, sobre os mesmos documentos que barram o envio.
   */
  readonly haArquivoEmVerificacao = computed(() => haArquivoEmVerificacao(this.documentos()));

  /**
   * A mesma resposta pode mudar as modalidades e os documentos: os dois vão no mesmo anúncio, e só o que
   * mudou desta vez entra nele — o anúncio de antes não volta a ser lido.
   */
  readonly anuncio = linkedSignal<DecisaoDaAvaliacao, string>({
    source: computed(() => ({
      modalidades: this.conjuntoConhecido(),
      modalidadesDaSegundaOpcao: this.conjuntoConhecidoDaSegundaOpcao(),
      documentos: this.documentosDaAvaliacao()?.arvore ?? null,
      integrantes: new Set(
        Object.values(this.fontes.grupos()).flatMap((lista) => lista.map((o) => o.id)),
      ),
    })),
    computation: (atual, anterior) =>
      anterior ? anunciarMudancaDaAvaliacao(atual, anterior.source) : '',
  });

  constructor(private readonly fontes: FontesDasDecisoes) {}
}
