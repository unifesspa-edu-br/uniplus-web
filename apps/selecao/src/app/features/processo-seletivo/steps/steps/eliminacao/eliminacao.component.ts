import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import {
  EtapaPontuada,
  RegraEliminacaoConfigurada,
  StepValidation,
} from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { focarAposRenderizar } from '../../shared/foco-apos-renderizar';
import { resumoDaRecusa } from '../../shared/resumo-da-recusa';
import { AcompanhamentoDoCadastroDePesos } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import {
  FATO_DA_EDICAO_DO_ENEM,
  comoOpcoesDasEdicoes,
  declaraEdicoesDoEnem,
} from '../classificacao/edicoes-do-enem';
import {
  classificacaoUsaFormulaLocal,
  comoComandoDeClassificacao,
  divisorDaMediaValido,
  eliminacaoUsaAreaEMinimo,
  eliminacaoUsaEtapa,
  eliminacaoUsaEtapaENotaMinima,
  eliminacaoUsaSoEtapa,
  ehCampoDaEscala,
  ehCampoDaResolucao,
  mensagensDeClassificacaoBase,
} from '../classificacao/classificacao-para-comando';
import {
  mensagemDaRecusaDaEscala,
  mensagemDaRecusaDaResolucao,
} from '../classificacao/recusas-da-classificacao';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { declaraNotaDoEnem } from '../cronograma/regras-da-etapa';
import { regrasEscolhiveis } from '../classificacao/regra-escolhivel';
import { type ColunaDoQuadro } from '../../shared/quadro-de-pesos';
import { recusaDaEliminacao, recusasDoCorte, type CampoDaRegra } from './recusas-da-eliminacao';
import { confirmacaoDaClassificacao } from '../classificacao/confirmacao-da-classificacao';
import {
  REGRA_ELIMINACAO_VAZIA,
  areasEscolhiveis,
  corteSugerido,
  etapasEscolhiveis,
  leituraDaRegra,
  quadroDoCorte,
  rotuloDaArea,
  rotuloDoMinimo,
  trocaDeArea,
  trocaDeRegra,
  type EtapaReferenciavel,
} from './regras-de-eliminacao';
import { mensagensDasRegras } from './validacao-da-eliminacao';
import {
  conferirDesempateGravado,
  recusaDaClassificacaoPeloDesempate,
  recusaPorCriterioGravadoSemQuadro,
  type PendenciaDoCriterioGravado,
} from '../desempate/quadro-do-desempate';

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
  imports: [ValorLegivelDirective, ValorEmConsultaComponent],
  templateUrl: './eliminacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(EliminacaoStepComponent)],
})
export class EliminacaoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly cadastroDePesos = inject(AcompanhamentoDoCadastroDePesos);
  private readonly catalogosDoCronograma = inject(CatalogosDoCronogramaService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly releitura = inject(ReleituraDoSnapshot);
  private readonly problemI18n = inject(ProblemI18nService);

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

  readonly regrasDoCatalogo = computed(() => this.catalogos.regrasEliminacao());

  /** O quadro dos cortes por área: as áreas oferecidas, os grupos e os rótulos. */
  readonly quadro = computed(() =>
    quadroDoCorte(
      this.classificacao(),
      this.cadastroDePesos.leitura(),
      this.store.classificacao.gravada(),
    ),
  );

  regraEscolhivel(regra: RegraEliminacaoConfigurada) {
    return regrasEscolhiveis(this.regrasDoCatalogo(), regra.regraCodigo, regra.regraVersao);
  }

  usaEtapaENotaMinima(regra: RegraEliminacaoConfigurada): boolean {
    return eliminacaoUsaEtapaENotaMinima(regra.regraCodigo);
  }

  usaSoEtapa(regra: RegraEliminacaoConfigurada): boolean {
    return eliminacaoUsaSoEtapa(regra.regraCodigo);
  }

  usaEtapa(regra: RegraEliminacaoConfigurada): boolean {
    return eliminacaoUsaEtapa(regra.regraCodigo);
  }

  usaAreaEMinimo(regra: RegraEliminacaoConfigurada): boolean {
    return eliminacaoUsaAreaEMinimo(regra.regraCodigo);
  }

  etapasEscolhiveis(indice: number): readonly EtapaReferenciavel[] {
    return etapasEscolhiveis(this.regras(), this.etapasReferenciaveis(), indice);
  }

  areasEscolhiveis(indice: number): readonly ColunaDoQuadro[] {
    return areasEscolhiveis(this.regras(), this.quadro(), indice);
  }

  rotuloDaArea(codigo: string): string {
    return rotuloDaArea(this.quadro(), codigo);
  }

  leituraDaRegra(regra: RegraEliminacaoConfigurada) {
    return leituraDaRegra(
      regra,
      this.regrasDoCatalogo(),
      this.etapasReferenciaveis(),
      this.quadro(),
    );
  }

  rotuloDoMinimo(regra: RegraEliminacaoConfigurada): string {
    return rotuloDoMinimo(regra, this.quadro());
  }

  corteSugerido(regra: RegraEliminacaoConfigurada): number | null {
    return corteSugerido(regra, this.quadro());
  }

  /**
   * As recusas do servidor a um campo de uma regra, por `índice.campo`. Ficam junto do campo até
   * a regra mudar ou a gravação seguinte responder.
   */
  readonly recusasPorCampo = signal<ReadonlyMap<string, string>>(new Map());

  recusaDoCampo(indice: number, campo: CampoDaRegra): string | null {
    return this.recusasPorCampo().get(`${indice}.${campo}`) ?? null;
  }

  /** O `aria-describedby` do campo: a recusa, quando há, e a dica, quando há. */
  descritoPor(indice: number, campo: CampoDaRegra, dica: string | null): string | null {
    const ids = [
      this.recusaDoCampo(indice, campo) === null ? null : `elim-${campo}-erro-${indice}`,
      dica,
    ].filter((id): id is string => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  rotuloDaEtapa(etapaId: string): string {
    const etapa = this.store.draft().cronograma.etapas.find((item) => item.id === etapaId);
    return etapa === undefined ? 'Etapa removida do cronograma' : etapa.nome || 'Etapa sem nome';
  }

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
    this.recusasPorCampo.set(new Map());
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

  escolherRegra(indice: number, valor: string): void {
    this.atualizarRegra(indice, trocaDeRegra(valor));
  }

  escolherArea(indice: number, areaCodigo: string): void {
    this.atualizarRegra(indice, trocaDeArea(this.regras()[indice], areaCodigo, this.quadro()));
  }

  alterarEtapaRef(indice: number, etapaRef: string): void {
    this.atualizarRegra(indice, { etapaRef });
  }

  alterarNotaMinima(indice: number, notaMinima: string): void {
    this.atualizarRegra(indice, { notaMinima });
  }

  alterarMinimo(indice: number, minimo: string): void {
    this.atualizarRegra(indice, { minimo });
  }

  private atualizarRegra(indice: number, patch: Partial<RegraEliminacaoConfigurada>): void {
    this.esquecerRecusasDa(indice);
    this.store.patchObjectSection('classificacao', {
      regrasEliminacao: this.regras().map((regra, item) =>
        item === indice ? { ...regra, ...patch } : regra,
      ),
    });
  }

  private esquecerRecusasDa(indice: number): void {
    const restantes = [...this.recusasPorCampo()].filter(
      ([chave]) => !chave.startsWith(`${indice}.`),
    );
    if (restantes.length < this.recusasPorCampo().size)
      this.recusasPorCampo.set(new Map(restantes));
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
      rotuloDaArea: (codigo) => this.rotuloDaArea(codigo),
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
  validate(): StepValidation {
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
  async persistir(): Promise<StepValidation> {
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

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const comando = comoComandoDeClassificacao(this.store.draft().classificacao);
      const resultado = await this.releitura.gravando(async () => {
        const resposta = await this.cadastro.definirClassificacao(processoId, comando);
        if (geracao !== this.store.geracao()) return resposta;
        if (resposta.ok) {
          this.recusasPorCampo.set(new Map());
          this.store.classificacao.descartarRecusas();
          this.store.classificacao.recusaDaEscalaDaNotaFinal.set(null);
          this.registrarQuadroCongelado(comando.resolucaoPesoAreaEnem ?? null);
        } else if (resposta.inconclusiva) {
          // O servidor pode ter gravado — com ou sem quadro —, e o que ele tem fica desconhecido.
          this.store.classificacao.marcarDesconhecida();
        }
        return resposta;
      });

      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!resultado.ok) {
        return { valid: false, messages: this.mensagensDaRecusa(resultado.problem) };
      }
      const edicoes = await this.gravarEdicoesDoEnem(processoId);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      return edicoes;
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * As edições do ENEM escolhidas na fórmula, gravadas depois da classificação: o servidor só as
   * aceita de processo cuja classificação gravada é baseada em ENEM. Sem edição escolhida não há o
   * que gravar, e a pendência de publicação diz que falta declará-las.
   */
  private async gravarEdicoesDoEnem(processoId: string): Promise<StepValidation> {
    const draft = this.store.draft();
    if (!declaraEdicoesDoEnem(draft) || draft.classificacao.edicoesEnem.length === 0) {
      return { valid: true };
    }

    const resposta = await this.cadastro.definirOpcoesDeclaradas(
      processoId,
      FATO_DA_EDICAO_DO_ENEM,
      { opcoes: comoOpcoesDasEdicoes(draft.classificacao.edicoesEnem) },
    );
    if (resposta.ok) {
      this.store.classificacao.recusaDasEdicoesDoEnem.set(null);
      return { valid: true };
    }

    const { title, detail } = this.problemI18n.resolve(resposta.problem);
    const recusa = detail ?? title;
    this.store.classificacao.recusaDasEdicoesDoEnem.set(recusa);
    return { valid: false, messages: [`Edições do ENEM, no passo Fórmula: ${recusa}`] };
  }

  /**
   * O resumo da recusa: a recusa da resolução, com o texto da tela e o passo onde corrigir; a
   * recusa por um critério de desempate já gravado, com o texto da tela, qualquer que seja o campo
   * que o servidor apontou; e o título da raiz, pelo `ProblemI18nService`, para o que a tela não
   * explica.
   *
   * As recusas sob o campo da resolução ficam guardadas para aparecer no passo da fórmula. Uma
   * resposta que julgou o campo substitui as duas — a da resolução e a de um critério de desempate
   * gravado — pelo que ela traz. Uma resposta sem ele não as apaga: o servidor recusa outros campos
   * antes de chegar a julgar a resolução, e só a gravação que dá certo prova que ela passou.
   */
  private mensagensDaRecusa(problema: ProblemDetails): string[] {
    this.recusasPorCampo.set(recusasDoCorte(problema.errors ?? []));
    const sobOCampo = (problema.errors ?? []).filter((erro) => ehCampoDaResolucao(erro.field));
    if (sobOCampo.length > 0) {
      const peloDesempate = sobOCampo.map(recusaDaClassificacaoPeloDesempate);
      const [daResolucao] = sobOCampo.filter((_, indice) => peloDesempate[indice] === null);
      this.store.classificacao.recusarPeloDesempate(
        peloDesempate.find((recusa) => recusa !== null) ?? null,
        this.cadastroDePesos.leitura().pedida,
      );
      this.store.classificacao.recusaDaResolucaoPesoAreaEnem.set(
        daResolucao === undefined ? null : mensagemDaRecusaDaResolucao(daResolucao),
      );
    }

    const daEscala = (problema.errors ?? []).find((erro) => ehCampoDaEscala(erro.field));
    const recusaDaEscala = daEscala === undefined ? null : mensagemDaRecusaDaEscala(daEscala);
    if (recusaDaEscala !== null)
      this.store.classificacao.recusaDaEscalaDaNotaFinal.set(recusaDaEscala);

    return resumoDaRecusa(
      problema,
      (erro) =>
        recusaDaEliminacao(erro) ??
        (ehCampoDaEscala(erro.field) && recusaDaEscala !== null
          ? `Escala da nota final, no passo Fórmula: ${recusaDaEscala}`
          : null) ??
        recusaDaClassificacaoPeloDesempate(erro) ??
        (ehCampoDaResolucao(erro.field)
          ? `Resolução de Peso por Área, no passo Fórmula: ${mensagemDaRecusaDaResolucao(erro)}`
          : null),
      () => this.problemI18n.resolve(problema).title,
    );
  }

  /**
   * A gravação que deu certo diz o que o processo passou a ter: sem resolução, nenhum quadro; com
   * ela, o quadro que o cadastro do servidor tinha para a resolução. O cadastro lido aqui dá a
   * cópia presumida, por confirmar na releitura que `gravando` faz — ou que a publicação faz no fim
   * da varredura; sem ele lido, só a releitura diz o que foi copiado.
   */
  private registrarQuadroCongelado(resolucaoGravada: string | null): void {
    if (resolucaoGravada === null) {
      this.store.classificacao.registrarGravadaSemQuadro();
      return;
    }

    const cadastro = this.cadastroDePesos.leitura();
    if (cadastro.lido && cadastro.quadroDaResolucaoEscolhida.length > 0) {
      this.store.classificacao.registrarGravadaComQuadro(
        resolucaoGravada,
        cadastro.quadroDaResolucaoEscolhida,
      );
    } else {
      this.store.classificacao.marcarDesconhecida();
    }
  }
}
