import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
} from '@angular/core';
import {
  ProblemI18nService,
  type ProblemDetails,
  type ProblemValidationError,
} from '@uniplus/shared-core/http';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

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
import { leituraDoCampoDecimal } from '../../shared/numero-do-campo';
import { resumoDaRecusa } from '../../shared/resumo-da-recusa';
import { AcompanhamentoDoCadastroDePesos } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import {
  classificacaoUsaFormulaLocal,
  comoComandoDeClassificacao,
  divisorDaMediaValido,
  eliminacaoExigeBaseadoEmEnem,
  eliminacaoUsaAreaEMinimo,
  eliminacaoUsaEtapaENotaMinima,
  ehCampoDaResolucao,
  exigeResolucaoPesoAreaEnem,
  mensagensDeClassificacaoBase,
  TEXTO_DA_PENDENCIA_DA_RESOLUCAO,
} from '../classificacao/classificacao-para-comando';
import {
  lerChaveDaRegra,
  regrasEscolhiveis,
  rotuloDaRegraEscolhida,
} from '../classificacao/regra-escolhivel';
import {
  areasComunsAoQuadro,
  corteDaArea,
  ordemDasAreas,
  type ColunaDoQuadro,
  type GrupoDoQuadro,
} from '../../shared/quadro-de-pesos';
import {
  conferirDesempateGravado,
  recusaDaClassificacaoPeloDesempate,
  recusaPorCriterioGravadoSemQuadro,
  rotulosDasAreas,
  type PendenciaDoCriterioGravado,
} from '../desempate/quadro-do-desempate';

