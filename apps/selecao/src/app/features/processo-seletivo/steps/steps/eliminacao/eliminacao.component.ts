import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

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
import { CatalogosDoCronograma } from '../cronograma/catalogos-do-cronograma.service';
import { declaraNotaDoEnem } from '../cronograma/regras-da-etapa';
import { GravacaoDaClassificacao } from '../classificacao/gravacao-da-classificacao.service';
import { confirmacaoDaClassificacao } from '../classificacao/confirmacao-da-classificacao';
import { RegraDeEliminacaoComponent } from './regra-de-eliminacao.component';
import {
  REGRA_ELIMINACAO_VAZIA,
  leituraDaRegra,
  quadroDoCorte,
  rotuloDaArea,
  type EtapaReferenciavel,
} from './regras-de-eliminacao';
import { mensagensDasRegras } from './validacao-da-eliminacao';
import {
  conferirDesempateGravado,
  type PendenciaDoCriterioGravado,
} from '../desempate/conferencia-do-desempate-gravado';
import { recusaPorCriterioGravadoSemQuadro } from '../desempate/recusas-do-desempate';

/**
 * Regras de eliminação — a coleção que fecha o corpo de `PUT
 * …/classificacao` (UNI-REQ-0482). Eliminação não é dimensão própria da API:
 * é parte do payload de classificação, e por isso este é o passo que grava
 * o comando inteiro — regra de cálculo e precisão vêm do passo Fórmula, que
 * não persiste nada por conta própria.
 *
 * Sob `CLASSIFICACAO-IMPORTADA` (INV-B8), esta seção não se aplica: a lista
 * de regras é ignorada na gravação (o mapeador força `[]`), e a tela não
 * oferece edição.
 */
