import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ValorLegivelDirective } from '../valor-legivel/valor-legivel.directive';
import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import { AcrescentarNoFimComponent } from './editor/acrescentar-no-fim';
import { EtapaDoFormularioComponent } from './editor/etapa-do-formulario';
import { PressupostosDoFormularioComponent } from './editor/pressupostos-do-formulario';
import { idDaEtapa } from './ids';
import { LIMITES_DO_FORMULARIO } from './modelo/constantes';
import { contextoDoEditor } from './modelo/contexto-do-editor';
import { etapasEmOrdem } from './modelo/ordem-das-entradas';
import { type RecusasDoConteudo } from './modelo/recusas';
import {
  type ConteudoDoFormulario,
  type EtapaDoFormulario,
  type FatoDoFormulario,
  type TermoDisponivel,
} from './modelo/tipos';

/**
 * O editor de um formulário por finalidade (ADR-0136): etapas e blocos, os campos de cada seção,
 * quando cada um é obrigatório e exibido, e a ordem — com a recusa explicada do movimento que
 * poria uma condição antes do campo que ela cita. Serve ao modelo, na Configuração, e ao
 * formulário do processo, na Seleção.
 *
 * Não guarda o conteúdo: recebe e devolve o conteúdo inteiro a cada mudança. Edita também os
 * termos, os pressupostos, os grupos repetíveis, as restrições — inclusive as opções condicionadas
 * a respostas anteriores e as formadas por elas — e o impedimento de cada campo.
 *
 * Acessibilidade: cada etapa é uma região nomeada pelo título; mover, acrescentar e remover são
 * anunciados numa região de status visível, que também mostra a recusa; o foco volta ao botão
 * que moveu o campo, ou vai ao campo acrescentado.
 */
@Component({
  selector: 'ui-editor-de-formulario',
  standalone: true,
  imports: [ValorLegivelDirective, 
    PressupostosDoFormularioComponent,
    EtapaDoFormularioComponent,
    AcrescentarNoFimComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'editor-formulario' },
  template: `
    <div class="field">
      <label class="field__label" [for]="idBase() + '-titulo'">Título do formulário</label>
      <input
        class="input"
        type="text"
        [id]="idBase() + '-titulo'"
        [value]="conteudo().titulo ?? ''"
        [maxLength]="limites.tituloDoFormulario"
        [disabled]="disabled()"
        [attr.aria-describedby]="idBase() + '-titulo-nota'"
        (input)="trocarTitulo($event)"
      />
      <span class="field__hint" [id]="idBase() + '-titulo-nota'"
        >O que o candidato lê no topo do formulário.</span
      >
    </div>

    <p class="editor-formulario__anuncio" role="status" [class.is-vazio]="anuncio() === ''">
      {{ anuncio() }}
    </p>

    <ui-pressupostos-do-formulario
      [contexto]="contexto()"
      (conteudoChange)="emitir($event)"
      (anuncio)="anuncio.set($event)"
    />

    @for (etapa of etapas(); track etapa.codigo; let posicao = $index) {
      <ui-etapa-do-formulario
        [contexto]="contexto()"
        [etapa]="etapa"
        [posicao]="posicao + 1"
        [aberta]="etapaAberta(etapa)"
        (alternar)="alternarEtapa(etapa)"
        (conteudoChange)="emitir($event)"
        (anuncio)="anuncio.set($event)"
      />
    }

    @if (contexto().noTeto) {
      <p class="field__hint" [id]="idBase() + '-teto'">
        O formulário chegou a {{ limites.itens }} campos, contando os dados básicos: é o máximo.
      </p>
    }

    <ui-acrescentar-no-fim
      [contexto]="contexto()"
      (conteudoChange)="emitir($event)"
      (anuncio)="anuncio.set($event)"
    />
  `,
})
export class EditorDeFormularioComponent {
  private readonly injector = inject(Injector);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  /** As condições citam município só quando o hospedeiro provê a busca de onde sai o valor. */
  private readonly comMunicipios = inject(BUSCA_DE_MUNICIPIOS, { optional: true }) !== null;

