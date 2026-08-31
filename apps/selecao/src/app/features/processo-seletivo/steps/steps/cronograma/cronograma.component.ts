import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';

import type {
  EtapaPontuada,
  FaseDoCronograma,
  StepValidation,
} from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { campoDoInstante, instanteDoCampo } from '../../shared/fuso-institucional';
import { etapasDe } from '../../shared/hidratacao';
import { CatalogosDoCronogramaService } from './catalogos-do-cronograma.service';
import {
  componeNota,
  exigenciasDe,
  problemasDoCronograma,
  renumerar,
  type ExigenciasDaFase,
} from './cronograma-do-certame';
import { comoComandoDeEtapa, comoComandoDeFase } from './cronograma-para-comando';

/**
 * Recusa do servidor quando a nova ordem troca a posição entre fases que já
 * existem, formando um ciclo que uma única gravação não consegue aplicar.
 */
const PERMUTACAO_DE_ORDEM = 'uniplus.selecao.fase_cronograma.permutacao_de_ordem_nao_suportada';

/** Caráter de uma etapa, com o rótulo que o operador lê. */
const CARATERES = [
  { valor: 'classificatoria', rotulo: 'Classificatória' },
  { valor: 'eliminatoria', rotulo: 'Eliminatória' },
  { valor: 'ambas', rotulo: 'Classificatória e eliminatória' },
] as const;

/**
 * A fase na tela: o que o operador declarou, junto do que o catálogo congela
 * sobre ela. O componente monta este par uma vez e o template lê os dois lados
 * sem procurar a fase canônica a cada célula.
 */
interface FaseNaLinhaDoTempo {
  readonly fase: FaseDoCronograma;
  readonly canonica: FaseCanonicaDto | undefined;
  readonly exigencias: ExigenciasDaFase | null;
  readonly indice: number;
}

