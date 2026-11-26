import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { FalhaDeLeituraComponent, ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import { EtapaPontuada, ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { focarAposRenderizar } from '../../shared/foco-apos-renderizar';
import { LeituraDoCadastroDePesos } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import {
  classificacaoUsaFormulaLocal,
  divisorDaMediaValido,
  mensagensDeClassificacaoBase,
} from '../classificacao/classificacao-para-comando';
import { CatalogoDeTiposDeEtapa } from '../cronograma/catalogos/catalogo-de-tipos-de-etapa.service';
import { declaraNotaDoEnem } from '../cronograma/regras-da-etapa';
import { GravacaoDaClassificacao } from '../classificacao/gravacao-da-classificacao.service';
import { RegraDeEliminacaoComponent } from './regra-de-eliminacao.component';
import {
  REGRA_ELIMINACAO_VAZIA,
  leituraDaRegra,
  quadroDoCorte,
  type EtapaReferenciavel,
} from './regras-de-eliminacao';
import { mensagensDasRegras } from './validacao-da-eliminacao';

const MENSAGEM_DIVISOR_INVALIDO =
  'Nenhuma etapa do Cronograma compõe a nota. Volte ao Cronograma e declare ao menos uma etapa classificatória (ou ambas) com peso maior que zero.';

/**
 * Regras de eliminação — a coleção que fecha o corpo de `PUT
 * …/classificacao` (UNI-REQ-0482). Eliminação não é dimensão própria da API:
 * é parte do payload de classificação, e por isso este passo grava o comando
 * inteiro, com a regra de cálculo e a precisão que o passo Fórmula coleta.
 *
 * Sob `CLASSIFICACAO_IMPORTADA`, esta seção não se aplica: a lista
 * de regras é ignorada na gravação (o mapeador força `[]`), e a tela não
 * oferece edição.
 */
@Component({
  selector: 'sel-step-eliminacao',
  standalone: true,
  imports: [FalhaDeLeituraComponent, ValorEmConsultaComponent, RegraDeEliminacaoComponent],
  templateUrl: './eliminacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(EliminacaoPassoComponent)],
})
export class EliminacaoPassoComponent {
  readonly gravaAClassificacao = true as const;
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacao);
  private readonly cadastroDePesos = inject(LeituraDoCadastroDePesos);
  private readonly catalogoDeTiposDeEtapa = inject(CatalogoDeTiposDeEtapa);
  private readonly gravacao = inject(GravacaoDaClassificacao);

  constructor() {
    this.catalogos.carregar();
  }

  protected readonly nomeDoPassoDaFormula = NOME_DO_PASSO_DA_FORMULA;

  readonly usaFormulaLocal = computed(() =>
    classificacaoUsaFormulaLocal(this.store.draft().classificacao.regraCalculoCodigo),
  );

  /** Só a classificação: uma tecla em outro passo não refaz a conferência do desempate. */
  private readonly classificacao = computed(() => this.store.draft().classificacao);

  readonly regras = computed(() => this.classificacao().regrasEliminacao);

  /** Só etapas já persistidas (com `id`) podem ser referenciadas por `etapaRef`. */
  readonly etapasReferenciaveis = computed<readonly EtapaReferenciavel[]>(() => {
    // Vale o tipo do catálogo quando o rascunho já trocou o da etapa gravada, como no cronograma: a
    // tela julga a etapa como o servidor, que confere o tipo que a gravação levaria.
    const tipos = this.catalogoDeTiposDeEtapa.tipoEtapaPorId();
    return this.store
      .draft()
      .cronograma.etapas.filter(
        (etapa): etapa is EtapaPontuada & { id: string } => etapa.id !== null,
      )
      .map((etapa) => ({
        ...etapa,
        doEnem: declaraNotaDoEnem(etapa, tipos.get(etapa.tipoEtapaOrigemId)),
      }));
  });

  private readonly regrasDoCatalogo = computed(() => this.catalogos.regrasEliminacao());

  /** O quadro dos cortes por área: as áreas oferecidas, os grupos e os rótulos. */
  readonly quadro = computed(() =>
    quadroDoCorte(
      this.classificacao(),
      this.cadastroDePesos.leitura(),
      this.store.classificacao.gravada(),
    ),
  );

  /** As regras como a consulta as mostra. */
  protected readonly leituras = computed(() =>
    this.regras().map((regra) =>
      leituraDaRegra(regra, this.regrasDoCatalogo(), this.etapasReferenciaveis(), this.quadro()),
    ),
  );

  /** O divisor da média fica zero sem etapa que componha a nota (item `classificacao_divisor_media_invalido`). */
  readonly divisorInvalido = computed(
    () => this.usaFormulaLocal() && !divisorDaMediaValido(this.store.draft().cronograma.etapas),
  );

  /**
   * O que mudou na lista, para quem não vê a tela. Acrescentar e remover eram mudanças
   * silenciosas para leitor de tela.
   */
  readonly anuncio = signal('');

  private readonly injector = inject(Injector);

  acrescentarRegra(): void {
    this.store.patchObjectSection('classificacao', {
      regrasEliminacao: [...this.regras(), REGRA_ELIMINACAO_VAZIA],
    });
    this.anuncio.set(`Regra ${this.regras().length} acrescentada ao fim da lista.`);
  }

  removerRegra(indice: number): void {
    // As posições seguintes mudam: as recusas guardadas por índice deixam de apontar a regra certa.
    this.gravacao.esquecerRecusas();
    this.store.patchObjectSection('classificacao', {
      regrasEliminacao: this.regras().filter((_, item) => item !== indice),
    });
    this.anuncio.set(`Regra ${indice + 1} removida.`);
    this.devolverOFocoAposRemover(indice);
  }

  /**
   * O botão clicado sai do DOM junto com a regra, e o foco cairia no corpo da página — quem
   * navega por teclado perderia o lugar a cada remoção. Removida a última regra, vale
   * "Acrescentar".
   */
  private devolverOFocoAposRemover(indice: number): void {
    focarAposRenderizar(
      this.injector,
      `elim-remover-${Math.max(0, indice - 1)}`,
      'eliminacao-acrescentar',
    );
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /** Sem confirmação quando o passo não valida: `persistir()` mostra a recusa sem chamar a API. */
  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    return this.validar().valid ? this.gravacao.confirmacao() : null;
  }

  /**
   * Validação declarativa — acionada pela page ao clicar em "Próximo" e antes
   * de gravar. Inclui os campos que o passo Fórmula coleta
   * (`mensagensDeClassificacaoBase`): a navegação do wizard é livre, e este
   * passo grava o comando de classificação inteiro — não só a eliminação —
   * então não pode supor que o operador passou pela Fórmula antes de chegar
   * aqui.
   */
  validar(): ValidacaoDoPasso {
    const messages = [...this.mensagensDaClassificacaoBase(), ...this.mensagensDaEliminacaoLocal()];
    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /**
   * A resolução que o cadastro lido já não tem seria recusada pela gravação, que relê o cadastro;
   * a completude dos grupos continua sendo julgada pelo servidor.
   */
  private mensagensDaClassificacaoBase(): readonly string[] {
    return mensagensDeClassificacaoBase(
      this.classificacao(),
      this.cadastroDePesos.resolucaoForaDoCadastro,
    );
  }

  /**
   * CLASSIFICACAO_IMPORTADA (ou regra ainda não escolhida) não usa eliminação local: não há nada
   * além da classificação base a validar.
   */
  private mensagensDaEliminacaoLocal(): readonly string[] {
    if (!this.usaFormulaLocal()) return [];
    return [...this.mensagemDoDivisorInvalido(), ...this.mensagensDasRegrasDeEliminacao()];
  }

  private mensagemDoDivisorInvalido(): readonly string[] {
    return this.divisorInvalido() ? [MENSAGEM_DIVISOR_INVALIDO] : [];
  }

  private mensagensDasRegrasDeEliminacao(): string[] {
    return mensagensDasRegras({
      regras: this.regras(),
      etapas: this.etapasReferenciaveis(),
      quadro: this.quadro(),
      baseadoEmEnem: this.classificacao().baseadoEmEnem,
    });
  }

  readonly avisoDoDesempatePorArea = this.gravacao.avisoDoDesempatePorArea;

  /** "Atualizar lista" do aviso: relê o cadastro, e o aviso se refaz com ele. */
  atualizarCadastroDePesos(): void {
    this.cadastroDePesos.relerCadastroAPedido();
  }

  /**
   * Grava a classificação inteira, depois de conferir o passo: a navegação é livre, e nada garante
   * que a Fórmula esteja preenchida.
   */
  persistir(): Promise<ValidacaoDoPasso> {
    const conferencia = this.validar();
    return conferencia.valid ? this.gravacao.gravar() : Promise.resolve(conferencia);
  }
}
