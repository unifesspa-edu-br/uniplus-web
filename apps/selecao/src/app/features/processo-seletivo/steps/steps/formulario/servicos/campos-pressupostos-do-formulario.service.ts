import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { FINALIDADE_INSCRICAO } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogosDoCronogramaService } from '../../cronograma/catalogos-do-cronograma.service';
import { comCamposQueAsExigenciasPressupoem } from '../campos-pressupostos-da-inscricao';
import { quemCitaNoProcesso, remocoesTravadasPor } from '../citantes-no-processo';
import { fatosColetadosPor } from '../formulario-do-processo';
import { fatosColetadosPelasOutras, formulariosDoRascunho } from '../formularios-por-finalidade';
import { CatalogosDoFormularioService } from './catalogos-do-formulario.service';

/**
 * Os campos que o processo pressupõe no formulário de inscrição: quem, no processo, cita cada fato,
 * e a reconciliação que põe no formulário o que é citado e tira o que nada cita mais.
 */
@Injectable()
export class CamposPressupostosDoFormularioService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly dados = inject(CatalogosDoFormularioService);

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
  readonly citantes = computed(() => {
    const draft = this.store.draft();
    const tipoDocumento = this.catalogos.tipoDocumentoPorId();
    const nomeDoFato = new Map(this.dados.catalogo().map((fato) => [fato.codigo, fato.nome]));
    return quemCitaNoProcesso(
      {
        documentos: draft.documentos,
        derivacao: draft.formulario.derivacao,
        desempate: draft.desempate,
        outrasFinalidades: draft.formulario.outrasFinalidades,
        modalidades: this.store.regrasDasModalidades(),
      },
      {
        documento: (id) => tipoDocumento.get(id)?.nome ?? id,
        fato: (codigo) => nomeDoFato.get(codigo) ?? codigo,
      },
    );
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
    const antes = new Set(fatosColetadosPor(formulario.conteudo));
    const reconciliado = comCamposQueAsExigenciasPressupoem(
      formulario.conteudo,
      new Set(this.citantes().keys()),
      this.dados.catalogo(),
      this.store.camposPostosPelasExigencias(),
      fatosColetadosPelasOutras(
        formulariosDoRascunho(this.store.draft().formulario),
        FINALIDADE_INSCRICAO,
      ),
    );
    if (reconciliado === formulario.conteudo) return [];

    // Registra o que ENTROU agora: é esse conjunto que a reconciliação seguinte pode remover
    // quando a exigência que o pediu deixar de existir.
    const acrescentados = fatosColetadosPor(reconciliado).filter((codigo) => !antes.has(codigo));
    if (acrescentados.length > 0) {
      this.store.camposPostosPelasExigencias.update(
        (atual) => new Set([...atual, ...acrescentados]),
      );
    }
    this.store.patchSection('formulario', { ...formulario, conteudo: reconciliado });
    return acrescentados;
  }
}
