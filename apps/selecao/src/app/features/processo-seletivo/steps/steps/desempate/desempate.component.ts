import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ComboboxComponent, type UiComboboxGroup } from '@uniplus/shared-ui/components';
import { isApiOk } from '@uniplus/shared-core/http';
import { FatoCandidatoView, FatosCandidatoApi } from '@uniplus/shared-data/configuracao';

import {
  alcanceDaCondicao,
  comOperador,
  comValorEscalar,
  comValoresDeLista,
  comparaComLista,
  fatosParaGatilho,
  operadoresDoFato,
  problemaDaCondicao,
  RESPOSTAS_BOOLEANAS,
  valorEscalarDe,
  valoresDeListaDe,
  type FatoEscolhivel,
} from '../../shared/gatilho-de-exigencia';
import { ProblemI18nService } from '@uniplus/shared-core/http';

import { CriterioDesempateConfigurado, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { regrasEscolhiveis } from '../classificacao/regra-escolhivel';
import {
  comoComandoDeCriteriosDesempate,
  desempateUsaEtapa,
  desempateUsaIdadeMinima,
  desempateTemShapeConhecido,
  desempateUsaPredicadoFato,
} from './desempate-para-comando';

const CRITERIO_VAZIO: CriterioDesempateConfigurado = {
  regraCodigo: '',
  regraVersao: '',
  etapaRef: '',
  idadeMinima: '',
  fato: '',
  operador: '',
  valor: '',
};

/**
 * Critérios de desempate (`PUT …/criterios-desempate`), na ordem em que serão
 * avaliados. A ordem é a posição na lista — reescrita a cada mover/remover —
 * e não um vocabulário institucional fixo: `CRITERIOS_DESEMPATE` com ids de 1
 * a 7 saiu inteiro, porque nenhum campo dele coincide com o contrato.
 */
@Component({
  selector: 'sel-step-desempate',
  standalone: true,
  templateUrl: './desempate.component.html',
  imports: [ComboboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(DesempateStepComponent)],
})
export class DesempateStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);

  private readonly fatosApi = inject(FatosCandidatoApi);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * O vocabulário de fatos do candidato, como o critério de desempate pode citá-lo.
   *
   * Não inclui fato de domínio dinâmico — modalidade, condição de atendimento —, e isso não é
   * omissão da tela: o comando de desempate resolve o vocabulário sem eles, de modo que citar
   * um aqui seria recusado como fato desconhecido. Oferecê-los daria ao operador uma escolha
   * que a gravação desfaz.
   */
  private readonly catalogoDeFatos = signal<readonly FatoCandidatoView[]>([]);

  readonly fatosEscolhiveis = computed(() => fatosParaGatilho(this.catalogoDeFatos()));

  private readonly fatoPorCodigo = computed(
    () => new Map(this.fatosEscolhiveis().map((fato) => [fato.codigo, fato])),
  );

  /**
   * A falha ao buscar o vocabulário de fatos, dita na tela em vez de engolida.
   *
   * Sem isto, um 500 passageiro deixava o catálogo vazio para sempre: todo critério por
   * predicado já configurado aparecia como fato fora do cadastro, `validate()` o recusava, e
   * não havia na tela nem a explicação nem um caminho de volta que não fosse recarregar a
   * página. É a mesma política dos catálogos de regra, que já tinham erro e nova tentativa.
   */
  readonly falhaDoCatalogoDeFatos = signal<string | null>(null);

  constructor() {
    this.catalogos.carregar();
    this.carregarFatos();
  }

  /** Busca o vocabulário de fatos. Exposto porque a tela oferece nova tentativa. */
  carregarFatos(): void {
    this.falhaDoCatalogoDeFatos.set(null);
    this.fatosApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (isApiOk(resultado)) {
            this.catalogoDeFatos.set(resultado.data);
            return;
          }

          this.falhaDoCatalogoDeFatos.set(this.problemI18n.resolve(resultado.problem).title);
        },
        error: () =>
          this.falhaDoCatalogoDeFatos.set(
            'Não foi possível carregar os dados do candidato que um critério pode citar. Tente novamente.',
          ),
      });
  }

  /** O fato citado por um critério, ou `undefined` quando ele saiu do catálogo. */
  fatoDoCriterio(codigo: string): FatoEscolhivel | undefined {
    return this.fatoPorCodigo().get(codigo);
  }

  /** As comparações que o domínio daquele fato admite. */
  operadoresDoCriterio(codigo: string): readonly { readonly valor: string; readonly rotulo: string }[] {
    const fato = this.fatoDoCriterio(codigo);
    return fato === undefined ? [] : operadoresDoFato(fato);
  }

  criterioComparaComLista(operador: string): boolean {
    return comparaComLista(operador);
  }

  ehBooleano(codigo: string): boolean {
    return this.fatoDoCriterio(codigo)?.tipoDominio === 'BOOLEANO';
  }

  valoresEscolhiveis(codigo: string): readonly string[] {
    return this.fatoDoCriterio(codigo)?.valores ?? [];
  }

  valoresDoFato(codigo: string): readonly UiComboboxGroup[] {
    const fato = this.fatoDoCriterio(codigo);
    if (fato === undefined || fato.valores.length === 0) return [];
    return [
      { label: fato.nome, options: fato.valores.map((valor) => ({ value: valor, label: valor })) },
    ];
  }

  valorDoCriterio(criterio: CriterioDesempateConfigurado): string {
    return valorEscalarDe(criterio);
  }

  valoresDoCriterio(criterio: CriterioDesempateConfigurado): readonly string[] {
    return valoresDeListaDe(criterio);
  }

  /** O que o predicado alcança — a mesma leitura que a exigência documental oferece. */
  alcanceDoCriterio(criterio: CriterioDesempateConfigurado): string {
    const fato = this.fatoDoCriterio(criterio.fato);
    return fato === undefined ? '' : alcanceDaCondicao(criterio, fato);
  }

  protected readonly respostasBooleanas = RESPOSTAS_BOOLEANAS;

  readonly criterios = computed(() => this.store.draft().desempate);

  readonly etapasReferenciaveis = computed(() =>
    this.store.draft().cronograma.etapas.filter((etapa) => etapa.id !== null),
  );

  /**
   * As regras que o seletor oferece: as do catálogo cujos argumentos esta tela sabe montar,
   * mais a que já está escolhida — mesmo desconhecida, ela precisa continuar visível, senão o
   * critério gravado aparece sem regra nenhuma.
   */
  regraEscolhivel(criterio: CriterioDesempateConfigurado) {
    return regrasEscolhiveis(
      this.catalogos
        .criteriosDesempate()
        .filter(
          (regra) =>
            desempateTemShapeConhecido(regra.codigo) || regra.codigo === criterio.regraCodigo,
        ),
      criterio.regraCodigo,
      criterio.regraVersao,
    );
  }

  /** Quantas regras do catálogo esta tela ainda não sabe configurar. */
  readonly regrasSemSuporte = computed(
    () =>
      this.catalogos.criteriosDesempate().filter((regra) => !desempateTemShapeConhecido(regra.codigo))
        .length,
  );

  usaEtapa(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaEtapa(criterio.regraCodigo);
  }

  usaIdadeMinima(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaIdadeMinima(criterio.regraCodigo);
  }

  usaPredicadoFato(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaPredicadoFato(criterio.regraCodigo);
  }

  acrescentar(): void {
    this.store.patchSection('desempate', [...this.criterios(), CRITERIO_VAZIO]);
    this.anunciar(`Critério ${this.criterios().length} acrescentado ao fim da lista.`);
  }

  remover(indice: number): void {
    this.store.patchSection(
      'desempate',
      this.criterios().filter((_, item) => item !== indice),
    );
    this.anunciar(`Critério ${indice + 1} removido.`);
    // O botão clicado sai do DOM junto com a linha e o foco cairia no corpo da página. Quem
    // navega por teclado perderia o lugar a cada remoção.
    this.focar(`desemp-remover-${Math.max(0, indice - 1)}`, 'desempate-acrescentar');
  }

  /**
   * Troca de posição dois critérios. A ordem É a regra — o primeiro da lista desempata
   * primeiro —, então mover não é enfeite, é configuração.
   *
   * O foco acompanha o critério movido, e não a posição: as linhas são reusadas por posição, e
   * sem isto o botão que continuava focado passava a operar OUTRO critério, sem nada anunciar.
   * No topo e no fim o botão correspondente fica indisponível, e o foco vai para o par dele.
   */
  mover(indice: number, delta: number): void {
    const ordem = [...this.criterios()];
    const destino = indice + delta;
    if (destino < 0 || destino >= ordem.length) return;

    [ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]];
    this.store.patchSection('desempate', ordem);

    this.anunciar(`Critério movido para a posição ${destino + 1} de ${ordem.length}.`);
    this.focar(
      delta < 0 ? `desemp-subir-${destino}` : `desemp-descer-${destino}`,
      delta < 0 ? `desemp-descer-${destino}` : `desemp-subir-${destino}`,
    );
  }

  /**
   * O que mudou na lista, para quem não vê a tela. Reordenar, acrescentar e remover eram
   * mudanças silenciosas para leitor de tela.
   */
  readonly anuncio = signal('');

  private anunciar(mensagem: string): void {
    this.anuncio.set(mensagem);
  }

  /**
   * Põe o foco no primeiro dos dois alvos que estiver disponível, DEPOIS de a lista ser
   * reprojetada.
   *
   * A espera é por renderização, não por microtask: o ciclo de detecção do Angular roda depois
   * que a fila de microtasks drena, então um `queueMicrotask` consultaria o DOM antigo — acha
   * o botão que está prestes a sair, põe o foco nele, e o re-render o arranca em seguida,
   * deixando o foco no corpo da página. É o caso de remover o último item, justamente aquele
   * em que a queda para "Acrescentar" existe.
   */
  private focar(alvo: string, alternativa: string): void {
    afterNextRender(
      () => {
        const disponivel = [alvo, alternativa]
          .map((id) => document.getElementById(id))
          .find(
            (elemento): elemento is HTMLElement =>
              elemento !== null && !(elemento as HTMLButtonElement).disabled,
          );
        disponivel?.focus();
      },
      { injector: this.injector },
    );
  }

  escolherRegra(indice: number, valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');
    // Trocar de regra some com o que a variante anterior usava — CA-05: só os
    // argumentos aplicáveis à regra atual permanecem.
    this.atualizar(indice, {
      regraCodigo: codigo,
      regraVersao: versao,
      etapaRef: '',
      idadeMinima: '',
      fato: '',
      operador: '',
      valor: '',
    });
  }

  alterarEtapaRef(indice: number, etapaRef: string): void {
    this.atualizar(indice, { etapaRef });
  }

  alterarIdadeMinima(indice: number, idadeMinima: string): void {
    this.atualizar(indice, { idadeMinima });
  }

  /**
   * Troca o fato do predicado. Operador e valor recomeçam: eles pertenciam ao domínio do fato
   * anterior, e carregá-los para outro domínio grava uma comparação que o servidor recusa.
   */
  alterarFato(indice: number, codigo: string): void {
    // Voltar o seletor para "escolha o fato" LIMPA o critério. Ignorar a escolha em branco
    // deixava a tela dizendo que não havia fato enquanto o rascunho continuava com o anterior
    // — e a gravação saía com um critério que o operador acreditava ter apagado.
    if (codigo === '') {
      this.atualizar(indice, { fato: '', operador: '', valor: '' });
      return;
    }

    const fato = this.fatoDoCriterio(codigo);
    if (fato === undefined) return;

    this.atualizar(indice, { fato: codigo, operador: operadoresDoFato(fato)[0].valor, valor: '' });
  }

  alterarOperador(indice: number, operador: string): void {
    const criterio = this.criterios()[indice];
    const fato = criterio === undefined ? undefined : this.fatoDoCriterio(criterio.fato);
    if (criterio === undefined || fato === undefined) return;

    this.atualizar(indice, comOperador(criterio, fato, operador));
  }

  alterarValor(indice: number, valor: string): void {
    const criterio = this.criterios()[indice];
    const fato = criterio === undefined ? undefined : this.fatoDoCriterio(criterio.fato);
    if (criterio === undefined || fato === undefined) return;

    this.atualizar(indice, comValorEscalar(criterio, fato, valor));
  }

  alterarValores(indice: number, valores: readonly string[]): void {
    const criterio = this.criterios()[indice];
    if (criterio === undefined) return;

    this.atualizar(indice, comValoresDeLista(criterio, valores));
  }

  private atualizar(indice: number, patch: Partial<CriterioDesempateConfigurado>): void {
    this.store.patchSection(
      'desempate',
      this.criterios().map((criterio, item) =>
        item === indice ? { ...criterio, ...patch } : criterio,
      ),
    );
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validate().valid) return null;

    const criterios = this.criterios();
    if (criterios.length === 0) {
      return {
        titulo: 'Confirmar a ausência de critérios de desempate',
        aviso: 'Nenhum critério de desempate será declarado para este processo.',
        rotuloDeConfirmar: 'Confirmar sem critérios',
        itens: [{ rotulo: 'Critérios de desempate', valor: 'Nenhum' }],
      };
    }

    return {
      titulo: 'Confirmar os critérios de desempate',
      aviso: 'A ordem exibida é a ordem em que os critérios serão avaliados.',
      rotuloDeConfirmar: 'Gravar critérios',
      itens: criterios.map((criterio, indice) => ({
        rotulo: `${indice + 1}º critério`,
        valor: criterio.regraCodigo,
      })),
    };
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const idsDeEtapa = new Set(this.etapasReferenciaveis().map((etapa) => etapa.id));
    const messages: string[] = [];

    this.criterios().forEach((criterio, indice) => {
      const posicao = indice + 1;
      if (!criterio.regraCodigo) {
        messages.push(`Critério de desempate ${posicao}: selecione uma regra.`);
        return;
      }

      if (this.usaEtapa(criterio)) {
        if (criterio.etapaRef === '') {
          messages.push(`Critério de desempate ${posicao}: selecione a etapa referenciada.`);
        } else if (!idsDeEtapa.has(criterio.etapaRef)) {
          messages.push(
            `Critério de desempate ${posicao}: a etapa referenciada não existe mais no cronograma.`,
          );
        }
      } else if (this.usaIdadeMinima(criterio)) {
        const idade = inteiro(criterio.idadeMinima);
        if (idade === null || idade <= 0) {
          messages.push(
            `Critério de desempate ${posicao}: informe a idade mínima, maior que zero.`,
          );
        }
      } else if (this.usaPredicadoFato(criterio)) {
        // Espelha o validador do domínio — fato do vocabulário, operador que o domínio admite,
        // valor dentro do domínio declarado. Conferir só "os três campos estão preenchidos"
        // aprovava texto que o servidor recusava sem dizer qual das três coisas estava errada.
        const problema = problemaDaCondicao(criterio, this.fatoPorCodigo());
        if (problema !== null) {
          messages.push(`Critério de desempate ${posicao}: ${problema}.`);
        }
      }
    });

    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /** Grava a coleção inteira, na ordem em que está na tela (CA-05). */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          'O cadastro do processo precisa estar concluído antes de configurar o desempate.',
        ],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const resultado = await this.cadastro.definirCriteriosDesempate(
        processoId,
        comoComandoDeCriteriosDesempate(this.criterios()),
      );

      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };

      if (!resultado.ok) {
        return { valid: false, messages: [this.problemI18n.resolve(resultado.problem).title] };
      }

      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }
}

function inteiro(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : null;
}
