import { computed, inject, Injectable } from '@angular/core';

import type { ValidacaoDoPasso } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { gruposSemNormaResolvida } from '../../../shared/exigencias/consulta-das-exigencias';
import { CatalogoDeAtos } from '../catalogos/catalogo-de-atos.service';
import { CatalogoDeBancas } from '../catalogos/catalogo-de-bancas.service';
import { CatalogoDeDocumentos } from '../catalogos/catalogo-de-documentos.service';
import { CatalogoDeFases } from '../catalogos/catalogo-de-fases.service';
import { CatalogoDeFatos } from '../catalogos/catalogo-de-fatos.service';
import { CatalogoDeTiposDeEtapa } from '../catalogos/catalogo-de-tipos-de-etapa.service';
import { avisosDosGrupos, type GrupoDeclarado } from '../conferencia-das-exigencias-declaradas';
import { problemasDoCronograma } from '../cronograma-do-certame';
import { faseDoFormulario } from '../cronograma-form';
import { exigenciasDeclaradas, type CatalogosDasExigencias } from './exigencias-declaradas';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';
import { AGUARDA_RELEITURA, ReleituraDasEtapas } from './releitura-das-etapas.service';

/** O que impede o passo de gravar, e o que apenas merece aviso. */
@Injectable()
export class ConferenciaDoCronograma {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogoDeAtos = inject(CatalogoDeAtos);
  private readonly catalogoDeBancas = inject(CatalogoDeBancas);
  private readonly catalogoDeDocumentos = inject(CatalogoDeDocumentos);
  private readonly catalogoDeFases = inject(CatalogoDeFases);
  private readonly catalogoDeFatos = inject(CatalogoDeFatos);
  private readonly catalogoDeTiposDeEtapa = inject(CatalogoDeTiposDeEtapa);
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly releituraDasEtapas = inject(ReleituraDasEtapas);

  /**
   * Os grupos de exigências que o rascunho carrega. A tela não os edita — eles chegam da
   * configuração do processo —, mas a publicação cobra deles a norma quando decidem o
   * resultado, e é melhor dizer isso aqui do que no último passo.
   */
  private readonly gruposDeclarados = computed<readonly GrupoDeclarado[]>(() => {
    const nomePorId = new Map(this.catalogoDeDocumentos.tiposDocumento().map((tipo) => [tipo.id, tipo.nome]));

    return gruposSemNormaResolvida(this.store.draft().documentos).map((grupo) => ({
      decideResultado: true,
      normaResolvida: false,
      documentos: grupo.documentos.map((id) => nomePorId.get(id) ?? id),
    }));
  });

  private readonly catalogosDasExigencias: CatalogosDasExigencias = {
    tiposDocumento: this.catalogoDeDocumentos.tiposDocumento,
    fatos: this.catalogoDeFatos.fatos,
    fasePorId: this.catalogoDeFases.fasePorId,
    nomeDaFase: this.catalogoDeFases.nomeDaFase,
  };

  private readonly exigenciasDeclaradas = computed(() =>
    exigenciasDeclaradas(
      this.cronograma.fases.controls.map(faseDoFormulario),
      this.store,
      this.catalogosDasExigencias,
    ),
  );

  /** O que impede a gravação, como a validação do passo o relata. */
  readonly problemas = computed(() => {
    this.cronograma.versao();
    return problemasDoCronograma({
      fases: this.cronograma.fases.controls.map(faseDoFormulario),
      etapas: this.cronograma.etapasParaEnvio(),
      exigencias: this.exigenciasDeclaradas(),
      catalogos: {
        fasePorId: this.catalogoDeFases.fasePorId(),
        precedencias: this.catalogoDeFases.precedencias(),
        atoPorCodigo: this.catalogoDeAtos.atoPorCodigo(),
        nomeDaBanca: (tipoBancaId) =>
          this.catalogoDeBancas.bancaPorId().get(tipoBancaId)?.nome ?? tipoBancaId,
        tipoDaEtapa: (tipoEtapaOrigemId) =>
          this.catalogoDeTiposDeEtapa.tipoEtapaPorId().get(tipoEtapaOrigemId),
      },
    });
  });

  /**
   * O que a publicação vai cobrar dos grupos, dito como aviso: eles não se editam aqui, e
   * bloquear a gravação por causa deles prenderia o passo sem saída.
   */
  readonly avisosDeGrupo = computed(() => avisosDosGrupos(this.gruposDeclarados()));

  /**
   * A conferência do passo, que também é o que a gravação consulta antes de
   * enviar qualquer coisa: recusar aqui é o que impede a segunda gravação de
   * recriar etapas que já existem, e é o que impede a revisão final de declarar
   * íntegro um cronograma que o servidor ainda não confirmou.
   */
  validar(): ValidacaoDoPasso {
    if (this.releituraDasEtapas.releituraPendente()) {
      return { valid: false, messages: [AGUARDA_RELEITURA] };
    }

    const problemas = this.problemas();
    return problemas.length === 0 ? { valid: true } : { valid: false, messages: [...problemas] };
  }
}
