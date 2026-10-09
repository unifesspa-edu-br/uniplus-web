import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { fatosEscolhiveis, nomesDoCatalogo, type FatoEscolhivel } from '../editor-de-condicoes/condicoes-de-fatos';
import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import { TagComponent } from '../tag/tag';
import {
  BLOCO_COMPROVACAO_DOCUMENTAL,
  BLOCO_MODALIDADES_CALCULADAS,
  BLOCO_REVISAO_E_ACEITE,
  LIMITES_DO_FORMULARIO,
  SECAO_DADOS_BASICOS,
  TIPO_SECAO,
  FINALIDADE_INSCRICAO,
  acrescentarBloco,
  acrescentarPressuposto,
  acrescentarTermo,
  comTermo,
  fatosCitaveisPelosTermos,
  moverTermo,
  pressupostosParaAcrescentar,
  removerPressuposto,
  removerTermo,
  termosEmOrdem,
  termosParaAcrescentar,
  ESCOPO_CANDIDATO,
  comFatosConhecidosAntes,
  motivoDaRemocaoTravadaDoGrupo,
  fatosDeMembroParaAcrescentar,
  acrescentarCampo,
  acrescentarGrupo,
  comGrupo,
  moverEntrada,
  podeMoverEntrada,
  removerGrupo,
  fatosOferecidos,
  fontesDasOpcoes,
  impedimentoCabe,
  predicadosSobreRespostasAnteriores,
  quantidadeNoTeto,
  ufsAnteriores,
  acrescentarSecao,
  blocosAdmitidos,
  comEtapa,
  comItem,
  entradasDaSecao,
  etapaFixa,
  etapasEmOrdem,
  fatosCitaveisPelaSecao,
  fatosCitaveisPeloItem,
  fatosParaAcrescentar,
  fatosQueExigemResposta,
  moverEtapa,
  moverItem,
  podeMoverEtapa,
  podeMoverItem,
  removerEtapa,
  removerItem,
  type ConteudoDoFormulario,
  type EtapaDoFormulario,
  type FatoDoFormulario,
  type ItemDoFormulario,
  type PredicadoNoWire,
  type RecusaDaRestricao,
  type RecusasDoConteudo,
  type ResultadoDaEdicao,
  type TermoDisponivel,
} from './formulario-editavel';
import { focarDepois } from './foco';
import { GrupoDoFormularioComponent } from './grupo-do-formulario';
import { ItemDoFormularioComponent } from './item-do-formulario';
import { SecaoDoFormularioComponent } from './secao-do-formulario';
import { TermoDoFormularioComponent } from './termo-do-formulario';
import { ValorLegivelDirective } from '../valor-legivel/valor-legivel.directive';