@Component({
  selector: 'sel-step-eliminacao',
  standalone: true,
  imports: [ValorEmConsultaComponent, RegraDeEliminacaoComponent],
  templateUrl: './eliminacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [GravacaoDaClassificacao, provePassoDoWizard(EliminacaoStepComponent)],
})
export class EliminacaoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacao);
  private readonly cadastroDePesos = inject(LeituraDoCadastroDePesos);
  private readonly catalogosDoCronograma = inject(CatalogosDoCronograma);
  private readonly gravacao = inject(GravacaoDaClassificacao);

  constructor() {
    this.catalogos.carregar();
  }

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
    const tipos = this.catalogosDoCronograma.tipoEtapaPorId();
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

    // O botão clicado sai do DOM junto com a regra, e o foco cairia no corpo da página — quem
    // navega por teclado perderia o lugar a cada remoção. Removida a última regra, vale
    // "Acrescentar".
    focarAposRenderizar(
      this.injector,
      `elim-remover-${Math.max(0, indice - 1)}`,
      'eliminacao-acrescentar',
    );
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Sem confirmação quando a gravação já se sabe recusada: `null` leva direto ao `persistir()`, que
   * mostra a recusa sem chamar a API.
   */
  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validate().valid || this.recusasCertasPeloDesempate().length > 0) return null;

    return confirmacaoDaClassificacao({
      draft: this.store.draft(),
      avisosDoDesempate: this.avisoDoDesempatePorArea(),
      // O passo Desempate adia a gravação dos critérios por área até a classificação: é aqui que
      // eles saem, e quem confirma precisa ver quais são.
      criteriosAdiados: this.store.classificacao.desempatePendenteDeGravacao()
        ? this.store.draft().desempate
        : [],
      rotuloDaArea: (codigo) => rotuloDaArea(this.quadro(), codigo),
    });
  }

  /**
   * Validação declarativa — acionada pela page ao clicar em "Próximo" e antes
   * de gravar. Inclui os campos que o passo Fórmula coleta
   * (`mensagensDeClassificacaoBase`): a navegação do wizard é livre, e este
   * passo grava o comando de classificação inteiro — não só a eliminação —
   * então não pode supor que o operador passou pela Fórmula antes de chegar
   * aqui.
   */
  validate(): ValidacaoDoPasso {
    const classificacao = this.store.draft().classificacao;
    // A resolução que o cadastro lido já não tem seria recusada pela gravação, que relê o
    // cadastro; a completude dos grupos continua sendo julgada pelo servidor.
    const messages: string[] = [
      ...mensagensDeClassificacaoBase(classificacao, this.cadastroDePesos.resolucaoForaDoCadastro),
    ];

    if (!this.usaFormulaLocal()) {
      // CLASSIFICACAO-IMPORTADA (ou regra ainda não escolhida) não usa
      // eliminação local — nada além da base acima a validar aqui.
      return messages.length ? { valid: false, messages } : { valid: true };
    }

    if (this.divisorInvalido()) {
      messages.push(
        'Nenhuma etapa do Cronograma compõe a nota. Volte ao Cronograma e declare ao menos uma etapa classificatória (ou ambas) com peso maior que zero.',
      );
    }
    messages.push(
      ...mensagensDasRegras({
        regras: this.regras(),
        etapas: this.etapasReferenciaveis(),
        quadro: this.quadro(),
        baseadoEmEnem: classificacao.baseadoEmEnem,
      }),
    );

    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /**
   * O servidor recusa a classificação que deixa sem nota de área um critério de desempate já
   * gravado que a cita. Com o rascunho fora do ENEM pela média ponderada, a recusa é certa, e a
   * gravação nem é tentada. Confere o que está gravado, e por isso fica fora do `validate()`: a
   * publicação valida todos os passos antes de gravá-los, e o Desempate, gravado antes deste, pode
   * resolver a pendência.
   */
  private recusasCertasPeloDesempate(): string[] {
    return this.pendenciasDoDesempateGravado()
      .filter(({ semQuadro }) => semQuadro)
      .map(({ posicao }) => recusaPorCriterioGravadoSemQuadro(posicao));
  }

  /**
   * As áreas que o cadastro lido não tem em todos os grupos da resolução do rascunho. Só avisa: a
   * gravação copia o quadro do cadastro que o servidor tem, que pode ter mudado depois da leitura,
   * e quem julga é ele.
   */
  readonly avisoDoDesempatePorArea = computed(() => {
    // Só para consulta não há gravação a avisar.
    if (!this.store.edicaoPermitida()) return [];
    const resolucao = this.classificacao().resolucaoPesoAreaEnem;
    return this.pendenciasDoDesempateGravado()
      .filter(({ semQuadro }) => !semQuadro)
      .map(({ posicao, fora, todas }) => {
        // Retirar todas as áreas deixaria o critério vazio, que o próprio Desempate recusa.
        const correcao = todas
          ? 'troque a regra do critério ou remova-o no passo Desempate e grave o passo'
          : 'retire a área no passo Desempate e grave o passo';
        return `Pelo cadastro de Peso por Área lido, o critério de desempate ${posicao} gravado cita ${fora.join(', ')}, que a resolução ${resolucao} não tem em todos os grupos, e a gravação deve ser recusada: ${correcao}, ou escolha outra resolução no passo Fórmula. Se o cadastro mudou, atualize a lista.`;
      });
  });

  private readonly pendenciasDoDesempateGravado = computed<readonly PendenciaDoCriterioGravado[]>(
    () => {
      // Depois de uma gravação do desempate sem resposta conclusiva, só o servidor sabe o que tem.
      const gravados = this.store.classificacao.criteriosDesempateGravados();
      if (gravados === null) return [];
      const conferencia = conferirDesempateGravado(
        gravados,
        this.classificacao(),
        this.cadastroDePesos.leitura(),
      );
      return conferencia.resultado === 'com-pendencias' ? conferencia.pendencias : [];
    },
  );

  /** "Atualizar lista" do aviso: relê o cadastro, e o aviso se refaz com ele. */
  atualizarCadastroDePesos(): void {
    this.cadastroDePesos.relerCadastroAPedido(() => undefined);
  }

  /**
   * Grava a classificação inteira — regra de cálculo, precisão, ordem de
   * alocação e o vetor de eliminação — num comando só. É o único `persistir()`
   * das duas telas: gravar também no Fórmula enviaria `regrasEliminacao`
   * vazio antes da hora e derrubaria o item de conformidade que esta gravação
   * levanta.
   */
  async persistir(): Promise<ValidacaoDoPasso> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          'O cadastro do processo precisa estar concluído antes de configurar a classificação.',
        ],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const doDesempate = this.recusasCertasPeloDesempate();
    if (doDesempate.length > 0) return { valid: false, messages: doDesempate };

    return this.gravacao.gravar(processoId);
  }
}
