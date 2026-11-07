import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ofertasEmOrdem,
  type InscricaoDoProcessoDto,
  type OfertaExibida,
} from '@uniplus/shared-data/selecao';
import {
  acompanharLeitura,
  AlertComponent,
  DEFAULT_PAGE_SIZE_OPTIONS,
  EmptyStateComponent,
  FalhaDeLeituraComponent,
  IconButtonComponent,
  IndicadorDaLeituraDirective,
  ListFooterComponent,
  PageHeaderComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { OfertasEscolhidasComponent } from './ofertas-escolhidas.component';
import { InscricoesDoProcesso } from './inscricoes-do-processo.service';
import { rotuloDaSituacao, varianteDaSituacao } from './situacao-da-inscricao';

/** Nome do link de uma linha sem dado visível; começa pelo texto visível do botão (WCAG 2.5.3). */
export const NOME_DA_INSCRICAO_SEM_DADOS = 'Abrir inscrição sem dados visíveis';

/** Uma linha pronta para a tabela: cada campo é o que a API devolveu, ou `null` quando ela o omitiu. */
interface LinhaDaInscricao {
  readonly id: string;
  readonly numero: string | null;
  readonly nome: string | null;
  readonly cpf: string | null;
  /** `null` quando a API omitiu as ofertas da linha. */
  readonly ofertas: readonly OfertaExibida[] | null;
  readonly situacao: string | null;
  readonly enviadaEm: string | null;
  readonly nomeDoLink: string;
}

/**
 * O nome do link: o número da inscrição. Sem ele, a posição na página distingue as linhas (WCAG
 * 2.4.4), junto do que a linha mostra (nome, curso); só sem nada visível vale o texto de reserva.
 */
function nomeDoLink(linha: Omit<LinhaDaInscricao, 'nomeDoLink'>, posicao: number): string {
  if (linha.numero !== null) return `Abrir inscrição ${linha.numero}`;
  const naPagina = `${posicao}ª da página`;
  const visiveis = [linha.nome, linha.ofertas?.[0]?.nome ?? null].filter((v) => v !== null);
  if (visiveis.length > 0) return `Abrir inscrição ${naPagina}, ${visiveis.join(', ')}`;
  const algoVisivel = [linha.cpf, linha.ofertas, linha.situacao, linha.enviadaEm].some(
    (v) => v !== null,
  );
  return algoVisivel
    ? `Abrir inscrição ${naPagina}`
    : `${NOME_DA_INSCRICAO_SEM_DADOS}, ${naPagina}`;
}

/**
 * As inscrições enviadas do processo seletivo, para quem as opera.
 *
 * Mostra só o que a API devolve em cada linha: a visibilidade de cada campo é decisão dela, e a
 * tela não a deduz de permissão. Campo omitido fica vazio, sem marca; a coluna que nenhuma linha
 * da página traz não aparece.
 */
@Component({
  selector: 'sel-inscricoes-do-processo',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    AlertComponent,
    DateBrPipe,
    EmptyStateComponent,
    FalhaDeLeituraComponent,
    IconButtonComponent,
    IndicadorDaLeituraDirective,
    ListFooterComponent,
    OfertasEscolhidasComponent,
    PageHeaderComponent,
    SpinnerComponent,
    TagComponent,
  ],
  providers: [InscricoesDoProcesso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Inscrições" [description]="descricaoDoCabecalho()">
      <div uiPageActions class="insc-page__acoes">
        <a class="btn btn--tertiary" routerLink="/processo-seletivo">Voltar aos processos</a>
      </div>
    </ui-page-header>

    @let situacao = inscricoes.situacao();
    @if (situacao.estado === 'nao-encontrado') {
      <ui-alert variant="danger" heading="Processo seletivo não encontrado">
        O processo seletivo não existe ou não está disponível para você.
      </ui-alert>
    } @else {
      @if (inscricoes.recomecou()) {
        <ui-alert variant="info" heading="A lista voltou à primeira página">
          A página que você abriu não existe mais, porque a lista mudou.
        </ui-alert>
      }
      <ui-falha-de-leitura
        titulo="Não foi possível carregar as inscrições"
        [leitura]="leitura"
      />

      @if (situacao.estado !== 'falha' || inscricoes.inscricoes().length > 0) {
        <section class="panel" aria-labelledby="insc-page-titulo">
          <div class="panel-head">
            <div class="panel-head__title">
              <h2 id="insc-page-titulo" tabindex="-1">Inscrições enviadas</h2>
              @if (inscricoes.carregando()) {
                <span class="insc-page__lendo" [uiIndicadorDaLeitura]="leitura">
                  <ui-spinner spinnerSize="sm" [decorativo]="true" />
                  Carregando
                </span>
              }
            </div>
          </div>

          <div [attr.aria-busy]="inscricoes.carregando() ? 'true' : null">
            @if (inscricoes.inscricoes().length > 0) {
              @let col = colunas();
              <div
                class="table-responsive table-responsive--acoes-fixas"
                role="region"
                tabindex="0"
                aria-label="Lista de inscrições"
              >
                <table>
                  <caption class="sr-only">
                    Inscrições enviadas do processo seletivo
                  </caption>
                  <thead>
                    <tr>
                      @if (col.numero) {
                        <th scope="col">Inscrição</th>
                      }
                      @if (col.nome) {
                        <th scope="col">Nome</th>
                      }
                      @if (col.cpf) {
                        <th scope="col">CPF</th>
                      }
                      @if (col.ofertas) {
                        <th scope="col">Ofertas</th>
                      }
                      @if (col.situacao) {
                        <th scope="col">Situação</th>
                      }
                      @if (col.envio) {
                        <th scope="col">Enviada em</th>
                      }
                      <th scope="col" class="table-responsive__actions">
                        <span class="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (linha of linhas(); track linha.id) {
                      <tr>
                        @if (col.numero) {
                          <td [attr.data-label]="linha.numero !== null ? 'Inscrição' : null">
                            {{ linha.numero }}
                          </td>
                        }
                        @if (col.nome) {
                          <td [attr.data-label]="linha.nome !== null ? 'Nome' : null">
                            {{ linha.nome }}
                          </td>
                        }
                        @if (col.cpf) {
                          <td [attr.data-label]="linha.cpf !== null ? 'CPF' : null">
                            <span class="insc-page__cpf">{{ linha.cpf }}</span>
                          </td>
                        }
                        @if (col.ofertas) {
                          <td [attr.data-label]="linha.ofertas !== null ? 'Ofertas' : null">
                            @if (linha.ofertas; as ofertas) {
                              <sel-ofertas-escolhidas [ofertas]="ofertas" />
                            }
                          </td>
                        }
                        @if (col.situacao) {
                          <td [attr.data-label]="linha.situacao !== null ? 'Situação' : null">
                            @if (linha.situacao !== null) {
                              <ui-tag [variant]="varianteDaSituacao(linha.situacao)">
                                {{ rotuloDaSituacao(linha.situacao) }}
                              </ui-tag>
                            }
                          </td>
                        }
                        @if (col.envio) {
                          <td [attr.data-label]="linha.enviadaEm !== null ? 'Enviada em' : null">
                            @if (linha.enviadaEm !== null) {
                              {{ linha.enviadaEm | dateBr: 'datetime' }}
                            }
                          </td>
                        }
                        <td class="table-responsive__actions">
                          <ui-icon-button
                            icon="pi-folder-open"
                            [accessibleName]="linha.nomeDoLink"
                            tooltip="Abrir inscrição"
                            [link]="[
                              '/processo-seletivo',
                              inscricoes.processoId(),
                              'inscricoes',
                              linha.id,
                            ]"
                          />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else if (situacao.estado === 'lido') {
              <ui-empty-state
                heading="Nenhuma inscrição enviada"
                description="As inscrições aparecem aqui depois que os candidatos as enviam."
              />
            }
          </div>

          <ng-container [ngTemplateOutlet]="rodape" />
        </section>
      } @else {
        <ng-container [ngTemplateOutlet]="rodape" />
      }

      <ng-template #rodape>
        <ui-list-footer
          navigationLabel="Paginação das inscrições"
          [pageSizeOptions]="opcoesLimite"
          [pageSize]="inscricoes.limite()"
          (pageSizeChange)="aoTrocarLimite($event)"
          [hasRows]="inscricoes.inscricoes().length > 0 || situacao.estado === 'falha'"
          [hasPrevious]="inscricoes.cursores().anterior !== null"
          [hasNext]="inscricoes.cursores().proximo !== null"
          (previous)="inscricoes.paginaAnterior()"
          (next)="inscricoes.proximaPagina()"
        />
      </ng-template>
    }
  `,
  styleUrl: './inscricoes-do-processo.page.css',
})
export class InscricoesDoProcessoPage {
  private readonly rota = inject(ActivatedRoute);
  protected readonly inscricoes = inject(InscricoesDoProcesso);
  protected readonly opcoesLimite = DEFAULT_PAGE_SIZE_OPTIONS;

  protected readonly leitura = acompanharLeitura({
    falha: computed(() => {
      const situacao = this.inscricoes.situacao();
      return situacao.estado === 'falha' ? situacao.mensagem : null;
    }),
    pendente: this.inscricoes.carregando,
    recarregar: () => this.inscricoes.tentarNovamente(),
    destino: () => document.getElementById('insc-page-titulo'),
    recusada: computed(() => this.inscricoes.situacao().estado === 'nao-encontrado'),
  });

  protected readonly rotuloDaSituacao = rotuloDaSituacao;
  protected readonly varianteDaSituacao = varianteDaSituacao;

  protected readonly linhas = computed<readonly LinhaDaInscricao[]>(() =>
    this.inscricoes.inscricoes().map((inscricao, indice) => this.linha(inscricao, indice)),
  );

  /** O processo vem em cada linha; sem linha, o subtítulo é genérico. */
  protected readonly descricaoDoCabecalho = computed(() => {
    const processo = this.inscricoes.nomeDoProcesso();
    return processo === null
      ? 'Inscrições do processo seletivo'
      : `${processo} — inscrições enviadas neste processo seletivo.`;
  });

  /** A coluna que nenhuma linha da página traz não aparece: a omissão é por classe de dado. */
  protected readonly colunas = computed(() => {
    const linhas = this.linhas();
    const traz = (campo: keyof LinhaDaInscricao): boolean =>
      linhas.some((linha) => linha[campo] !== null);
    return {
      numero: traz('numero'),
      nome: traz('nome'),
      cpf: traz('cpf'),
      ofertas: traz('ofertas'),
      situacao: traz('situacao'),
      envio: traz('enviadaEm'),
    };
  });

  constructor() {
    this.rota.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const id = parametros.get('id');
      if (id !== null) this.inscricoes.abrir(id);
    });
  }

  private linha(inscricao: InscricaoDoProcessoDto, indice: number): LinhaDaInscricao {
    const campos = {
      id: inscricao.id,
      numero: inscricao.numeroInscricao ?? null,
      nome: inscricao.nome?.valor ?? null,
      cpf: inscricao.cpf?.valor ?? null,
      ofertas: inscricao.ofertas?.length ? ofertasEmOrdem(inscricao.ofertas) : null,
      situacao: inscricao.situacao ?? null,
      enviadaEm: inscricao.submetidaEm ?? null,
    };
    return {
      ...campos,
      nomeDoLink: nomeDoLink(campos, indice + 1),
    };
  }

  protected aoTrocarLimite(valor: number | null): void {
    if (valor !== null) this.inscricoes.trocarLimite(valor);
  }
}