const REGRA_ELIMINACAO_VAZIA: RegraEliminacaoConfigurada = {
  regraCodigo: '',
  regraVersao: '',
  etapaRef: '',
  notaMinima: '',
  minimo: '',
  areaCodigo: '',
};

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
  imports: [ValorEmConsultaComponent],
  templateUrl: './eliminacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(EliminacaoStepComponent)],
})
export class EliminacaoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly cadastroDePesos = inject(AcompanhamentoDoCadastroDePesos);
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
  readonly etapasReferenciaveis = computed(() =>
    this.store
      .draft()
      .cronograma.etapas.filter(
        (etapa): etapa is EtapaPontuada & { id: string } => etapa.id !== null,
      ),
  );

  readonly regrasDoCatalogo = computed(() => this.catalogos.regrasEliminacao());

  regraEscolhivel(regra: RegraEliminacaoConfigurada) {
    return regrasEscolhiveis(this.regrasDoCatalogo(), regra.regraCodigo, regra.regraVersao);
  }

  usaEtapaENotaMinima(regra: RegraEliminacaoConfigurada): boolean {
    return eliminacaoUsaEtapaENotaMinima(regra.regraCodigo);
  }

  usaAreaEMinimo(regra: RegraEliminacaoConfigurada): boolean {
    return eliminacaoUsaAreaEMinimo(regra.regraCodigo);
  }

  /**
   * O quadro contra o qual o servidor confere o corte: o que a gravação da classificação copia do
   * cadastro para a resolução do rascunho. Com o cadastro ainda não lido, a cópia gravada vale só
   * se for da mesma resolução — é o caso do processo só para consulta. `null` quando não se sabe;
   * `'sem-quadro'` quando a classificação não usa a média ponderada do ENEM.
   */
  private readonly quadroDoCorte = computed<readonly GrupoDoQuadro[] | 'sem-quadro' | null>(
    () => {
      const classificacao = this.classificacao();
      if (!exigeResolucaoPesoAreaEnem(classificacao)) return 'sem-quadro';
      const cadastro = this.cadastroDePesos.leitura();
      if (cadastro.lido) return cadastro.quadroDaResolucaoEscolhida;
      const gravada = this.store.classificacaoGravada();
      return gravada.estado === 'com-quadro' &&
        gravada.resolucao === classificacao.resolucaoPesoAreaEnem
        ? gravada.grupos
        : null;
    },
  );

  /**
   * As áreas que um corte pode citar: com quadro, as que estão em todos os grupos dele; sem quadro,
   * qualquer área do ENEM; `null` enquanto o quadro não é conhecido.
   */
  readonly areasDoCorte = computed<readonly ColunaDoQuadro[] | null>(() => {
    const quadro = this.quadroDoCorte();
    const canonicas = this.cadastroDePesos.leitura().canonicas;
    if (quadro === 'sem-quadro') return canonicas;
    return quadro === null ? null : areasComunsAoQuadro(quadro, ordemDasAreas(canonicas));
  });

  private readonly gruposDoQuadro = computed(() => {
    const quadro = this.quadroDoCorte();
    return quadro === 'sem-quadro' || quadro === null ? [] : quadro;
  });

  /** As áreas oferecidas à regra: as do corte, menos as que outro corte já cita (uma por área). */
  areasEscolhiveis(indice: number): readonly ColunaDoQuadro[] {
    const citadasPorOutras = new Set(
      this.regras()
        .filter((regra, item) => item !== indice && this.usaAreaEMinimo(regra))
        .map((regra) => regra.areaCodigo),
    );
    const oferecidas = (this.areasDoCorte() ?? []).filter(
      (area) => !citadasPorOutras.has(area.codigo),
    );
    // A área gravada aparece mesmo fora das oferecidas: o operador vê o que está configurado.
    const gravada = this.regras()[indice]?.areaCodigo ?? '';
    return gravada === '' || oferecidas.some((area) => area.codigo === gravada)
      ? oferecidas
      : [{ codigo: gravada, rotulo: this.rotuloDaArea(gravada) }, ...oferecidas];
  }

  rotuloDaArea(codigo: string): string {
    return (
      rotulosDasAreas(this.cadastroDePesos.leitura().canonicas, this.gruposDoQuadro()).get(
        codigo,
      ) ?? codigo
    );
  }

  /** A regra como se lê em consulta, com o rótulo de cada escolha. */
  leituraDaRegra(regra: RegraEliminacaoConfigurada) {
    const etapa = this.etapasReferenciaveis().find((item) => item.id === regra.etapaRef);
    return {
      regra: rotuloDaRegraEscolhida(this.regraEscolhivel(regra)),
      etapa: etapa === undefined ? null : etapa.nome || 'Etapa sem nome',
      notaMinima: leituraDoCampoDecimal(regra.notaMinima),
      area: regra.areaCodigo === '' ? null : this.rotuloDaArea(regra.areaCodigo),
      minimo: leituraDoCampoDecimal(regra.minimo),
    };
  }

  /** O rótulo completo do mínimo, com a área: dois cortes lado a lado não se confundem. */
  rotuloDoMinimo(regra: RegraEliminacaoConfigurada): string {
    return regra.areaCodigo === ''
      ? 'Nota mínima'
      : `Nota mínima em ${this.rotuloDaArea(regra.areaCodigo)}`;
  }

  /** O corte que a resolução dá à área, quando a classificação tem quadro e o cadastro foi lido. */
  corteSugerido(regra: RegraEliminacaoConfigurada): number | null {
    const grupos = this.gruposDoQuadro();
    if (regra.areaCodigo === '' || grupos.length === 0) return null;
    return corteDaArea(grupos, regra.areaCodigo);
  }

  /**
   * As recusas do servidor a um campo de uma regra, por `índice.campo`. Ficam junto do campo até
   * a regra mudar ou a gravação seguinte responder.
   */
  readonly recusasPorCampo = signal<ReadonlyMap<string, string>>(new Map());

  recusaDoCampo(indice: number, campo: CampoDoCorte): string | null {
    return this.recusasPorCampo().get(`${indice}.${campo}`) ?? null;
  }

  /** O `aria-describedby` do campo: a recusa, quando há, e a dica, quando há. */
  descritoPor(indice: number, campo: CampoDoCorte, dica: string | null): string | null {
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
    // navega por teclado perderia o lugar a cada remoção.
    //
    // A espera é por renderização, não por microtask: o ciclo de detecção do Angular roda
    // depois que a fila de microtasks drena, e consultar o DOM antigo acharia o botão que está
    // prestes a sair — pôr o foco nele e vê-lo ser arrancado em seguida é o mesmo que não
    // fazer nada. Removida a última regra, é a queda para "Acrescentar" que vale.
    afterNextRender(
      () => {
        const anterior = document.getElementById(`elim-remover-${Math.max(0, indice - 1)}`);
        (anterior ?? document.getElementById('eliminacao-acrescentar'))?.focus();
      },
      { injector: this.injector },
    );
  }

  escolherRegra(indice: number, valor: string): void {
    const { codigo, versao } = lerChaveDaRegra(valor);
    this.atualizarRegra(indice, {
      regraCodigo: codigo,
      regraVersao: versao,
      // Trocar de regra some com o que não se aplica mais ao shape novo — o
      // operador não vê um campo preenchido que a regra escolhida ignora.
      etapaRef: '',
      notaMinima: '',
      minimo: '',
      areaCodigo: '',
    });
  }

  /**
   * O corte do cadastro é sugestão, e a regra é a norma aplicada: o mínimo sugerido só entra
   * quando o operador ainda não informou um. O mínimo igual à sugestão da área anterior veio dela,
   * e não do operador, então também é trocado.
   */
  escolherArea(indice: number, areaCodigo: string): void {
    const regra = this.regras()[indice];
    const anterior = this.corteSugerido(regra);
    const sugerido = this.corteSugerido({ ...regra, areaCodigo });
    const minimo = regra.minimo.trim();
    const naoInformado = minimo === '' || (anterior !== null && minimo === String(anterior));
    this.atualizarRegra(indice, {
      areaCodigo,
      ...(naoInformado ? { minimo: sugerido === null ? '' : String(sugerido) } : {}),
    });
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
    if (restantes.length < this.recusasPorCampo().size) this.recusasPorCampo.set(new Map(restantes));
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
    const avisoDoDesempate = this.avisoDoDesempatePorArea();

    const classificacao = this.store.draft().classificacao;
    const local = this.usaFormulaLocal();

    return {
      titulo: 'Confirmar a classificação do processo',
      aviso: [
        'A classificação, a precisão e a eliminação serão gravadas juntas nesta confirmação.',
        ...avisoDoDesempate,
      ].join(' '),
      rotuloDeConfirmar: 'Gravar classificação',
      itens: [
        { rotulo: 'Regra de cálculo', valor: classificacao.regraCalculoCodigo },
        {
          rotulo: 'Arredondamento',
          valor: local
            ? `${classificacao.regraArredondamentoCodigo} — ${classificacao.casasArredondamento} casas`
            : 'não se aplica (classificação importada)',
        },
        { rotulo: 'Ordem de alocação', valor: classificacao.regraOrdemAlocacaoCodigo },
        { rotulo: 'Número de opções de curso', valor: classificacao.nOpcoesAlocacao },
        { rotulo: 'Baseada em ENEM', valor: classificacao.baseadoEmEnem ? 'Sim' : 'Não' },
        {
          rotulo: 'Resolução de Peso por Área',
          valor: exigeResolucaoPesoAreaEnem(classificacao)
            ? classificacao.resolucaoPesoAreaEnem
            : 'não se aplica',
        },
        {
          rotulo: 'Regras de eliminação',
          valor: local
            ? `${classificacao.regrasEliminacao.length} regra(s)`
            : 'nenhuma (classificação importada)',
        },
      ],
    };
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

    const idsDeEtapa = new Set(this.etapasReferenciaveis().map((etapa) => etapa.id));

    this.regras().forEach((regra, indice) => {
      const posicao = indice + 1;
      if (!regra.regraCodigo) {
        messages.push(`Regra de eliminação ${posicao}: selecione uma regra.`);
        return;
      }

      if (this.usaEtapaENotaMinima(regra)) {
        if (regra.etapaRef === '') {
          messages.push(`Regra de eliminação ${posicao}: selecione a etapa referenciada.`);
        } else if (!idsDeEtapa.has(regra.etapaRef)) {
          messages.push(
            `Regra de eliminação ${posicao}: a etapa referenciada não existe mais no cronograma.`,
          );
        }
        if (!decimalValido(regra.notaMinima)) {
          messages.push(`Regra de eliminação ${posicao}: informe a nota mínima.`);
        }
      } else if (this.usaAreaEMinimo(regra)) {
        messages.push(...this.mensagensDoCorte(regra, indice));
      }

      if (eliminacaoExigeBaseadoEmEnem(regra.regraCodigo) && !classificacao.baseadoEmEnem) {
        messages.push(
          `Regra de eliminação ${posicao}: só se aplica quando a classificação está marcada como baseada em ENEM (passo Fórmula).`,
        );
      }
    });

    return messages.length ? { valid: false, messages } : { valid: true };
  }

  private mensagensDoCorte(regra: RegraEliminacaoConfigurada, indice: number): string[] {
    const posicao = indice + 1;
    const mensagens: string[] = [];
    if (regra.areaCodigo === '') {
      mensagens.push(`Regra de eliminação ${posicao}: selecione a área do ENEM.`);
    } else {
      const rotulo = this.rotuloDaArea(regra.areaCodigo);
      const repetida = this.regras().some(
        (outra, item) =>
          item < indice && this.usaAreaEMinimo(outra) && outra.areaCodigo === regra.areaCodigo,
      );
      if (repetida) {
        mensagens.push(`Regra de eliminação ${posicao}: ${rotulo} já tem um corte em outra regra.`);
      }
      const areas = this.areasDoCorte();
      if (areas !== null && !areas.some((area) => area.codigo === regra.areaCodigo)) {
        mensagens.push(
          `Regra de eliminação ${posicao}: ${rotulo} não está em todos os grupos da resolução de Peso por Área escolhida.`,
        );
      }
    }
    if (!decimalValido(regra.minimo)) {
      mensagens.push(`Regra de eliminação ${posicao}: informe a nota mínima.`);
    }
    return mensagens;
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
      const gravados = this.store.criteriosDesempateGravados();
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
          this.store.descartarRecusasDaClassificacao();
          this.registrarQuadroCongelado(comando.resolucaoPesoAreaEnem ?? null);
        } else if (resposta.inconclusiva) {
          // O servidor pode ter gravado — com ou sem quadro —, e o que ele tem fica desconhecido.
          this.store.marcarClassificacaoDesconhecida();
        }
        return resposta;
      });

      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!resultado.ok) {
        return { valid: false, messages: this.mensagensDaRecusa(resultado.problem) };
      }
      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
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
      this.store.recusarPeloDesempate(
        peloDesempate.find((recusa) => recusa !== null) ?? null,
        this.cadastroDePesos.leitura().pedida,
      );
      this.store.recusaDaResolucaoPesoAreaEnem.set(
        daResolucao === undefined ? null : mensagemDaRecusaDaResolucao(daResolucao),
      );
    }

    return resumoDaRecusa(
      problema,
      (erro) =>
        recusaDaEliminacao(erro) ??
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
      this.store.registrarClassificacaoGravadaSemQuadro();
      return;
    }

    const cadastro = this.cadastroDePesos.leitura();
    if (cadastro.lido && cadastro.quadroDaResolucaoEscolhida.length > 0) {
      this.store.registrarClassificacaoGravadaComQuadro(
        resolucaoGravada,
        cadastro.quadroDaResolucaoEscolhida,
      );
    } else {
      this.store.marcarClassificacaoDesconhecida();
    }
  }
}