@Component({
  selector: 'sel-step-cronograma',
  imports: [FormsModule],
  templateUrl: './cronograma.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CatalogosDoCronogramaService, provePassoDoWizard(CronogramaStepComponent)],
})
export class CronogramaStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly api = inject(ProcessosSeletivosApi);

  readonly careteres = CARATERES;

  /** Fase escolhida no seletor, ainda não acrescentada. */
  readonly faseAAcrescentar = signal('');

  /**
   * Orientação da recusa de permutação, quando a reordenação pedida forma um
   * ciclo que o servidor não persiste numa chamada só.
   */
  readonly avisoDeReordenacao = signal<string | null>(null);

  constructor() {
    this.catalogos.carregar();
  }

  private get cronograma(): { fases: FaseDoCronograma[]; etapas: EtapaPontuada[] } {
    const { fases, etapas } = this.store.draft().cronograma;
    return { fases: [...fases], etapas: [...etapas] };
  }

  readonly linhaDoTempo = computed<readonly FaseNaLinhaDoTempo[]>(() => {
    const fasePorId = this.catalogos.fasePorId();
    return this.store.draft().cronograma.fases.map((fase, indice) => {
      const canonica = fasePorId.get(fase.faseCanonicaId);
      return {
        fase,
        canonica,
        exigencias: canonica === undefined ? null : exigenciasDe(canonica),
        indice,
      };
    });
  });

  readonly etapas = computed(() => this.store.draft().cronograma.etapas);

  /**
   * Fases que ainda cabem no cronograma, na ordem que as precedências sugerem —
   * uma fase canônica entra uma vez só.
   */
  readonly fasesDisponiveis = computed(() => {
    const usadas = new Set(this.store.draft().cronograma.fases.map((fase) => fase.faseCanonicaId));
    return this.catalogos.fasesEmOrdemSugerida().filter((fase) => !usadas.has(fase.id));
  });

  /** A fase que agrupa etapas, quando está na linha do tempo. */
  readonly faseQueAgrupaEtapas = computed(() =>
    this.linhaDoTempo().find((item) => item.exigencias?.agrupaEtapas === true),
  );

  /** O que impede a gravação, como a validação do passo o relata. */
  readonly problemas = computed(() =>
    problemasDoCronograma(
      this.store.draft().cronograma.fases,
      this.etapas(),
      this.catalogos.fasePorId(),
      this.catalogos.precedencias(),
    ),
  );

  /**
   * Tipos que o seletor de uma etapa oferece: os ativos, mais o que ela já
   * referencia quando esse saiu de atividade.
   *
   * Um tipo inativo não volta a ser escolha nova, mas continua descrevendo a
   * etapa que o gravou. Sem ele na lista, nenhuma opção casa e o campo aparece
   * em branco — o operador não veria qual classificação está configurada, e
   * gravaria por cima dela sem perceber.
   */
  tiposEscolhiveisPara(etapa: EtapaPontuada): readonly { id: string; nome: string }[] {
    const ativos = this.catalogos
      .tiposEtapaAtivos()
      .map((tipo) => ({ id: tipo.id, nome: tipo.nome }));
    if (
      etapa.tipoEtapaOrigemId === '' ||
      ativos.some((tipo) => tipo.id === etapa.tipoEtapaOrigemId)
    ) {
      return ativos;
    }

    const rotulo = this.catalogos.rotuloDoTipoEtapa().get(etapa.tipoEtapaOrigemId);
    return [
      ...ativos,
      {
        id: etapa.tipoEtapaOrigemId,
        nome: rotulo === undefined ? 'Tipo fora do catálogo atual' : `${rotulo} (inativo)`,
      },
    ];
  }

  /** Quantas etapas compõem a nota final — o que a fórmula vai dividir. */
  readonly etapasQueCompoemNota = computed(() => this.etapas().filter(componeNota).length);

  acrescentarFase(): void {
    const escolhida = this.faseAAcrescentar();
    if (escolhida === '') return;

    const { fases } = this.cronograma;
    fases.push({
      faseCanonicaId: escolhida,
      codigo: this.catalogos.fasePorId().get(escolhida)?.codigo ?? '',
      ordem: fases.length + 1,
      inicio: null,
      fim: null,
      atoProduzidoCodigo: null,
      tiposBancaIds: [],
      regraRecurso: null,
    });

    this.gravarFases(fases);
    this.faseAAcrescentar.set('');
  }

  /**
   * A última fase não sai: o cronograma gravado não aceita ficar vazio, e a
   * recusa chegaria só depois de o operador perder o que preencheu.
   */
  podeRemoverFase(): boolean {
    return this.store.draft().cronograma.fases.length > 1;
  }

  /**
   * Remover a fase que agrupa etapas leva as etapas junto: elas continuariam no
   * agregado sem a fase que as avalia, e a publicação passaria a recusar por um
   * motivo que não aponta esta tela.
   */
  removerFase(indice: number): void {
    if (!this.podeRemoverFase()) return;

    const { fases } = this.cronograma;
    const removida = fases[indice];
    if (removida === undefined) return;

    const agrupavaEtapas =
      this.catalogos.fasePorId().get(removida.faseCanonicaId)?.agrupaEtapas === true;
    fases.splice(indice, 1);

    this.store.patchObjectSection('cronograma', {
      fases: [...renumerar(fases)],
      ...(agrupavaEtapas ? { etapas: [] } : {}),
    });
    this.avisoDeReordenacao.set(null);
  }

  /**
   * Troca a fase de lugar no rascunho.
   *
   * A troca é sempre aplicada. Trocar duas fases adjacentes forma o ciclo de
   * ordem que o servidor não persiste numa chamada só — mas recusar aqui
   * deixaria a linha do tempo impossível de reordenar, porque toda troca entre
   * vizinhas tem essa forma. O rascunho aceita; quem arbitra é a gravação, e é
   * lá que a orientação aparece, com o cronograma que a provocou à vista.
   */
  mover(indice: number, direcao: -1 | 1): void {
    const { fases } = this.cronograma;
    const destino = indice + direcao;
    const atual = fases[indice];
    const vizinha = fases[destino];
    if (atual === undefined || vizinha === undefined) return;

    fases[indice] = vizinha;
    fases[destino] = atual;

    this.avisoDeReordenacao.set(null);
    this.gravarFases([...renumerar(fases)]);
  }

  definirJanela(indice: number, campo: 'inicio' | 'fim', valorLocal: string): void {
    this.atualizarFase(indice, { [campo]: valorLocal === '' ? null : instanteDoCampo(valorLocal) });
  }

  /** O instante gravado, na hora de parede do fuso institucional. */
  janelaNoCampo(valor: string | null): string {
    return valor === null ? '' : campoDoInstante(valor);
  }

  definirAto(indice: number, codigo: string): void {
    this.atualizarFase(indice, { atoProduzidoCodigo: codigo === '' ? null : codigo });
  }

  alternarBanca(indice: number, tipoBancaId: string, marcada: boolean): void {
    const atual = this.store.draft().cronograma.fases[indice];
    if (atual === undefined) return;

    const bancas = new Set(atual.tiposBancaIds);
    if (marcada) bancas.add(tipoBancaId);
    else bancas.delete(tipoBancaId);

    this.atualizarFase(indice, { tiposBancaIds: [...bancas] });
  }

  bancaMarcada(fase: FaseDoCronograma, tipoBancaId: string): boolean {
    return fase.tiposBancaIds.includes(tipoBancaId);
  }

  acrescentarEtapa(): void {
    const etapas = [...this.etapas()];
    etapas.push({
      id: null,
      nome: '',
      carater: '',
      tipoEtapaOrigemId: '',
      peso: '',
      notaMinima: '',
      ordem: etapas.length + 1,
    });
    this.store.patchObjectSection('cronograma', { etapas });
  }

  removerEtapa(indice: number): void {
    const etapas = [...this.etapas()];
    etapas.splice(indice, 1);
    this.store.patchObjectSection('cronograma', {
      etapas: etapas.map((etapa, posicao) => ({ ...etapa, ordem: posicao + 1 })),
    });
  }

  atualizarEtapa(indice: number, patch: Partial<EtapaPontuada>): void {
    const etapas = [...this.etapas()];
    const atual = etapas[indice];
    if (atual === undefined) return;

    etapas[indice] = { ...atual, ...patch };
    this.store.patchObjectSection('cronograma', { etapas });
  }

  validate(): StepValidation {
    const problemas = this.problemas();
    return problemas.length === 0 ? { valid: true } : { valid: false, messages: [...problemas] };
  }

  /**
   * Grava as duas dimensões, etapas primeiro.
   *
   * A ordem não é preferência: a fase que agrupa etapas é recusada na hora se o
   * processo não tiver nenhuma etapa, então gravar o cronograma antes das etapas
   * derrubaria a gravação de um cronograma que é válido.
   *
   * As duas vão juntas mesmo quando só uma mudou. O acoplamento que isso
   * poderia criar — uma etapa malformada impedindo a correção de uma data — não
   * chega a existir, porque a conferência acima recusa antes de qualquer envio e
   * aponta a etapa; e um `PUT` que substitui a coleção pelo mesmo conteúdo não
   * muda nada no servidor.
   */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de montar o cronograma.'],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const etapas = await this.cadastro.definirEtapas(
        processoId,
        this.etapas().map(comoComandoDeEtapa),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!etapas.ok) {
        return { valid: false, messages: [this.problemI18n.resolve(etapas.problem).title] };
      }

      const fases = await this.cadastro.definirCronogramaFases(
        processoId,
        this.store.draft().cronograma.fases.map(comoComandoDeFase),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!fases.ok) {
        return {
          valid: false,
          messages: [this.explicarRecusa(fases.problem.code, fases.problem)],
        };
      }

      const reconciliada = await this.reconciliarEtapas(processoId);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!reconciliada) {
        return {
          valid: false,
          messages: [
            'O cronograma foi gravado, mas não foi possível reler as etapas para confirmar. Abra o processo de novo antes de editá-las: sem os identificadores que o servidor atribuiu, a próxima gravação recriaria as etapas e desfaria as referências de desempate e eliminação.',
          ],
        };
      }

      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Recolhe os `id` que o servidor atribuiu às etapas novas. Devolve se
   * conseguiu.
   *
   * A gravação de etapas responde 204 sem corpo, e é o servidor quem atribui o
   * identificador. Sem reler, o rascunho segue com `id: null` e a gravação
   * seguinte omitiria o identificador de uma etapa que já existe — o servidor
   * criaria outra no lugar, e o critério de desempate e a regra de eliminação
   * que a referenciam ficariam apontando para a que deixou de existir.
   *
   * Projeta **só as etapas**, e não o processo inteiro: a navegação do wizard é
   * livre, e hidratar tudo aqui substituiria as seções de passos que o operador
   * editou sem ter gravado ainda — o trabalho sumiria sem aviso, por causa de
   * uma gravação que nem era daquele passo.
   */
  private async reconciliarEtapas(processoId: string): Promise<boolean> {
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (!isApiOk(detalhe)) return false;

    this.store.projetarSecao('cronograma', { etapas: etapasDe(detalhe.data) });
    return true;
  }

  /**
   * A recusa de permutação de ordem descreve o que aconteceu, não o que fazer.
   * Quem reordenou duas fases precisa saber que o caminho é fazê-lo em duas
   * gravações — a informação que evita tentar de novo o mesmo movimento.
   */
  private explicarRecusa(
    codigo: string,
    problema: Parameters<ProblemI18nService['resolve']>[0],
  ): string {
    if (codigo === PERMUTACAO_DE_ORDEM) {
      return 'Trocar duas fases de lugar exige duas gravações: mova uma delas para o fim da linha do tempo, grave, e então traga a outra para a posição desejada.';
    }
    return this.problemI18n.resolve(problema).title;
  }

  private atualizarFase(indice: number, patch: Partial<FaseDoCronograma>): void {
    const { fases } = this.cronograma;
    const atual = fases[indice];
    if (atual === undefined) return;

    fases[indice] = { ...atual, ...patch };
    this.gravarFases(fases);
  }

  private gravarFases(fases: readonly FaseDoCronograma[]): void {
    this.store.patchObjectSection('cronograma', { fases: [...fases] });
  }
}
