import { computed, inject, Injectable } from '@angular/core';
import { FINALIDADE_INSCRICAO } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { descreverFase } from '../../../shared/descricao-da-fase';
import { fatosParaLerOGatilho } from '../../../shared/documentos-exigidos';
import { CatalogosDoCronograma } from '../../cronograma/catalogos-do-cronograma.service';
import type { FaseDoCronograma } from '../abas-do-formulario';
import {
  faseEfetiva,
  faseServeAFinalidade,
  finalidadesParaAcrescentar,
  formulariosDoRascunho,
} from '../formularios-por-finalidade';

/**
 * Em que fase do cronograma cada formulário é respondido, e o que o cronograma permite acrescentar:
 * a fase escolhida enquanto servir à finalidade, ou a única que serve. A API recusa fase de outra
 * finalidade, e enviar a fase nula apagaria a gravada — a publicação recusa formulário sem fase.
 */
@Injectable()
export class FasesDosFormularios {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDoCronograma);

  private readonly formularios = computed(() =>
    formulariosDoRascunho(this.store.draft().formulario),
  );

  /** As fases do cronograma, com o que decide a finalidade que cada uma atende. */
  readonly fasesDoCronograma = computed<readonly FaseDoCronograma[]>(() => {
    const fasePorId = this.catalogos.fasePorId();
    return this.store.draft().cronograma.fases.map((fase) => {
      const descricao = descreverFase(fase, fasePorId);
      return {
        codigo: fase.codigo,
        nome: descricao.nome,
        coletaInscricao: descricao.coletaInscricao,
        coletaSolicitacaoIsencao: descricao.coletaSolicitacaoIsencao,
      };
    });
  });

  /** A fase de cada formulário, por finalidade: as que servem a ela e a escolhida. */
  readonly porFinalidade = computed(
    () =>
      new Map(
        this.formularios().map((formulario) => {
          const opcoes = this.fasesDoCronograma().filter((fase) =>
            faseServeAFinalidade(formulario.finalidade, fase),
          );
          return [
            formulario.finalidade,
            { opcoes, escolhida: faseEfetiva(formulario.faseCodigo, opcoes) },
          ] as const;
        }),
      ),
  );

  readonly faseDaInscricao = computed(
    () => this.porFinalidade().get(FINALIDADE_INSCRICAO)?.escolhida ?? '',
  );

  /** As finalidades que o operador pode acrescentar agora. */
  readonly finalidadesOferecidas = computed(() =>
    finalidadesParaAcrescentar(
      this.formularios().map((formulario) => formulario.finalidade),
      this.store.draft().pagamento.cobra === true,
      this.fasesDoCronograma(),
    ),
  );

  /** Como a lista de documentos do formulário nomeia o tipo de documento e lê o público de cada um. */
  readonly vocabularioDosDocumentos = computed(() => {
    const tipoPorId = this.catalogos.tipoDocumentoPorId();
    return {
      fatoPorCodigo: fatosParaLerOGatilho(
        this.catalogos.fatos(),
        this.store.draft().atendimento.condicoes.map((condicao) => condicao.codigo),
        this.store.modalidadesDoProcesso(),
      ),
      nomeDoTipo: (id: string, nomeGuardado: string | undefined) =>
        tipoPorId.get(id)?.nome ?? nomeGuardado ?? id,
    };
  });
}
