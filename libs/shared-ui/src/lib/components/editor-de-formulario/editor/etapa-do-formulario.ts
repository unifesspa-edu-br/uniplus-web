import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  output,
} from '@angular/core';

import { TagComponent } from '../../tag/tag';
import { aplicarEdicao } from '../edicao';
import { focarDepois } from '../foco';
import { idDaEtapa } from '../ids';
import { type ContextoDoEditor } from '../modelo/contexto-do-editor';
import {
  BLOCO_COMPROVACAO_DOCUMENTAL,
  BLOCO_MODALIDADES_CALCULADAS,
  BLOCO_REVISAO_E_ACEITE,
  SECAO_DADOS_BASICOS,
  TIPO_SECAO,
} from '../modelo/constantes';
import { entradasDaSecao, etapasEmOrdem } from '../modelo/ordem-das-entradas';
import { comEtapa, etapaFixa, moverEtapa, podeMoverEtapa, removerEtapa } from '../modelo/secoes';
import { type ConteudoDoFormulario, type EtapaDoFormulario } from '../modelo/tipos';
import { SecaoDoFormularioComponent } from '../secao-do-formulario';
import { AcrescentarNaSecaoComponent } from './acrescentar-na-secao';
import { EntradasDaSecaoComponent } from './entradas-da-secao';
import { TermosExigidosComponent } from './termos-exigidos';

const DESCRICAO_DO_BLOCO: Readonly<Record<string, string>> = {
  [BLOCO_COMPROVACAO_DOCUMENTAL]:
    'O candidato envia os documentos que o processo exige nesta fase.',
  [BLOCO_MODALIDADES_CALCULADAS]:
    'O candidato vê as modalidades a que concorre, calculadas das respostas dele.',
  [BLOCO_REVISAO_E_ACEITE]:
    'O candidato revisa as respostas e aceita os termos. Vem sempre por último.',
};

/**
 * Uma etapa do formulário — seção, bloco do sistema ou os dados básicos —: o título que abre e fecha
 * o corpo, as ações de mover e remover, e o que cada tipo mostra. Acessibilidade: a etapa é uma
 * região nomeada pelo título.
 */