  readonly conteudo = input.required<ConteudoDoFormulario>();
  /** O catálogo de fatos inteiro, desativados inclusive — os itens que já os usam precisam do nome. */
  readonly catalogo = input.required<readonly FatoDoFormulario[]>();
  /** A finalidade decide os blocos admitidos. */
  readonly finalidade = input.required<string>();
  /** Prefixo dos ids — único na tela. */
  readonly idBase = input<string>('formulario');
  readonly disabled = input<boolean>(false);
  /** As recusas da última gravação, já distribuídas por item e etapa. */
  readonly recusas = input<RecusasDoConteudo | null>(null);
  /** Os termos de consentimento que o formulário pode exigir, com as versões promovidas. */
  readonly termosDisponiveis = input<readonly TermoDisponivel[]>([]);
  /**
   * No processo, os fatos coletados pela inscrição: as outras finalidades os citam como conhecidos
   * antes, e a seção de pressupostos não aparece. Nulo no modelo, que declara os pressupostos.
   */
  readonly fatosDaInscricao = input<readonly string[] | null>(null);
  /** Os fatos coletados por outra finalidade: um fato tem um formulário só que o coleta. */
  readonly fatosIndisponiveis = input<readonly string[]>([]);
  /**
   * Os fatos deste formulário que uma regra de OUTRO formulário cita por negação ou com impedimento:
   * precisam ser obrigatórios aqui, e este editor não vê aquela regra (UNI-REQ-0074).
   */
  readonly fatosQueExigemRespostaPorFora = input<readonly string[]>([]);
  /** Os campos que não podem sair, com o motivo — uma exigência ou outra regra do processo os cita. */
  readonly remocoesTravadas = input<ReadonlyMap<string, string>>(new Map());

  readonly conteudoChange = output<ConteudoDoFormulario>();

  protected readonly limites = LIMITES_DO_FORMULARIO;
  protected readonly anuncio = signal('');
  /** As etapas que o usuário recolheu, pelo código — que acompanha a etapa quando ela é movida. */
  private readonly etapasRecolhidas = signal<ReadonlySet<string>>(new Set());

  protected readonly etapas = computed(() => etapasEmOrdem(this.conteudo()));
  protected readonly contexto = computed(() =>
    contextoDoEditor({
      conteudo: this.conteudo(),
      catalogo: this.catalogo(),
      finalidade: this.finalidade(),
      idBase: this.idBase(),
      disabled: this.disabled(),
      recusas: this.recusas(),
      termosDisponiveis: this.termosDisponiveis(),
      fatosDaInscricao: this.fatosDaInscricao(),
      fatosIndisponiveis: this.fatosIndisponiveis(),
      fatosQueExigemRespostaPorFora: this.fatosQueExigemRespostaPorFora(),
      remocoesTravadas: this.remocoesTravadas(),
      comMunicipios: this.comMunicipios,
    }),
  );

  protected emitir(conteudo: ConteudoDoFormulario): void {
    this.conteudoChange.emit(conteudo);
  }

  protected trocarTitulo(evento: Event): void {
    const titulo = (evento.target as HTMLInputElement).value;
    this.emitir({ ...this.conteudo(), titulo: titulo.trim() === '' ? null : titulo });
  }

  protected etapaAberta(etapa: Pick<EtapaDoFormulario, 'codigo'>): boolean {
    return !this.etapasRecolhidas().has(etapa.codigo);
  }

  protected alternarEtapa(etapa: Pick<EtapaDoFormulario, 'codigo'>): void {
    this.etapasRecolhidas.update((recolhidas) => {
      const proximas = new Set(recolhidas);
      if (!proximas.delete(etapa.codigo)) proximas.add(etapa.codigo);
      return proximas;
    });
  }

  /**
   * Leva o foco ao primeiro campo marcado como inválido, para quem tentou gravar saber por onde
   * começar. A seção recolhida que o guarda é aberta antes. Resolve para `true` só quando o foco
   * chegou ao campo; o desabilitado fica de fora, porque não recebe foco.
   */
  focarPrimeiroCampoInvalido(): Promise<boolean> {
    const campo = this.primeiroCampoInvalido();
    if (campo === null) return Promise.resolve(false);
    const corpo = campo.closest<HTMLElement>('.editor-formulario__corpo[hidden]');
    if (corpo === null) {
      campo.focus();
      return Promise.resolve(document.activeElement === campo);
    }
    const etapa = this.etapas().find(
      (candidata) => `${idDaEtapa(this.idBase(), candidata.codigo)}-corpo` === corpo.id,
    );
    if (etapa !== undefined) this.alternarEtapa(etapa);
    return new Promise((resolve) => {
      afterNextRender(
        () => {
          const aberto = this.primeiroCampoInvalido();
          aberto?.focus();
          resolve(aberto !== null && document.activeElement === aberto);
        },
        { injector: this.injector },
      );
    });
  }

  private primeiroCampoInvalido(): HTMLElement | null {
    return this.raiz.nativeElement.querySelector<HTMLElement>(
      '[aria-invalid="true"]:not(:disabled)',
    );
  }
}
