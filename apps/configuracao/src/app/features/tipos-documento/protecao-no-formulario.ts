import { Signal, computed, effect, untracked } from '@angular/core';
import { FormGroup } from '@angular/forms';
import type { AprovacaoDaProtecaoDto } from '@uniplus/shared-data/configuracao';
import {
  AprovacaoDoCatalogo,
  esvaziarSeForaDas,
  hipotesesDaClassificacao,
  protecaoMudou,
  type OpcaoDeVocabulario,
  type ProtecaoDoItem,
} from '../../shared/protecao-do-catalogo';
import type { TipoDocumentoForm, ValoresDoTipoDocumento } from './tipo-documento-form';

export interface OrigemDaProtecao {
  readonly form: FormGroup<TipoDocumentoForm>;
  readonly valores: Signal<ValoresDoTipoDocumento>;
  readonly tipoEmEdicaoId: Signal<string | null>;
  readonly emEdicao: Signal<boolean>;
  /** A proteção que o tipo tinha ao abrir o formulário: a base de comparação do aviso. */
  readonly original: Signal<ProtecaoDoItem | null>;
  readonly aprovacao: AprovacaoDoCatalogo;
}

export interface ProtecaoNoFormulario {
  /** As hipóteses legais que cabem na classificação escolhida (art. 7º ou art. 11 da LGPD). */
  readonly hipotesesPermitidas: Signal<readonly OpcaoDeVocabulario[]>;
  /** A decisão da proteção de dados (ajuste recomendado ou reprovação) sobre o tipo em edição. */
  readonly decididoEmEdicao: Signal<AprovacaoDaProtecaoDto | null>;
  /**
   * Salvar devolve a pendente o tipo que já passou pela aprovação (ou está nela) quando muda a
   * classificação, a hipótese legal ou a finalidade; nome, descrição e demais campos não mudam.
   */
  readonly avisaNovaAprovacao: Signal<boolean>;
}

/**
 * O que a proteção de dados acrescenta ao formulário. A hipótese que deixou de caber na
 * classificação que a pessoa escolheu se esvazia, pois ficaria no controle, invisível; a que veio
 * do servidor ao abrir a edição fica como está, e quem decide é a API.
 *
 * Chamar em contexto de injeção.
 */
export function protecaoNoFormulario(origem: OrigemDaProtecao): ProtecaoNoFormulario {
  const hipotesesPermitidas = computed(() =>
    hipotesesDaClassificacao(origem.valores().classificacaoProtecao),
  );

  esvaziarHipoteseIncompativel(origem, hipotesesPermitidas);

  const decididoEmEdicao = computed(() => decisaoEmEdicao(origem));
  const avisaNovaAprovacao = computed(() => voltaAPendente(origem));

  return { hipotesesPermitidas, decididoEmEdicao, avisaNovaAprovacao };
}

function esvaziarHipoteseIncompativel(
  origem: OrigemDaProtecao,
  hipotesesPermitidas: Signal<readonly OpcaoDeVocabulario[]>,
): void {
  effect(() => {
    const hipoteses = hipotesesPermitidas();
    untracked(() => {
      const original = origem.original();
      const { classificacaoProtecao, hipoteseLegal } = origem.form.controls;
      const pessoaMudou =
        original === null ||
        classificacaoProtecao.value !== original.classificacaoProtecao ||
        hipoteseLegal.value !== original.hipoteseLegal;
      if (pessoaMudou) esvaziarSeForaDas(hipoteseLegal, hipoteses);
    });
  });
}

function decisaoEmEdicao(origem: OrigemDaProtecao): AprovacaoDaProtecaoDto | null {
  const id = origem.tipoEmEdicaoId();
  const situacao = id === null || !origem.emEdicao() ? null : origem.aprovacao.aprovacaoDe(id);
  return situacao?.situacao === 'AJUSTE_RECOMENDADO' || situacao?.situacao === 'REPROVADA'
    ? situacao
    : null;
}

function voltaAPendente(origem: OrigemDaProtecao): boolean {
  const id = origem.tipoEmEdicaoId();
  const original = origem.original();
  if (id === null || original === null || !origem.emEdicao()) return false;
  const situacao = origem.aprovacao.aprovacaoDe(id)?.situacao;
  return (
    situacao !== undefined && situacao !== 'PENDENTE' && protecaoMudou(original, origem.valores())
  );
}
