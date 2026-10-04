import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { map } from 'rxjs';
import { ModelosFormularioApi, type FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import {
  PreVisualizacaoDeFormulariosComponent,
  type AvaliacaoDeFormularios,
  type ConteudoDoFormulario,
  type FormularioParaSimular,
} from '@uniplus/shared-ui/components';

/**
 * A pré-visualização do modelo GRAVADO (UNI-REQ-0145): o administrador simula as respostas aos
 * campos do formulário e aos pressupostos e vê, por campo e por termo, o que o candidato veria.
 * A API do modelo não aceita ocorrências de grupo repetível nem devolve os grupos avaliados: a
 * simulação de grupos fica para o processo.
 */
@Component({
  selector: 'cfg-pre-visualizacao-do-modelo',
  standalone: true,
  imports: [PreVisualizacaoDeFormulariosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel cfg-pre-visualizacao" aria-labelledby="cfg-pre-visualizacao-titulo">
      <div class="panel-head">
        <div class="panel-head__title"><h2 id="cfg-pre-visualizacao-titulo">Pré-visualização</h2></div>
      </div>

      <ui-pre-visualizacao-de-formularios
        idBase="cfg"
        origem="A pré-visualização usa o modelo gravado."
        [formularios]="formularios()"
        [catalogo]="catalogo()"
        [avaliar]="avaliar"
        [desatualizado]="desatualizado()"
      />
    </section>
  `,
})
export class PreVisualizacaoDoModeloComponent {
  private readonly api = inject(ModelosFormularioApi);

  readonly modeloId = input.required<string>();
  /** O conteúdo gravado — o que a API avalia. */
  readonly conteudo = input.required<ConteudoDoFormulario>();
  readonly catalogo = input.required<readonly FatoCandidatoView[]>();
  /** Há alteração não salva: o resultado não refletiria o que está na tela. */
  readonly desatualizado = input<boolean>(false);

  /** O modelo é um formulário só; a finalidade não viaja, e a avaliação volta sem ela. */
  protected readonly formularios = computed<readonly FormularioParaSimular[]>(() => [
    { finalidade: MODELO, nome: 'modelo', conteudo: this.conteudo() },
  ]);

  protected readonly avaliar: AvaliacaoDeFormularios = (simulacao) =>
    this.api
      .preVisualizar(this.modeloId(), {
        respostas: simulacao.respostas,
        etapasConcluidas: simulacao.etapasConcluidas.map((concluida) => concluida.etapa),
        pressupostos: simulacao.pressupostos,
      })
      .pipe(map((resultado) => (resultado.ok ? { ...resultado, data: [{ finalidade: MODELO, ...resultado.data, grupos: [] }] } : resultado)));
}

const MODELO = 'MODELO';
