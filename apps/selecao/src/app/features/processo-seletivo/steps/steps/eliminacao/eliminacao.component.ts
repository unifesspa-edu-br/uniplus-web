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
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import {
  classificacaoUsaFormulaLocal,
  comoComandoDeClassificacao,
  divisorDaMediaValido,
  eliminacaoExigeBaseadoEmEnem,
  eliminacaoUsaEtapaENotaMinima,
  eliminacaoUsaMinimo,
  exigeResolucaoPesoAreaEnem,
  mensagensDeClassificacaoBase,
  TEXTO_DA_PENDENCIA_DA_RESOLUCAO,
} from '../classificacao/classificacao-para-comando';
import { regrasEscolhiveis } from '../classificacao/regra-escolhivel';

const REGRA_ELIMINACAO_VAZIA: RegraEliminacaoConfigurada = {
  regraCodigo: '',
  regraVersao: '',
  etapaRef: '',
  notaMinima: '',
  minimo: '',
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
  templateUrl: './eliminacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(EliminacaoStepComponent)],
})
export class EliminacaoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly releitura = inject(ReleituraDoSnapshot);
  private readonly problemI18n = inject(ProblemI18nService);

  constructor() {
    this.catalogos.carregar();
  }

  readonly usaFormulaLocal = computed(() =>
    classificacaoUsaFormulaLocal(this.store.draft().classificacao.regraCalculoCodigo),
  );

  readonly regras = computed(() => this.store.draft().classificacao.regrasEliminacao);

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

  usaMinimo(regra: RegraEliminacaoConfigurada): boolean {
    return eliminacaoUsaMinimo(regra.regraCodigo);
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
    const [codigo = '', versao = ''] = valor.split('|');
    this.atualizarRegra(indice, {
      regraCodigo: codigo,
      regraVersao: versao,
      // Trocar de regra some com o que não se aplica mais ao shape novo — o
      // operador não vê um campo preenchido que a regra escolhida ignora.
      etapaRef: '',
      notaMinima: '',
      minimo: '',
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
    this.store.patchObjectSection('classificacao', {
      regrasEliminacao: this.regras().map((regra, item) =>
        item === indice ? { ...regra, ...patch } : regra,
      ),
    });
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validate().valid) return null;

    const classificacao = this.store.draft().classificacao;
    const local = this.usaFormulaLocal();

    return {
      titulo: 'Confirmar a classificação do processo',
      aviso: 'A classificação, a precisão e a eliminação serão gravadas juntas nesta confirmação.',
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
      ...mensagensDeClassificacaoBase(classificacao, this.catalogos.resolucaoForaDoCadastro),
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
      } else if (this.usaMinimo(regra)) {
        if (!decimalValido(regra.minimo)) {
          messages.push(`Regra de eliminação ${posicao}: informe o mínimo exigido.`);
        }
      }

      if (eliminacaoExigeBaseadoEmEnem(regra.regraCodigo) && !classificacao.baseadoEmEnem) {
        messages.push(
          `Regra de eliminação ${posicao}: só se aplica quando a classificação está marcada como baseada em ENEM (passo Fórmula).`,
        );
      }
    });

    return messages.length ? { valid: false, messages } : { valid: true };
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

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const comando = comoComandoDeClassificacao(this.store.draft().classificacao);
      this.releitura.descartarLeiturasEmCurso();
      const resultado = await this.cadastro.definirClassificacao(processoId, comando);

      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };

      if (!resultado.ok) {
        // Sem resposta conclusiva o servidor pode ter gravado — e copiado o quadro de novo.
        if (
          resultado.inconclusiva &&
          this.envolveResolucao(comando.resolucaoPesoAreaEnem ?? null)
        ) {
          this.store.quadroPesoAreaEnemDesatualizado.set(true);
        }
        return { valid: false, messages: this.mensagensDaRecusa(resultado.problem) };
      }

      this.store.recusaDaResolucaoPesoAreaEnem.set(null);
      await this.acompanharQuadroCongelado(comando.resolucaoPesoAreaEnem ?? null);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * O resumo da recusa: a recusa da resolução, cada uma uma vez, com o texto da tela e o passo onde
   * corrigir; e o título da raiz, pelo `ProblemI18nService`, quando há erro em outro campo ou
   * nenhum erro de campo. Recusa só da resolução não repete o título, que fala do mesmo erro.
   *
   * A recusa da resolução fica guardada para aparecer sob o campo, no passo da fórmula. Uma
   * recusa sem ela não a apaga: o servidor recusa outros campos antes de chegar a julgar a
   * resolução, e só a gravação que dá certo prova que ela passou.
   */
  private mensagensDaRecusa(problema: ProblemDetails): string[] {
    const erros = problema.errors ?? [];
    const daResolucao = [...new Set(erros.filter(ehDaResolucao).map(mensagemDaRecusaDaResolucao))];
    if (daResolucao.length > 0) this.store.recusaDaResolucaoPesoAreaEnem.set(daResolucao[0]);

    const haOutraRecusa = daResolucao.length === 0 || erros.some((erro) => !ehDaResolucao(erro));
    return [
      ...daResolucao.map((mensagem) => `Resolução de Peso por Área, no passo Fórmula: ${mensagem}`),
      ...(haOutraRecusa ? [this.problemI18n.resolve(problema).title] : []),
    ];
  }

  /**
   * A gravação copiou o quadro da resolução de novo no servidor, e a Fórmula mostra o que o
   * processo congelou. Na varredura da publicação a referência só fica marcada como velha: a
   * página relê o detalhe uma vez, no fim da varredura, em vez de uma leitura por gravação.
   */
  private async acompanharQuadroCongelado(resolucaoGravada: string | null): Promise<void> {
    if (!this.envolveResolucao(resolucaoGravada)) {
      this.store.quadroPesoAreaEnemDesatualizado.set(false);
      return;
    }

    if (this.store.travamentoDeOrquestracao()) {
      this.store.quadroPesoAreaEnemDesatualizado.set(true);
      return;
    }

    await this.releitura.reler();
  }

  /** Sem resolução, nem enviada nem congelada, a gravação não mexe em quadro nenhum. */
  private envolveResolucao(resolucaoEnviada: string | null): boolean {
    return (
      resolucaoEnviada !== null ||
      (this.store.quadroPesoAreaEnemCongelado()?.resolucao ?? null) !== null
    );
  }
}

/** O campo da resolução nas recusas do servidor, comparado sem caixa. */
const CAMPO_RESOLUCAO = 'resolucaopesoareaenem';

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

const MENSAGEM_DE_RECUSA_DESCONHECIDA =
  'O servidor recusou a resolução de Peso por Área escolhida. Confira o cadastro de Peso por Área ou escolha outra.';

function ehDaResolucao(erro: ProblemValidationError): boolean {
  return ultimoSegmento(erro.field) === CAMPO_RESOLUCAO;
}

function mensagemDaRecusaDaResolucao(erro: ProblemValidationError): string {
  return MENSAGEM_POR_CODIGO_DA_RESOLUCAO.get(erro.code) ?? MENSAGEM_DE_RECUSA_DESCONHECIDA;
}

/**
 * O nome do campo sem prefixo de caminho (`$.`, `request.`) e sem caixa — a recusa do domínio e a
 * do model binding nomeiam o mesmo campo de formas diferentes.
 */
function ultimoSegmento(campo: string): string {
  return (campo.split('.').at(-1) ?? campo).toLowerCase();
}

function decimalValido(texto: string): boolean {
  const limpo = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpo);
}
