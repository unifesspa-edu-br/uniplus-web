import { comEscopoPeloCodigo } from '@uniplus/shared-data/configuracao';
import { computed, effect, inject, Injectable, untracked } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogoDeDocumentos } from '../../cronograma/catalogos/catalogo-de-documentos.service';
import {
  comCamposQueAsExigenciasPressupoem,
  type PressupostosDoProcesso,
} from '../campos-pressupostos-da-inscricao';
import {
  citantesDoRascunho,
  quemCitaNoProcesso,
  remocoesTravadasPor,
  type NomesDosCitantes,
} from '../citantes-no-processo';
import { fatosAcrescentados } from '../formulario-do-processo';
import {
  comFormulario,
  fatosColetadosPelasOutras,
  formularioDaInscricao,
} from '../formularios-do-rascunho';
import { CatalogosDoFormulario } from './catalogos-do-formulario.service';
import { FasesDosFormularios } from './fases-dos-formularios.service';

/**
 * Os campos que o processo pressupõe no formulário de inscrição: quem, no processo, cita cada fato,
 * e a reconciliação que põe no formulário o que é citado e tira o que nada cita mais.
 */
@Injectable()
export class CamposPressupostosDoFormulario {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogoDeDocumentos = inject(CatalogoDeDocumentos);
  private readonly dados = inject(CatalogosDoFormulario);
  private readonly fases = inject(FasesDosFormularios);

  constructor() {
    // Reconcilia a cada mudança do que cita fatos no processo, e não só quando o catálogo
    // responde. Os passos do wizard ficam todos montados, então "abrir o passo" não executa nada:
    // sem este efeito, o campo que um gatilho trouxe sobrevivia à remoção desse gatilho pelo resto
    // da sessão — inclusive o que o passo do cronograma acrescenta, já que aquele caminho só
    // acrescenta. Sobra dado pessoal no formulário sem nada que o justifique.
    effect(() => {
      this.citantes();
      if (this.dados.catalogo().length > 0) untracked(() => this.reconciliar());
    });
  }

  /** Quem, no processo, cita cada fato — a fonte única do que entra sozinho e do que não sai. */
  readonly citantes = computed(() =>
    quemCitaNoProcesso(
      citantesDoRascunho(
        this.store.draft(),
        this.store.regrasDasModalidades(),
        this.fases.fasesDaInscricao(),
      ),
      this.nomesDosCitantes(),
    ),
  );

  private readonly nomesDosCitantes = computed<NomesDosCitantes>(() => {
    const tipos = this.catalogoDeDocumentos.tipoDocumentoPorId();
    const fatos = new Map(this.dados.catalogo().map((fato) => [fato.codigo, fato.nome]));
    return {
      documento: (id) => tipos.get(id)?.nome ?? id,
      fato: (codigo) => fatos.get(codigo) ?? codigo,
    };
  });

  readonly remocoesTravadas = computed(() => remocoesTravadasPor(this.citantes()));

  /**
   * Põe no formulário de inscrição o que o processo pressupõe e tira o que nada cita mais. Roda a
   * cada mudança das exigências, da derivação, do desempate e dos formulários das outras
   * finalidades: são declarados noutros lugares, e o operador não deveria precisar lembrar que
   * mudá-los mexe aqui.
   */
  reconciliar(): readonly string[] {
    const formulario = this.store.draft().formulario;
    const inscricao = formularioDaInscricao(formulario, this.fases.fasesDaInscricao());
    if (inscricao === null) return [];
    const pressupostos = this.pressupostosDoRascunho(inscricao.codigo);
    const reconciliado = comCamposQueAsExigenciasPressupoem(inscricao.conteudo, pressupostos);
    if (reconciliado === inscricao.conteudo) return [];
    const acrescentados = fatosAcrescentados(inscricao.conteudo, reconciliado);
    this.registrarAcrescentados(acrescentados);
    const atualizado = { ...inscricao, conteudo: reconciliado };
    this.store.patchSection('formulario', comFormulario(formulario, atualizado));
    return acrescentados;
  }

  private registrarAcrescentados(acrescentados: readonly string[]): void {
    if (acrescentados.length === 0) return;
    this.store.camposPostosPelasExigencias.update((atual) => atual.comOsQueEntraram(acrescentados));
  }

  private pressupostosDoRascunho(codigoDaInscricao: string): PressupostosDoProcesso {
    const rascunho = this.store.draft();
    return {
      citados: new Set(this.citantes().keys()),
      catalogo: comEscopoPeloCodigo(this.dados.catalogo()),
      postosPelasExigencias: this.store.camposPostosPelasExigencias(),
      fatosDeOutrosFormularios: fatosColetadosPelasOutras(
        rascunho.formulario.formularios,
        codigoDaInscricao,
      ),
    };
  }
}