const DESCRICAO_DO_BLOCO: Readonly<Record<string, string>> = {
  [BLOCO_COMPROVACAO_DOCUMENTAL]: 'O candidato envia os documentos que o processo exige nesta fase.',
  [BLOCO_MODALIDADES_CALCULADAS]: 'O candidato vê as modalidades a que concorre, calculadas das respostas dele.',
  [BLOCO_REVISAO_E_ACEITE]: 'O candidato revisa as respostas e aceita os termos. Vem sempre por último.',
};

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
  imports: [ValorLegivelDirective, GrupoDoFormularioComponent, ItemDoFormularioComponent, SecaoDoFormularioComponent, TagComponent, TermoDoFormularioComponent],
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
      <span class="field__hint" [id]="idBase() + '-titulo-nota'">O que o candidato lê no topo do formulário.</span>
    </div>

    <p class="editor-formulario__anuncio" role="status" [class.is-vazio]="anuncio() === ''">{{ anuncio() }}</p>

    @if (temPressupostos()) {
      <section class="editor-formulario__etapa" [attr.aria-labelledby]="idBase() + '-pressupostos'">
        <h3 class="editor-formulario__titulo-etapa" [id]="idBase() + '-pressupostos'">Fatos pressupostos</h3>
        <p class="field__hint">
          Fatos que o candidato já respondeu num formulário anterior, como o de inscrição. As regras deste
          formulário podem citá-los como se tivessem sido respondidos antes de tudo.
        </p>
        @if ((conteudo().pressupostos ?? []).length > 0) {
          <ul class="editor-formulario__basicos">
            @for (fato of conteudo().pressupostos ?? []; track fato) {
              <li>
                {{ nomeDoFato(fato) }}
                <button
                  class="btn btn--tertiary btn--sm"
                  type="button"
                  [disabled]="disabled()"
                  [attr.aria-label]="'Retirar o pressuposto ' + nomeDoFato(fato)"
                  (click)="retirarPressuposto(fato)"
                >
                  Retirar
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="field__hint">Nenhum fato pressuposto.</p>
        }
        <div class="editor-formulario__acrescentar">
          <div class="field">
            <label class="field__label" [for]="idBase() + '-pressuposto'">Fato a pressupor</label>
            <select
              class="select"
              [id]="idBase() + '-pressuposto'"
              [disabled]="disabled() || pressupostosPossiveis().length === 0"
              (change)="escolher(chavePressuposto, $event)"
            >
              <option value="" [selected]="escolhaDePressuposto() === ''">Escolha o fato do candidato</option>
              @for (fato of pressupostosPossiveis(); track fato.codigo) {
                <option [value]="fato.codigo" [selected]="escolhaDePressuposto() === fato.codigo">{{ fato.nome }}</option>
              }
            </select>
          </div>
          <button
            class="btn btn--secondary btn--sm"
            type="button"
            [disabled]="disabled() || escolhaDePressuposto() === ''"
            (click)="acrescentarOPressuposto()"
          >
            <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar pressuposto
          </button>
        </div>
      </section>
    }

    @for (etapa of etapas(); track etapa.codigo; let posicaoDaEtapa = $index) {
      <section class="editor-formulario__etapa" [attr.aria-labelledby]="idDaEtapa(etapa) + '-nome'">
        <div class="editor-formulario__cabecalho">
          <!-- O título abre e fecha a etapa: o formulário inteiro aberto é longo demais para achar a seção. -->
          <h3 class="editor-formulario__titulo-etapa" [id]="idDaEtapa(etapa) + '-nome'">
            <button
              class="editor-formulario__alternar"
              type="button"
              [attr.aria-expanded]="etapaAberta(etapa)"
              [attr.aria-controls]="idDaEtapa(etapa) + '-corpo'"
              (click)="alternarEtapa(etapa)"
            >
              <span class="editor-formulario__seta" aria-hidden="true"></span>
              <span>{{ posicaoDaEtapa + 1 }}. {{ etapa.titulo.trim() || 'Seção sem título' }}</span>
            </button>
          </h3>
          <ui-tag [variant]="etapa.tipo === secao ? 'neutral' : 'info'">
            {{ etapa.tipo === secao ? 'Seção' : 'Bloco do sistema' }}
          </ui-tag>
          @if (resumoDaEtapa(etapa); as resumo) {
            <span class="editor-formulario__resumo">{{ resumo }}</span>
          }
          <!-- Na linha do título, como na fase do cronograma: com tudo recolhido, reordenar e remover são rápidos. -->
          @if (!fixa(etapa)) {
            <div class="editor-formulario__acoes-do-cabecalho" role="group" [attr.aria-label]="'Ações ' + daEtapa(etapa)">
              <button
                class="btn btn--tertiary btn--sm"
                type="button"
                [id]="idDaEtapa(etapa) + '-subir'"
                [disabled]="disabled() || !podeMoverEtapa(conteudo(), etapa.codigo, -1)"
                [attr.aria-label]="'Subir ' + nomeDaEtapa(etapa)"
                (click)="moverAEtapa(etapa, -1)"
              >
                Subir
              </button>
              <button
                class="btn btn--tertiary btn--sm"
                type="button"
                [id]="idDaEtapa(etapa) + '-descer'"
                [disabled]="disabled() || !podeMoverEtapa(conteudo(), etapa.codigo, 1)"
                [attr.aria-label]="'Descer ' + nomeDaEtapa(etapa)"
                (click)="moverAEtapa(etapa, 1)"
              >
                Descer
              </button>
              <button
                class="btn btn--tertiary btn--sm"
                type="button"
                [disabled]="disabled()"
                [attr.aria-label]="'Remover ' + nomeDaEtapa(etapa)"
                (click)="removerAEtapa(etapa)"
              >
                Remover
              </button>
            </div>
          }
        </div>

        @if (errosDaEtapa(etapa.codigo); as erros) {
          @if (erros.length > 0) {
            <ul class="editor-formulario__erros">
              @for (erro of erros; track $index) {
                <li class="field__error">{{ erro }}</li>
              }
            </ul>
          }
        }

        <div class="editor-formulario__corpo" [id]="idDaEtapa(etapa) + '-corpo'" [hidden]="!etapaAberta(etapa)">
          @if (etapa.codigo === dadosBasicos) {
            <p class="field__hint">
              Os dados de identificação e contato que toda inscrição coleta. O sistema mantém esta seção, que
              não pode ser alterada.
            </p>
            <ol class="editor-formulario__basicos">
              @for (entrada of entradasDe(etapa); track $index) {
                @if (entrada.tipo === 'item') {
                  <li>{{ entrada.item.rotulo }}</li>
                }
              }
            </ol>
          } @else if (etapa.tipo !== secao) {
            <p class="field__hint">{{ descricaoDoBloco(etapa) }}</p>
            @if (etapa.bloco === revisaoEAceite) {
              <h4 class="editor-formulario__titulo-item">Termos de consentimento exigidos</h4>
              @if (termos().length > 0) {
                <ol class="editor-formulario__itens" aria-label="Termos exigidos">
                  @for (termo of termos(); track termo.codigo; let posicao = $index) {
                    <li>
                      <ui-termo-do-formulario
                        [termo]="termo"
                        [disponivel]="termoDisponivel(termo.termoId)"
                        [posicao]="posicao + 1"
                        [fatos]="fatosDosTermos()"
                        [idBase]="idDoTermo(termo.codigo)"
                        [podeSubir]="posicao > 0"
                        [podeDescer]="posicao < termos().length - 1"
                        [disabled]="disabled()"
                        [erros]="errosDoTermo(termo.codigo)"
                        (termoChange)="emitir(comTermo(conteudo(), $event))"
                        (mover)="moverOTermo(termo.codigo, $event)"
                        (remover)="removerOTermo(termo.codigo)"
                      />
                    </li>
                  }
                </ol>
              } @else {
                <p class="field__hint">Nenhum termo exigido.</p>
              }
              <div class="editor-formulario__acrescentar">
                <div class="field">
                  <label class="field__label" [for]="idBase() + '-termo'">Termo a exigir</label>
                  <select
                    class="select"
                    [id]="idBase() + '-termo'"
                    [disabled]="disabled() || termosPossiveis().length === 0"
                    [attr.aria-describedby]="idBase() + '-termo-nota'"
                    (change)="escolher(chaveTermo, $event)"
                  >
                    <option value="" [selected]="escolhaDeTermo() === ''">Escolha o termo de consentimento</option>
                    @for (termo of termosPossiveis(); track termo.termoId) {
                      <option [value]="termo.termoId" [selected]="escolhaDeTermo() === termo.termoId">{{ termo.nome }}</option>
                    }
                  </select>
                </div>
                <button
                  class="btn btn--secondary btn--sm"
                  type="button"
                  [disabled]="disabled() || escolhaDeTermo() === ''"
                  (click)="acrescentarOTermo()"
                >
                  <i class="pi pi-plus" aria-hidden="true"></i> Exigir termo
                </button>
              </div>
              <span class="field__hint" [id]="idBase() + '-termo-nota'">Só termos com versão promovida podem ser exigidos.</span>
            }
          } @else {
            <ui-secao-do-formulario
              [etapa]="etapa"
              [fatos]="fatosDaSecao().get(etapa.codigo) ?? []"
              [idBase]="idDaEtapa(etapa)"
              [disabled]="disabled()"
              (etapaChange)="emitir(comEtapa(conteudo(), $event))"
            />

            @if (entradasDe(etapa); as entradas) {
              @if (entradas.length > 0) {
                <ol class="editor-formulario__itens" [attr.aria-label]="'Campos de ' + etapa.titulo">
                  @for (entrada of entradas; track chaveDa(entrada); let posicao = $index) {
                    <li>
                      @if (entrada.tipo === 'item') {
                        <ui-item-do-formulario
                          [item]="entrada.item"
                          [posicao]="posicao + 1"
                          [fatos]="fatosDoItem().get(entrada.item.fatoCodigo) ?? []"
                          [idBase]="idDoItem(entrada.item)"
                          [exigeResposta]="exigemResposta().has(entrada.item.fatoCodigo)"
                          [fatoDesativado]="desativados().has(entrada.item.fatoCodigo)"
                          [podeSubir]="podeMoverItem(conteudo(), entrada.item.fatoCodigo, -1)"
                          [podeDescer]="podeMoverItem(conteudo(), entrada.item.fatoCodigo, 1)"
                          [disabled]="disabled()"
                          [erros]="errosDoItem(entrada.item.fatoCodigo)"
                          [remocaoTravadaPor]="remocoesTravadas().get(entrada.item.fatoCodigo) ?? null"
                          [valoresConhecidos]="regrasProprias().get(entrada.item.fatoCodigo)?.valoresConhecidos ?? []"
                          [ufs]="regrasProprias().get(entrada.item.fatoCodigo)?.ufs ?? []"
                          [fontesDeOpcoes]="regrasProprias().get(entrada.item.fatoCodigo)?.fontesDeOpcoes ?? []"
                          [recusasDasRestricoes]="recusas()?.porRestricao?.get(entrada.item.fatoCodigo) ?? []"
                          [impedimentoPermitido]="regrasProprias().get(entrada.item.fatoCodigo)?.impedimentoPermitido ?? false"
                          [fatosDoImpedimento]="regrasProprias().get(entrada.item.fatoCodigo)?.fatosDoImpedimento ?? []"
                          (itemChange)="emitir(comItem(conteudo(), $event))"
                          (mover)="moverOItem(entrada.item, $event, etapa)"
                          (remover)="removerOItem(entrada.item, etapa)"
                        />
                      } @else {
                        <ui-grupo-do-formulario
                          [grupo]="entrada.grupo"
                          [conteudo]="conteudoParaCitacoes()"
                          [catalogo]="catalogo()"
                          [remocoesTravadas]="remocoesTravadas()"
                          [fatosIndisponiveis]="naoColetaveisAqui()"
                          [posicao]="posicao + 1"
                          [idBase]="idDoGrupo(entrada.grupo.codigo)"
                          [exigemResposta]="exigemResposta()"
                          [podeSubir]="podeMoverEntrada(conteudo(), { tipo: 'grupo', codigo: entrada.grupo.codigo }, -1)"
                          [podeDescer]="podeMoverEntrada(conteudo(), { tipo: 'grupo', codigo: entrada.grupo.codigo }, 1)"
                          [disabled]="disabled()"
                          [erros]="errosDoGrupo(entrada.grupo.codigo)"
                          [errosPorCampo]="recusas()?.porItem ?? semRecusas"
                          [recusasDasRestricoes]="recusas()?.porRestricao ?? semRecusasDeRestricao"
                          (grupoChange)="emitir(comGrupo(conteudo(), $event))"
                          (anuncio)="anuncio.set($event)"
                          (mover)="moverOGrupo(entrada.grupo.codigo, entrada.grupo.rotulo, $event, etapa)"
                          (remover)="removerOGrupo(entrada.grupo.codigo, entrada.grupo.rotulo, etapa)"
                        />
                      }
                    </li>
                  }
                </ol>
              } @else {
                <p class="field__hint">Nenhum campo nesta seção.</p>
              }
            }

            <div class="editor-formulario__acrescentar">
              <div class="field">
                <label class="field__label" [for]="idDaEtapa(etapa) + '-acrescentar'">Campo a acrescentar</label>
                <select
                  class="select"
                  [id]="idDaEtapa(etapa) + '-acrescentar'"
                  [disabled]="disabled() || noTeto() || paraAcrescentar().length === 0"
                  [attr.aria-describedby]="noTeto() ? idBase() + '-teto' : null"
                  (change)="escolher(etapa.codigo, $event)"
                >
                  <option value="" [selected]="escolhaDe(etapa.codigo) === ''">Escolha o fato do candidato</option>
                  @for (fato of paraAcrescentar(); track fato.codigo) {
                    <option [value]="fato.codigo" [selected]="escolhaDe(etapa.codigo) === fato.codigo">{{ fato.nome }}</option>
                  }
                </select>
              </div>
              <button
                class="btn btn--secondary btn--sm"
                type="button"
                [disabled]="disabled() || noTeto() || escolhaDe(etapa.codigo) === ''"
                (click)="acrescentarOItem(etapa)"
              >
                <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar campo
              </button>
            </div>

            @if (fatosDeMembro().length > 0) {
              <div class="editor-formulario__acrescentar">
                <div class="field">
                  <label class="field__label" [for]="idDaEtapa(etapa) + '-grupo-rotulo'">Rótulo do grupo repetível</label>
                  <input
                    class="input"
                    type="text"
                    [id]="idDaEtapa(etapa) + '-grupo-rotulo'"
                    [value]="escolhaLivre('#grupo-rotulo:' + etapa.codigo)"
                    [maxLength]="limites.rotulo"
                    [disabled]="disabled()"
                    (input)="escolher('#grupo-rotulo:' + etapa.codigo, $event)"
                  />
                </div>
                <div class="field">
                  <label class="field__label" [for]="idDaEtapa(etapa) + '-grupo-campo'">Primeiro campo de cada ocorrência</label>
                  <select class="select" [id]="idDaEtapa(etapa) + '-grupo-campo'" [disabled]="disabled()" (change)="escolher('#grupo-campo:' + etapa.codigo, $event)">
                    <option value="" [selected]="escolhaDeMembro(etapa.codigo) === ''">Escolha o fato do membro</option>
                    @for (fato of fatosDeMembro(); track fato.codigo) {
                      <option [value]="fato.codigo" [selected]="escolhaDeMembro(etapa.codigo) === fato.codigo">{{ fato.nome }}</option>
                    }
                  </select>
                </div>
                <button
                  class="btn btn--secondary btn--sm"
                  type="button"
                  [disabled]="disabled() || escolhaLivre('#grupo-rotulo:' + etapa.codigo).trim() === '' || escolhaDeMembro(etapa.codigo) === ''"
                  (click)="acrescentarOGrupo(etapa)"
                >
                  <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar grupo repetível
                </button>
              </div>
            }
          }
        </div>

      </section>
    }

    @if (noTeto()) {
      <p class="field__hint" [id]="idBase() + '-teto'">
        O formulário chegou a {{ limites.itens }} campos, contando os dados básicos: é o máximo.
      </p>
    }

    <div class="editor-formulario__acrescentar">
      <button class="btn btn--secondary btn--sm" type="button" [disabled]="disabled()" (click)="acrescentarASecao()">
        <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar seção
      </button>
      @for (bloco of blocosParaAcrescentar(); track bloco.valor) {
        <button class="btn btn--tertiary btn--sm" type="button" [disabled]="disabled()" (click)="acrescentarOBloco(bloco.valor)">
          <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar bloco “{{ bloco.rotulo }}”
        </button>
      }
    </div>
  `,
})
export class EditorDeFormularioComponent {
  private readonly injector = inject(Injector);
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
  protected readonly secao = TIPO_SECAO;
  protected readonly dadosBasicos = SECAO_DADOS_BASICOS;
  protected readonly comItem = comItem;
  protected readonly comEtapa = comEtapa;
  protected readonly podeMoverItem = podeMoverItem;
  protected readonly podeMoverEtapa = podeMoverEtapa;
  protected readonly fixa = etapaFixa;

  protected readonly anuncio = signal('');
  /** As etapas que o usuário recolheu, pelo código — que acompanha a etapa quando ela é movida. */
  private readonly etapasRecolhidas = signal<ReadonlySet<string>>(new Set());
  private readonly escolhas = signal<ReadonlyMap<string, string>>(new Map());
  // As escolhas dos combos fora das seções, com chaves que não colidem com código de etapa.
  protected readonly chaveTermo = '#termo';
  protected readonly chavePressuposto = '#pressuposto';
  protected readonly revisaoEAceite = BLOCO_REVISAO_E_ACEITE;
  protected readonly comTermo = comTermo;

  protected readonly etapas = computed(() => etapasEmOrdem(this.conteudo()));
  private readonly nomes = computed(() => nomesDoCatalogo(this.catalogo()));
  protected readonly paraAcrescentar = computed(() =>
    fatosParaAcrescentar(this.conteudo(), this.catalogo(), ESCOPO_CANDIDATO, this.naoColetaveisAqui()),
  );
  /** O conteúdo para as citações: com os fatos da inscrição conhecidos antes de tudo, que nunca são gravados. */
  protected readonly conteudoParaCitacoes = computed(() =>
    // Na própria inscrição os fatos dela têm posição: torná-los conhecidos antes deixaria um campo citar outro que vem depois.
    this.finalidade() === FINALIDADE_INSCRICAO ? this.conteudo() : comFatosConhecidosAntes(this.conteudo(), this.fatosDaInscricaoCitaveis()),
  );
  /**
   * O que este formulário não pode coletar: o que outra finalidade coleta e, fora da inscrição,
   * TODO fato da inscrição — o de membro inclusive, que não é citável, mas também não se repete.
   */
  protected readonly naoColetaveisAqui = computed(() => [
    ...this.fatosIndisponiveis(),
    ...(this.finalidade() === FINALIDADE_INSCRICAO ? [] : (this.fatosDaInscricao() ?? [])),
  ]);
  /** Só os fatos do candidato: o de membro existe uma vez por ocorrência do grupo e não tem valor fora dele. */
  private readonly fatosDaInscricaoCitaveis = computed(() => {
    const doCandidato = new Set(this.catalogo().filter((fato) => fato.escopo === ESCOPO_CANDIDATO).map((fato) => fato.codigo));
    return (this.fatosDaInscricao() ?? []).filter((codigo) => doCandidato.has(codigo));
  });
  protected readonly noTeto = computed(() => quantidadeNoTeto(this.conteudo()) >= LIMITES_DO_FORMULARIO.itens);
  protected readonly exigemResposta = computed(
    () => new Set([...fatosQueExigemResposta(this.conteudo()), ...this.fatosQueExigemRespostaPorFora()]),
  );
  protected readonly desativados = computed(() => new Set(this.catalogo().filter((fato) => !fato.ativo).map((fato) => fato.codigo)));
  protected readonly blocosParaAcrescentar = computed(() =>
    blocosAdmitidos(this.finalidade()).filter((bloco) => !this.etapas().some((etapa) => etapa.bloco === bloco.valor)),
  );

  /** Os fatos que as condições de cada item podem citar, e os que ele já cita — para a condição gravada aparecer. */
  protected readonly fatosDoItem = computed(() => {
    const conteudo = this.conteudoParaCitacoes();
    return new Map(
      (conteudo.itens ?? []).map((item) => [
        item.fatoCodigo,
        this.escolhiveis(fatosCitaveisPeloItem(conteudo, item.fatoCodigo), predicadosSobreRespostasAnteriores(item)),
      ]),
    );
  });

  /**
   * O que cada item precisa para as regras sobre a própria resposta: os valores que as opções
   * permitidas marcam, os campos anteriores de onde as opções podem vir, as UFs de onde o
   * município tira a lista, e se cabe o impedimento — com os
   * fatos que a condição dele cita, o próprio campo primeiro, para a alternativa nova nascer com ele.
   */
  protected readonly regrasProprias = computed(() => {
    const conteudo = this.conteudoParaCitacoes();
    const escolhiveis = new Map(fatosEscolhiveis(this.catalogo(), new Map(), [], this.comMunicipios).map((fato) => [fato.codigo, fato]));
    return new Map(
      (conteudo.itens ?? []).map((item) => {
        const proprio = escolhiveis.get(item.fatoCodigo);
        const anteriores = (this.fatosDoItem().get(item.fatoCodigo) ?? []).filter((fato) => fato.codigo !== item.fatoCodigo);
        return [
          item.fatoCodigo,
          {
            valoresConhecidos: proprio?.tipoDominio === 'CATEGORICO_ESTATICO' ? proprio.valores : [],
            fontesDeOpcoes: fontesDasOpcoes(this.catalogo(), fatosCitaveisPeloItem(conteudo, item.fatoCodigo), item.fatoCodigo).map(
              (fonte) => ({ codigo: fonte.codigo, nome: fonte.nome }),
            ),
            ufs: ufsAnteriores(conteudo, this.catalogo(), item.fatoCodigo).map((uf) => ({ codigo: uf.codigo, nome: uf.nome })),
            impedimentoPermitido: impedimentoCabe(this.finalidade(), item.tipoRenderizacao, proprio !== undefined),
            fatosDoImpedimento: proprio === undefined ? anteriores : [proprio, ...anteriores],
          },
        ] as const;
      }),
    );
  });

  protected readonly fatosDaSecao = computed(() => {
    const conteudo = this.conteudoParaCitacoes();
    return new Map(
      (conteudo.etapas ?? []).map((etapa) => [
        etapa.codigo,
        this.escolhiveis(fatosCitaveisPelaSecao(conteudo, etapa.codigo), [etapa.exibicao ?? null]),
      ]),
    );
  });

  protected readonly termos = computed(() => termosEmOrdem(this.conteudo()));
  protected readonly semRecusas: ReadonlyMap<string, readonly string[]> = new Map();
  protected readonly semRecusasDeRestricao: ReadonlyMap<string, readonly RecusaDaRestricao[]> = new Map();
  protected readonly podeMoverEntrada = podeMoverEntrada;
  protected readonly comGrupo = comGrupo;
  protected readonly fatosDeMembro = computed(() =>
    fatosDeMembroParaAcrescentar(this.conteudo(), this.catalogo(), this.naoColetaveisAqui()),
  );
  protected readonly termosPossiveis = computed(() => termosParaAcrescentar(this.conteudo(), this.termosDisponiveis()));
  protected readonly fatosDosTermos = computed(() => {
    const conteudo = this.conteudoParaCitacoes();
    return this.escolhiveis(
      fatosCitaveisPelosTermos(conteudo),
      (conteudo.termos ?? []).flatMap((termo) => [termo.exibicao, termo.predicadoObrigatoriedade]),
    );
  });
  /**
   * O modelo declara pressupostos fora da inscrição. O processo não os tem — cita os fatos da
   * inscrição —, e a seção só aparece nele se algum veio gravado, para poder ser retirado.
   */
  protected readonly temPressupostos = computed(() =>
    this.fatosDaInscricao() === null
      ? this.finalidade() !== FINALIDADE_INSCRICAO || (this.conteudo().pressupostos?.length ?? 0) > 0
      : (this.conteudo().pressupostos?.length ?? 0) > 0,
  );
  /** No processo não se acrescenta pressuposto: a seção, quando aparece, só retira o que veio gravado. */
  protected readonly pressupostosPossiveis = computed(() =>
    this.fatosDaInscricao() === null ? pressupostosParaAcrescentar(this.conteudo(), this.catalogo(), this.finalidade()) : [],
  );

  protected nomeDoFato(codigo: string): string {
    return this.nomes().get(codigo) ?? codigo;
  }

  protected termoDisponivel(termoId: string): TermoDisponivel | undefined {
    return this.termosDisponiveis().find((termo) => termo.termoId === termoId);
  }

  protected idDoTermo(codigo: string): string {
    return `${this.idBase()}-termo-${codigo}`;
  }

  protected escolhaDeTermo(): string {
    const escolhido = this.escolhas().get(this.chaveTermo) ?? '';
    return this.termosPossiveis().some((termo) => termo.termoId === escolhido) ? escolhido : '';
  }

  protected escolhaDePressuposto(): string {
    const escolhido = this.escolhas().get(this.chavePressuposto) ?? '';
    return this.pressupostosPossiveis().some((fato) => fato.codigo === escolhido) ? escolhido : '';
  }

  protected acrescentarOTermo(): void {
    const termo = this.termosPossiveis().find((t) => t.termoId === this.escolhaDeTermo());
    if (termo === undefined) return;
    const conteudo = acrescentarTermo(this.conteudo(), termo);
    this.emitir(conteudo);
    this.escolhas.update((escolhas) => new Map(escolhas).set(this.chaveTermo, ''));
    this.anuncio.set(`Termo “${termo.nome}” exigido na revisão e aceite.`);
    const novo = termosEmOrdem(conteudo).at(-1);
    if (novo !== undefined) focarDepois(this.injector, `${this.idDoTermo(novo.codigo)}-versao`);
  }

  protected moverOTermo(codigo: string, direcao: -1 | 1): void {
    const conteudo = moverTermo(this.conteudo(), codigo, direcao);
    this.emitir(conteudo);
    const termos = termosEmOrdem(conteudo);
    const posicao = termos.findIndex((termo) => termo.codigo === codigo) + 1;
    const termo = termos[posicao - 1];
    this.anuncio.set(`Termo “${this.termoDisponivel(termo?.termoId ?? '')?.nome ?? codigo}” movido para a posição ${posicao} de ${termos.length}.`);
    this.focarBotaoDeMover(this.idDoTermo(codigo), direcao);
  }

  protected removerOTermo(codigo: string): void {
    const termo = (this.conteudo().termos ?? []).find((t) => t.codigo === codigo);
    this.emitir(removerTermo(this.conteudo(), codigo));
    this.anuncio.set(`Termo “${this.termoDisponivel(termo?.termoId ?? '')?.nome ?? codigo}” deixou de ser exigido.`);
    focarDepois(this.injector, `${this.idBase()}-termo`, `${this.idBase()}-titulo`);
  }

  protected acrescentarOPressuposto(): void {
    const fato = this.escolhaDePressuposto();
    if (fato === '') return;
    this.emitir(acrescentarPressuposto(this.conteudo(), fato));
    this.escolhas.update((escolhas) => new Map(escolhas).set(this.chavePressuposto, ''));
    this.anuncio.set(`“${this.nomeDoFato(fato)}” passa a ser pressuposto.`);
    focarDepois(this.injector, `${this.idBase()}-pressuposto`, `${this.idBase()}-titulo`);
  }

  protected retirarPressuposto(fato: string): void {
    // No processo, o fato que a inscrição coleta continua conhecido sem o pressuposto: as regras que o citam seguem válidas.
    const resultado: ResultadoDaEdicao = (this.fatosDaInscricao() ?? []).includes(fato)
      ? { ok: true, conteudo: { ...this.conteudo(), pressupostos: (this.conteudo().pressupostos ?? []).filter((p) => p !== fato) } }
      : removerPressuposto(this.conteudo(), fato, this.nomes());
    this.aplicar(resultado, () => {
      this.anuncio.set(`“${this.nomeDoFato(fato)}” deixou de ser pressuposto.`);
      // Sem o combo, que some quando a seção some ou fica sem opção, o foco volta ao título do formulário.
      focarDepois(this.injector, `${this.idBase()}-pressuposto`, `${this.idBase()}-titulo`);
    });
  }

  protected entradasDe(etapa: EtapaDoFormulario): ReturnType<typeof entradasDaSecao> {
    return entradasDaSecao(this.conteudo(), etapa.codigo);
  }

  protected chaveDa(entrada: ReturnType<typeof entradasDaSecao>[number]): string {
    return entrada.tipo === 'item' ? `item:${entrada.item.fatoCodigo}` : `grupo:${entrada.grupo.codigo}`;
  }

  protected etapaAberta(etapa: Pick<EtapaDoFormulario, 'codigo'>): boolean {
    return !this.etapasRecolhidas().has(etapa.codigo);
  }

  protected alternarEtapa(etapa: Pick<EtapaDoFormulario, 'codigo'>): void {
    this.etapasRecolhidas.update((recolhidas) => {
      const proximas = new Set(recolhidas);
      if (proximas.has(etapa.codigo)) {
        proximas.delete(etapa.codigo);
      } else {
        proximas.add(etapa.codigo);
      }
      return proximas;
    });
  }

  /** O que a etapa tem, para quem a vê recolhida; bloco do sistema não tem campos a contar. */
  protected resumoDaEtapa(etapa: EtapaDoFormulario): string {
    if (etapa.tipo !== this.secao) {
      return '';
    }
    const entradas = this.entradasDe(etapa);
    const campos = entradas.filter((entrada) => entrada.tipo === 'item').length;
    const grupos = entradas.length - campos;
    const partes = [campos === 1 ? '1 campo' : `${campos} campos`];
    if (grupos > 0) {
      partes.push(grupos === 1 ? '1 grupo repetível' : `${grupos} grupos repetíveis`);
    }
    return partes.join(' · ');
  }

  protected idDaEtapa(etapa: Pick<EtapaDoFormulario, 'codigo'>): string {
    return `${this.idBase()}-etapa-${etapa.codigo}`;
  }

  protected idDoItem(item: Pick<ItemDoFormulario, 'fatoCodigo'>): string {
    return `${this.idBase()}-item-${item.fatoCodigo}`;
  }

  /** Como a tela chama a etapa: seção ou bloco do sistema — "etapa" é termo do cronograma do processo. */
  protected nomeDaEtapa(etapa: EtapaDoFormulario): string {
    const titulo = etapa.titulo.trim() || 'sem título';
    return etapa.tipo === this.secao ? `a seção ${titulo}` : `o bloco ${titulo}`;
  }

  protected daEtapa(etapa: EtapaDoFormulario): string {
    const titulo = etapa.titulo.trim() || 'sem título';
    return etapa.tipo === this.secao ? `da seção ${titulo}` : `do bloco ${titulo}`;
  }

  protected descricaoDoBloco(etapa: EtapaDoFormulario): string {
    return DESCRICAO_DO_BLOCO[etapa.bloco ?? ''] ?? '';
  }

  protected errosDoItem(fatoCodigo: string): readonly string[] {
    return this.recusas()?.porItem.get(fatoCodigo) ?? [];
  }

  protected errosDoGrupo(codigo: string): readonly string[] {
    return this.recusas()?.porGrupo.get(codigo) ?? [];
  }

  protected idDoGrupo(codigo: string): string {
    return `${this.idBase()}-grupo-${codigo}`;
  }

  /** O texto que o administrador digitou num controle de acréscimo, como veio. */
  protected escolhaLivre(chave: string): string {
    return this.escolhas().get(chave) ?? '';
  }

  /** O fato de membro escolhido para o grupo novo da seção, enquanto ainda pode ser usado. */
  protected escolhaDeMembro(etapaCodigo: string): string {
    const escolhido = this.escolhas().get(`#grupo-campo:${etapaCodigo}`) ?? '';
    return this.fatosDeMembro().some((fato) => fato.codigo === escolhido) ? escolhido : '';
  }

  protected errosDoTermo(codigo: string): readonly string[] {
    return this.recusas()?.porTermo.get(codigo) ?? [];
  }

  protected errosDaEtapa(codigo: string): readonly string[] {
    return this.recusas()?.porEtapa.get(codigo) ?? [];
  }

  /** O fato escolhido para a seção, enquanto ainda pode ser acrescentado — outra seção pode tê-lo levado. */
  protected escolhaDe(etapaCodigo: string): string {
    const escolhido = this.escolhas().get(etapaCodigo) ?? '';
    return this.paraAcrescentar().some((fato) => fato.codigo === escolhido) ? escolhido : '';
  }

  protected escolher(etapaCodigo: string, evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.escolhas.update((escolhas) => new Map(escolhas).set(etapaCodigo, valor));
  }

  protected emitir(conteudo: ConteudoDoFormulario): void {
    this.conteudoChange.emit(conteudo);
  }

  protected trocarTitulo(evento: Event): void {
    const titulo = (evento.target as HTMLInputElement).value;
    this.emitir({ ...this.conteudo(), titulo: titulo.trim() === '' ? null : titulo });
  }

  protected acrescentarOItem(etapa: EtapaDoFormulario): void {
    const fato = this.paraAcrescentar().find((f) => f.codigo === this.escolhaDe(etapa.codigo));
    if (fato === undefined) return;
    this.aplicar(acrescentarCampo(this.conteudo(), fato, etapa.codigo, this.catalogo(), this.conteudoParaCitacoes().pressupostos ?? []), () => {
      this.escolhas.update((escolhas) => new Map(escolhas).set(etapa.codigo, ''));
      this.anuncio.set(`Campo “${fato.nome}” acrescentado ao fim de ${etapa.titulo}.`);
      focarDepois(this.injector, `${this.idDoItem({ fatoCodigo: fato.codigo })}-rotulo`);
    });
  }

  protected moverOGrupo(codigo: string, rotulo: string, direcao: -1 | 1, etapa: EtapaDoFormulario): void {
    this.aplicar(moverEntrada(this.conteudo(), { tipo: 'grupo', codigo }, direcao, this.nomes()), (conteudo) => {
      const entradas = entradasDaSecao(conteudo, etapa.codigo);
      const posicao = entradas.findIndex((entrada) => entrada.tipo === 'grupo' && entrada.grupo.codigo === codigo) + 1;
      this.anuncio.set(`Grupo “${rotulo}” movido para a posição ${posicao} de ${entradas.length} em ${etapa.titulo}.`);
      this.focarBotaoDeMover(this.idDoGrupo(codigo), direcao);
    });
  }

  protected removerOGrupo(codigo: string, rotulo: string, etapa: EtapaDoFormulario): void {
    const grupo = (this.conteudo().grupos ?? []).find((g) => g.codigo === codigo);
    const travado = grupo === undefined ? null : motivoDaRemocaoTravadaDoGrupo(grupo, this.remocoesTravadas());
    if (travado !== null) {
      this.anuncio.set(`O grupo “${rotulo}” não pode ser removido: ${travado}`);
      return;
    }
    this.emitir(removerGrupo(this.conteudo(), codigo));
    this.anuncio.set(`Grupo “${rotulo}” removido de ${etapa.titulo}.`);
    focarDepois(this.injector, `${this.idDaEtapa(etapa)}-acrescentar`);
  }

  protected acrescentarOGrupo(etapa: EtapaDoFormulario): void {
    const rotulo = this.escolhaLivre(`#grupo-rotulo:${etapa.codigo}`);
    const fato = this.fatosDeMembro().find((f) => f.codigo === this.escolhaDeMembro(etapa.codigo));
    if (fato === undefined) return;
    this.aplicar(acrescentarGrupo(this.conteudo(), rotulo, etapa.codigo, fato, this.catalogo()), (conteudo) => {
      const novo = (conteudo.grupos ?? []).find((grupo) => !(this.conteudo().grupos ?? []).some((g) => g.codigo === grupo.codigo));
      this.escolhas.update((escolhas) => new Map(escolhas).set(`#grupo-rotulo:${etapa.codigo}`, '').set(`#grupo-campo:${etapa.codigo}`, ''));
      this.anuncio.set(`Grupo repetível “${rotulo.trim()}” acrescentado ao fim de ${etapa.titulo}.`);
      if (novo !== undefined) focarDepois(this.injector, `${this.idDoGrupo(novo.codigo)}-rotulo`);
    });
  }

  protected moverOItem(item: ItemDoFormulario, direcao: -1 | 1, etapa: EtapaDoFormulario): void {
    this.aplicar(moverItem(this.conteudo(), item.fatoCodigo, direcao, this.nomes()), (conteudo) => {
      const entradas = entradasDaSecao(conteudo, etapa.codigo);
      const posicao = entradas.findIndex((entrada) => entrada.tipo === 'item' && entrada.item.fatoCodigo === item.fatoCodigo) + 1;
      this.anuncio.set(`“${item.rotulo}” movido para a posição ${posicao} de ${entradas.length} em ${etapa.titulo}.`);
      this.focarBotaoDeMover(this.idDoItem(item), direcao);
    });
  }

  protected removerOItem(item: ItemDoFormulario, etapa: EtapaDoFormulario): void {
    const travado = this.remocoesTravadas().get(item.fatoCodigo);
    if (travado !== undefined) {
      this.anuncio.set(travado);
      return;
    }
    this.aplicar(removerItem(this.conteudo(), item.fatoCodigo, this.nomes()), () => {
      this.anuncio.set(`Campo “${item.rotulo}” removido de ${etapa.titulo}.`);
      focarDepois(this.injector, `${this.idDaEtapa(etapa)}-acrescentar`);
    });
  }

  protected moverAEtapa(etapa: EtapaDoFormulario, direcao: -1 | 1): void {
    this.aplicar(moverEtapa(this.conteudo(), etapa.codigo, direcao, this.nomes()), (conteudo) => {
      const etapas = etapasEmOrdem(conteudo);
      const posicao = etapas.findIndex((e) => e.codigo === etapa.codigo) + 1;
      this.anuncio.set(`“${etapa.titulo}” foi para a posição ${posicao} de ${etapas.length}.`);
      this.focarBotaoDeMover(this.idDaEtapa(etapa), direcao);
    });
  }

  protected removerAEtapa(etapa: EtapaDoFormulario): void {
    this.aplicar(removerEtapa(this.conteudo(), etapa.codigo), () => {
      this.anuncio.set(`${etapa.titulo} removida.`);
      focarDepois(this.injector, `${this.idBase()}-titulo`);
    });
  }

  protected acrescentarASecao(): void {
    const conteudo = acrescentarSecao(this.conteudo(), 'Nova seção');
    const nova = (conteudo.etapas ?? []).find((etapa) => !(this.conteudo().etapas ?? []).some((e) => e.codigo === etapa.codigo));
    this.emitir(conteudo);
    this.anuncio.set('Seção nova acrescentada antes da revisão e aceite.');
    if (nova !== undefined) focarDepois(this.injector, `${this.idDaEtapa(nova)}-titulo`);
  }

  protected acrescentarOBloco(valor: string): void {
    const bloco = this.blocosParaAcrescentar().find((b) => b.valor === valor);
    if (bloco === undefined) return;
    this.emitir(acrescentarBloco(this.conteudo(), bloco));
    this.anuncio.set(`Bloco “${bloco.rotulo}” acrescentado antes da revisão e aceite.`);
  }

  /** Aplica a edição aceita, ou anuncia a recusa sem mexer no conteúdo. */
  private aplicar(resultado: ResultadoDaEdicao, depois: (conteudo: ConteudoDoFormulario) => void): void {
    if (!resultado.ok) {
      this.anuncio.set(resultado.recusa);
      return;
    }
    this.emitir(resultado.conteudo);
    depois(resultado.conteudo);
  }

  private escolhiveis(citaveis: ReadonlySet<string>, predicados: readonly PredicadoNoWire[]): readonly FatoEscolhivel[] {
    return fatosOferecidos(this.catalogo(), citaveis, predicados, this.comMunicipios);
  }

  /** Mover tira o nó do lugar e o foco com ele: o foco volta ao mesmo botão, ou ao oposto quando chegou à ponta. */
  private focarBotaoDeMover(prefixo: string, direcao: -1 | 1): void {
    const mesmo = `${prefixo}-${direcao < 0 ? 'subir' : 'descer'}`;
    const oposto = `${prefixo}-${direcao < 0 ? 'descer' : 'subir'}`;
    focarDepois(this.injector, mesmo, oposto);
  }


}