const PREFIXO_DA_RECUSA = 'uniplus.selecao.configuracao_classificacao.';

/**
 * O que a tela diz para cada recusa da resolução. O texto é daqui, e não o `message` que o
 * servidor devolve: a mensagem ao operador é contrato da tela, e o `code` é o que é estável.
 */
const MENSAGEM_POR_CODIGO_DA_RESOLUCAO: ReadonlyMap<string, string> = new Map([
  [
    `${PREFIXO_DA_RECUSA}resolucao_peso_area_enem_obrigatoria`,
    TEXTO_DA_PENDENCIA_DA_RESOLUCAO.obrigatoria.campo,
  ],
  [
    `${PREFIXO_DA_RECUSA}resolucao_peso_area_enem_indevida`,
    'A resolução de Peso por Área só se aplica à classificação baseada em ENEM com a média ponderada.',
  ],
  [
    `${PREFIXO_DA_RECUSA}resolucao_peso_area_enem_invalida`,
    'O nome da resolução de Peso por Área não é válido. Escolha a resolução na lista.',
  ],
  [
    `${PREFIXO_DA_RECUSA}resolucao_peso_area_enem_nao_encontrada`,
    'A resolução escolhida não está no cadastro de Peso por Área. Escolha outra.',
  ],
  [
    `${PREFIXO_DA_RECUSA}resolucao_peso_area_enem_incompleta`,
    'A resolução escolhida não tem pesos cadastrados para todos os grupos de área. Complete-a no cadastro de Peso por Área ou escolha outra.',
  ],
  [
    `${PREFIXO_DA_RECUSA}quadro_peso_area_enem_vazio`,
    'A resolução escolhida não tem nenhum grupo de área no cadastro de Peso por Área.',
  ],
  [
    `${PREFIXO_DA_RECUSA}quadro_peso_area_enem_grupo_repetido`,
    'A resolução escolhida repete um grupo de área no cadastro de Peso por Área.',
  ],
]);