@Component({
  selector: 'ui-etapa-do-formulario',
  standalone: true,
  imports: [
    TagComponent,
    SecaoDoFormularioComponent,
    EntradasDaSecaoComponent,
    AcrescentarNaSecaoComponent,
    TermosExigidosComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
    <section class="editor-formulario__etapa" [attr.aria-labelledby]="idDaSecao() + '-nome'">
      <div class="editor-formulario__cabecalho">
        <!-- O título abre e fecha a etapa: o formulário inteiro aberto é longo demais para achar a seção. -->
        <h3 class="editor-formulario__titulo-etapa" [id]="idDaSecao() + '-nome'">
          <button
            class="editor-formulario__alternar"
            type="button"
            [attr.aria-expanded]="aberta()"
            [attr.aria-controls]="idDaSecao() + '-corpo'"
            (click)="alternar.emit()"
          >
            <span class="editor-formulario__seta" aria-hidden="true"></span>
            <span>{{ posicao() }}. {{ etapa().titulo.trim() || 'Seção sem título' }}</span>
          </button>
        </h3>
        <ui-tag [variant]="ehSecao() ? 'neutral' : 'info'">
          {{ ehSecao() ? 'Seção' : 'Bloco do sistema' }}
        </ui-tag>
        @if (resumo(); as texto) {
          <span class="editor-formulario__resumo">{{ texto }}</span>
        }
        <!-- Na linha do título, como na fase do cronograma: com tudo recolhido, reordenar e remover são rápidos. -->
        @if (!fixa()) {
          <div
            class="editor-formulario__acoes-do-cabecalho"
            role="group"
            [attr.aria-label]="'Ações ' + daEtapa()"
          >
            <button
              class="btn btn--tertiary btn--sm"
              type="button"
              [id]="idDaSecao() + '-subir'"
              [disabled]="contexto().disabled || !podeMover(-1)"
              [attr.aria-label]="'Subir ' + nomeDaEtapa()"
              (click)="mover(-1)"
            >
              Subir
            </button>
            <button
              class="btn btn--tertiary btn--sm"
              type="button"
              [id]="idDaSecao() + '-descer'"
              [disabled]="contexto().disabled || !podeMover(1)"
              [attr.aria-label]="'Descer ' + nomeDaEtapa()"
              (click)="mover(1)"
            >
              Descer
            </button>
            <button
              class="btn btn--tertiary btn--sm"
              type="button"
              [disabled]="contexto().disabled"
              [attr.aria-label]="'Remover ' + nomeDaEtapa()"
              (click)="remover()"
            >
              Remover
            </button>
          </div>
        }
      </div>

      @if (erros().length > 0) {
        <ul class="editor-formulario__erros u-list">
          @for (erro of erros(); track $index) {
            <li class="field__error">{{ erro }}</li>
          }
        </ul>
      }

      <div class="editor-formulario__corpo" [id]="idDaSecao() + '-corpo'" [hidden]="!aberta()">
        @if (etapa().codigo === dadosBasicos) {
          <p class="field__hint">
            Os dados de identificação e contato que toda inscrição coleta. O sistema mantém esta
            seção, que não pode ser alterada.
          </p>
          <ol class="editor-formulario__basicos">
            @for (entrada of entradas(); track $index) {
              @if (entrada.tipo === 'item') {
                <li>{{ entrada.item.rotulo }}</li>
              }
            }
          </ol>
        } @else if (!ehSecao()) {
          <p class="field__hint">{{ descricaoDoBloco() }}</p>
          @if (etapa().bloco === revisaoEAceite) {
            <ui-termos-exigidos
              [contexto]="contexto()"
              (conteudoChange)="conteudoChange.emit($event)"
              (anuncio)="anuncio.emit($event)"
            />
          }
        } @else {
          <ui-secao-do-formulario
            [etapa]="etapa()"
            [fatos]="contexto().fatosDaSecao.get(etapa().codigo) ?? []"
            [idBase]="idDaSecao()"
            [disabled]="contexto().disabled"
            (etapaChange)="conteudoChange.emit(comEtapa(contexto().conteudo, $event))"
          />
          <ui-entradas-da-secao
            [contexto]="contexto()"
            [etapa]="etapa()"
            (conteudoChange)="conteudoChange.emit($event)"
            (anuncio)="anuncio.emit($event)"
          />
          <ui-acrescentar-na-secao
            [contexto]="contexto()"
            [etapa]="etapa()"
            (conteudoChange)="conteudoChange.emit($event)"
            (anuncio)="anuncio.emit($event)"
          />
        }
      </div>
    </section>
  `,
})
export class EtapaDoFormularioComponent {
  private readonly injector = inject(Injector);

  readonly contexto = input.required<ContextoDoEditor>();
  readonly etapa = input.required<EtapaDoFormulario>();
  /** A posição da etapa no formulário, a partir de um. */
  readonly posicao = input.required<number>();
  readonly aberta = input<boolean>(true);

  readonly conteudoChange = output<ConteudoDoFormulario>();
  readonly anuncio = output<string>();
  /** Pede para abrir ou fechar o corpo; quem guarda o que está aberto é o editor. */
  readonly alternar = output<void>();

  protected readonly dadosBasicos = SECAO_DADOS_BASICOS;
  protected readonly revisaoEAceite = BLOCO_REVISAO_E_ACEITE;
  protected readonly comEtapa = comEtapa;

  protected readonly idDaSecao = computed(() =>
    idDaEtapa(this.contexto().idBase, this.etapa().codigo),
  );
  protected readonly ehSecao = computed(() => this.etapa().tipo === TIPO_SECAO);
  protected readonly fixa = computed(() => etapaFixa(this.etapa()));
  protected readonly entradas = computed(() =>
    entradasDaSecao(this.contexto().conteudo, this.etapa().codigo),
  );
  protected readonly erros = computed(
    () => this.contexto().recusas?.porEtapa?.get(this.etapa().codigo) ?? [],
  );
  protected readonly descricaoDoBloco = computed(
    () => DESCRICAO_DO_BLOCO[this.etapa().bloco ?? ''] ?? '',
  );

  /** O que a etapa tem, para quem a vê recolhida; bloco do sistema não tem campos a contar. */
  protected readonly resumo = computed(() => {
    if (!this.ehSecao()) return '';
    const campos = this.entradas().filter((entrada) => entrada.tipo === 'item').length;
    const grupos = this.entradas().length - campos;
    const partes = [campos === 1 ? '1 campo' : `${campos} campos`];
    if (grupos > 0) partes.push(grupos === 1 ? '1 grupo repetível' : `${grupos} grupos repetíveis`);
    return partes.join(' · ');
  });

  /** Como a tela chama a etapa: seção ou bloco do sistema — "etapa" é termo do cronograma do processo. */
  protected nomeDaEtapa(): string {
    const titulo = this.etapa().titulo.trim() || 'sem título';
    return this.ehSecao() ? `a seção ${titulo}` : `o bloco ${titulo}`;
  }

  protected daEtapa(): string {
    const titulo = this.etapa().titulo.trim() || 'sem título';
    return this.ehSecao() ? `da seção ${titulo}` : `do bloco ${titulo}`;
  }

  protected podeMover(direcao: -1 | 1): boolean {
    return podeMoverEtapa(this.contexto().conteudo, this.etapa().codigo, direcao);
  }

  protected mover(direcao: -1 | 1): void {
    const { conteudo, nomes, idBase } = this.contexto();
    const etapa = this.etapa();
    aplicarEdicao(moverEtapa(conteudo, etapa.codigo, direcao, nomes), this, (editado) => {
      const etapas = etapasEmOrdem(editado);
      const posicao = etapas.findIndex((e) => e.codigo === etapa.codigo) + 1;
      this.anuncio.emit(`“${etapa.titulo}” foi para a posição ${posicao} de ${etapas.length}.`);
      const prefixo = idDaEtapa(idBase, etapa.codigo);
      const [mesmo, oposto] = direcao < 0 ? ['subir', 'descer'] : ['descer', 'subir'];
      focarDepois(this.injector, `${prefixo}-${mesmo}`, `${prefixo}-${oposto}`);
    });
  }

  protected remover(): void {
    const etapa = this.etapa();
    aplicarEdicao(removerEtapa(this.contexto().conteudo, etapa.codigo), this, () => {
      this.anuncio.emit(`${etapa.titulo} removida.`);
      focarDepois(this.injector, `${this.contexto().idBase}-titulo`);
    });
  }
}
