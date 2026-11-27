import { computed, effect, inject, Injectable, untracked } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { descreverFase } from '../../../shared/descricao-da-fase';
import { fatosParaLerOGatilho } from '../../../shared/documentos-exigidos';
import { CatalogoDasConsequenciasDeIndeferimento } from '../../cronograma/catalogos/catalogo-das-consequencias-de-indeferimento.service';
import { CatalogoDeDocumentos } from '../../cronograma/catalogos/catalogo-de-documentos.service';
import { CatalogoDeFases } from '../../cronograma/catalogos/catalogo-de-fases.service';
import { CatalogoDeFatos } from '../../cronograma/catalogos/catalogo-de-fatos.service';
import type { FaseDoCronograma } from '../abas-do-formulario';
import { comAFaseEfetiva, faseEfetiva } from '../formularios-do-rascunho';
import { faseTemLugar, naFase } from '../obrigatoriedade-na-fase';

/**
 * Em que fase do cronograma cada formulário é respondido, e o que o cronograma permite acrescentar:
 * a fase escolhida enquanto tiver lugar para ele, ou a única que tem. A fase tem lugar para um
 * formulário obrigatório e um facultativo, e a API recusa um terceiro; enviar a fase nula apagaria
 * a gravada — a publicação recusa formulário sem fase.
 */
@Injectable()
export class FasesDosFormularios {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly consequencias = inject(CatalogoDasConsequenciasDeIndeferimento);
  private readonly catalogoDeDocumentos = inject(CatalogoDeDocumentos);
  private readonly catalogoDeFases = inject(CatalogoDeFases);
  private readonly catalogoDeFatos = inject(CatalogoDeFatos);

  private readonly formularios = computed(() => this.store.draft().formulario.formularios);
  private readonly cobraTaxa = computed(() => this.store.draft().pagamento.cobra === true);

  constructor() {
    // A tela, a identificação do formulário de inscrição e o envio leem a fase do rascunho: ela
    // passa a ser a que a aba mostra, quando a guardada deixou de existir e só resta uma opção.
    effect(() => {
      const alinhado = this.rascunhoNaFaseEfetiva();
      if (alinhado !== null) untracked(() => this.store.patchSection('formulario', alinhado));
    });
  }

  /** As fases do cronograma, com as marcas que dizem o que cada uma é. */
  readonly fasesDoCronograma = computed<readonly FaseDoCronograma[]>(() => {
    const fasePorId = this.catalogoDeFases.fasePorId();
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

  /** Os códigos das fases em que o candidato se inscreve. */
  readonly fasesDaInscricao = computed<ReadonlySet<string>>(
    () =>
      new Set(
        this.fasesDoCronograma()
          .filter((fase) => fase.coletaInscricao)
          .map((fase) => fase.codigo),
      ),
  );

  /** As fases que ainda têm lugar para o formulário, e a escolhida, por código. */
  readonly porFormulario = computed(
    () =>
      new Map(
        this.formularios().map((formulario) => {
          const opcoes = this.fasesDoCronograma().filter(
            (fase) =>
              fase.codigo === formulario.faseCodigo ||
              this.temLugar(fase, this.ocupantesSem(fase, formulario.codigo)),
          );
          return [
            formulario.codigo,
            { opcoes, escolhida: faseEfetiva(formulario.faseCodigo, opcoes) },
          ] as const;
        }),
      ),
  );

  /** O rascunho com a fase efetiva em cada formulário; nulo quando todos já a guardam. */
  private readonly rascunhoNaFaseEfetiva = computed(() =>
    comAFaseEfetiva(this.store.draft().formulario, this.porFormulario(), (formulario, outros) =>
      naFase(
        formulario,
        this.fasesDoCronograma().find((fase) => fase.codigo === formulario.faseCodigo),
        outros.filter((outro) => outro.faseCodigo === formulario.faseCodigo),
      ),
    ),
  );

  /** As fases em que o operador ainda pode acrescentar um formulário. */
  readonly fasesOferecidas = computed(() =>
    this.fasesDoCronograma().filter((fase) => this.temLugar(fase, this.ocupantesSem(fase, null))),
  );

  private ocupantesSem(fase: FaseDoCronograma, codigo: string | null) {
    return this.formularios().filter(
      (formulario) => formulario.faseCodigo === fase.codigo && formulario.codigo !== codigo,
    );
  }

  private temLugar(
    fase: FaseDoCronograma,
    ocupantes: readonly { readonly obrigatorio: boolean }[],
  ): boolean {
    return faseTemLugar(fase, ocupantes, this.cobraTaxa());
  }

  /** Como a lista de documentos do formulário nomeia o tipo de documento e lê o público de cada um. */
  readonly vocabularioDosDocumentos = computed(() => {
    const tipoPorId = this.catalogoDeDocumentos.tipoDocumentoPorId();
    return {
      consequencias: this.consequencias.consequencias(),
      fatoPorCodigo: fatosParaLerOGatilho(
        this.catalogoDeFatos.fatos(),
        this.store.draft().atendimento.condicoes.map((condicao) => condicao.codigo),
        this.store.modalidadesDoProcesso(),
      ),
      nomeDoTipo: (id: string, nomeGuardado: string | undefined) =>
        tipoPorId.get(id)?.nome ?? nomeGuardado ?? id,
    };
  });
}