/**
 * O que a tela diz para cada recusa das regras de eliminação. O servidor aponta a regra pelo campo
 * `regrasEliminacao[i]`, e a tela a nomeia pela posição, como na própria validação.
 */
const RECUSA_DA_ELIMINACAO: ReadonlyMap<string, string> = new Map([
  [
    `${PREFIXO_DA_RECUSA}corte_em_area_repetido`,
    'a área já tem um corte em outra regra; deixe um corte por área',
  ],
  [
    `${PREFIXO_DA_RECUSA}corte_em_area_fora_do_quadro`,
    'a área não está em todos os grupos da resolução de Peso por Área; escolha outra área ou outra resolução no passo Fórmula',
  ],
  [
    'uniplus.selecao.regra_eliminacao.area_invalida',
    'a área do corte não é uma área do ENEM válida; escolha a área na lista',
  ],
  [
    'uniplus.selecao.regra_eliminacao.area_e_minimo_obrigatorios',
    'o corte por área exige a área do ENEM e a nota mínima',
  ],
  [
    'uniplus.selecao.processo_seletivo.eliminacao_enem_fora_de_processo_enem',
    'as regras de eliminação do ENEM só se aplicam à classificação baseada em ENEM; marque o ENEM no passo Fórmula ou retire essas regras',
  ],
]);

type CampoDoCorte = 'area' | 'minimo';

const CAMPO_DO_CORTE: Readonly<Record<string, CampoDoCorte>> = {
  areaCodigo: 'area',
  minimo: 'minimo',
};

/**
 * O campo de cada recusa que o servidor aponta só pela regra, sem sufixo: a repetição da área é
 * recusada em `regrasEliminacao[i]`, e é o campo da área que a corrige.
 */
const CAMPO_DA_RECUSA_SEM_SUFIXO: Readonly<Record<string, CampoDoCorte>> = {
  [`${PREFIXO_DA_RECUSA}corte_em_area_repetido`]: 'area',
};

/** As recusas que o servidor aponta num campo de uma regra, por `índice.campo`. */
function recusasDoCorte(
  erros: readonly { readonly field: string; readonly code: string }[],
): ReadonlyMap<string, string> {
  const recusas = new Map<string, string>();
  for (const erro of erros) {
    const [, indice, nome] = /^regrasEliminacao\[(\d+)\](?:\.(\w+))?$/.exec(erro.field) ?? [];
    const campo =
      nome === undefined ? CAMPO_DA_RECUSA_SEM_SUFIXO[erro.code] : CAMPO_DO_CORTE[nome];
    const texto = RECUSA_DA_ELIMINACAO.get(erro.code);
    if (indice === undefined || campo === undefined || texto === undefined) continue;
    recusas.set(`${indice}.${campo}`, `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`);
  }
  return recusas;
}

function recusaDaEliminacao(erro: { readonly field: string; readonly code: string }): string | null {
  const texto = RECUSA_DA_ELIMINACAO.get(erro.code);
  if (texto === undefined) return null;
  const indice = /^regrasEliminacao\[(\d+)\]/.exec(erro.field)?.[1];
  return indice === undefined
    ? `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`
    : `Regra de eliminação ${Number(indice) + 1}: ${texto}.`;
}

const MENSAGEM_DE_RECUSA_DESCONHECIDA =
  'O servidor recusou a resolução de Peso por Área escolhida. Confira o cadastro de Peso por Área ou escolha outra.';

function mensagemDaRecusaDaResolucao(erro: Pick<ProblemValidationError, 'code'>): string {
  return MENSAGEM_POR_CODIGO_DA_RESOLUCAO.get(erro.code) ?? MENSAGEM_DE_RECUSA_DESCONHECIDA;
}

function decimalValido(texto: string): boolean {
  const limpo = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpo);
}
