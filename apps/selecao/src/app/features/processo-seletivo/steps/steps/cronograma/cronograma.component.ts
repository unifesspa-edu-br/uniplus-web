import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
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
import { etapasDe } from '../../shared/hidratacao';
import { CatalogosDoCronogramaService } from './catalogos-do-cronograma.service';
import {
  componeNota,
  exigenciasDe,
  problemasDoCronograma,
  renumerar,
  type ExigenciasDaFase,
} from './cronograma-do-certame';
import {
  etapaDoFormulario,
  faseDoFormulario,
  grupoDaEtapa,
  grupoDaFase,
  novoFormularioDoCronograma,
  type EtapaForm,
  type FaseForm,
} from './cronograma-form';
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
 * A fase na tela: o formulário que o operador edita, junto do que o catálogo
 * congela sobre ela. O componente monta este par uma vez e o template lê os dois
 * lados sem procurar a fase canônica a cada célula.
 */
interface FaseNaLinhaDoTempo {
  readonly grupo: FormGroup<FaseForm>;
  readonly canonica: FaseCanonicaDto | undefined;
  readonly exigencias: ExigenciasDaFase | null;
  readonly indice: number;
}

@Component({
  selector: 'sel-step-cronograma',
  imports: [ReactiveFormsModule],
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
  readonly formulario = novoFormularioDoCronograma();

  /**
   * O conteúdo do formulário, como signal, para que os valores derivados
   * reajam à digitação. `valueChanges` alimenta este sinal; ele não é a fonte
   * do dado, só a forma de o template e os `computed` acompanharem a edição.
   */
  private readonly versaoDoFormulario = signal(0);

  /**
   * Enquanto o rascunho está sendo espelhado no formulário, o caminho de volta
   * fica fechado: sem isso, cada projeção vinda do servidor dispararia uma
   * escrita no rascunho, que dispararia outra projeção.
   */
  private espelhando = false;

  /**
   * Orientação da recusa de permutação, quando a reordenação pedida forma um
   * ciclo que o servidor não persiste numa chamada só.
   */
  readonly avisoDeReordenacao = signal<string | null>(null);

  constructor() {
    this.catalogos.carregar();
    this.espelharRascunho(this.store.draft().cronograma);

    // Rascunho → formulário: hidratação da leitura e reconciliação da gravação
    // chegam por aqui, e é a única entrada que não veio da digitação.
    effect(() => {
      const cronograma = this.store.draft().cronograma;
      untracked(() => this.espelharRascunho(cronograma));
    });

    // Formulário → rascunho, que é o que persiste entre passos e alimenta a
    // gravação.
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.versaoDoFormulario.update((versao) => versao + 1);
      if (this.espelhando) return;
      this.store.patchObjectSection('cronograma', {
        fases: this.fases.controls.map(faseDoFormulario),
        etapas: this.etapas.controls.map(etapaDoFormulario),
      });
    });

    // Fora de rascunho o servidor recusa qualquer gravação; o formulário
    // acompanha o que o wizard já decide para os outros passos.
    effect(() => {
      const editavel = this.store.aceitaEdicao();
      untracked(() => {
        if (editavel) this.formulario.enable({ emitEvent: false });
        else this.formulario.disable({ emitEvent: false });
      });
    });
  }

  get fases() {
    return this.formulario.controls.fases;
  }

  get etapas() {
    return this.formulario.controls.etapas;
  }

  readonly linhaDoTempo = computed<readonly FaseNaLinhaDoTempo[]>(() => {
    this.versaoDoFormulario();
    const fasePorId = this.catalogos.fasePorId();

    return this.fases.controls.map((grupo, indice) => {
      const canonica = fasePorId.get(grupo.controls.faseCanonicaId.value);
      return {
        grupo,
        canonica,
        exigencias: canonica === undefined ? null : exigenciasDe(canonica),
        indice,
      };
    });
  });

  /**
   * Fases que ainda cabem no cronograma, na ordem que as precedências sugerem —
   * uma fase canônica entra uma vez só.
   */
  readonly fasesDisponiveis = computed(() => {
    this.versaoDoFormulario();
    const usadas = new Set(this.fases.controls.map((grupo) => grupo.controls.faseCanonicaId.value));
    return this.catalogos.fasesEmOrdemSugerida().filter((fase) => !usadas.has(fase.id));
  });

  /** O que impede a gravação, como a validação do passo o relata. */
  readonly problemas = computed(() => {
    this.versaoDoFormulario();
    return problemasDoCronograma(
      this.fases.controls.map(faseDoFormulario),
      this.etapas.controls.map(etapaDoFormulario),
      this.catalogos.fasePorId(),
      this.catalogos.precedencias(),
    );
  });

  /** Quantas etapas compõem a nota final — o que a fórmula vai dividir. */
  readonly etapasQueCompoemNota = computed(() => {
    this.versaoDoFormulario();
    return this.etapas.controls.map(etapaDoFormulario).filter(componeNota).length;
  });

  /**
   * Tipos que o seletor de uma etapa oferece: os ativos, mais o que ela já
   * referencia quando esse saiu de atividade.
   *
   * Um tipo inativo não volta a ser escolha nova, mas continua descrevendo a
   * etapa que o gravou. Sem ele na lista, nenhuma opção casa e o campo aparece
   * em branco — o operador não veria qual classificação está configurada, e
   * gravaria por cima dela sem perceber.
   */
  tiposEscolhiveisPara(grupo: FormGroup<EtapaForm>): readonly { id: string; nome: string }[] {
    const referenciado = grupo.controls.tipoEtapaOrigemId.value;
    const ativos = this.catalogos
      .tiposEtapaAtivos()
      .map((tipo) => ({ id: tipo.id, nome: tipo.nome }));

    if (referenciado === '' || ativos.some((tipo) => tipo.id === referenciado)) {
      return ativos;
    }

    const rotulo = this.catalogos.rotuloDoTipoEtapa().get(referenciado);
    return [
      ...ativos,
      {
        id: referenciado,
        nome: rotulo === undefined ? 'Tipo fora do catálogo atual' : `${rotulo} (inativo)`,
      },
    ];
  }

  acrescentarFase(): void {
    const escolhida = this.formulario.controls.faseAAcrescentar.value;
    if (escolhida === '') return;

    this.fases.push(
      grupoDaFase({
        faseCanonicaId: escolhida,
        codigo: this.catalogos.fasePorId().get(escolhida)?.codigo ?? '',
        ordem: this.fases.length + 1,
        inicio: null,
        fim: null,
        atoProduzidoCodigo: null,
        tiposBancaIds: [],
        regraRecurso: null,
      }),
    );
    this.formulario.controls.faseAAcrescentar.setValue('');
  }

  /**
   * A última fase não sai: o cronograma gravado não aceita ficar vazio, e a
   * recusa chegaria só depois de o operador perder o que preencheu.
   */
  podeRemoverFase(): boolean {
    this.versaoDoFormulario();
    return this.fases.length > 1;
  }

  /**
   * Remover a fase que agrupa etapas leva as etapas junto: elas continuariam no
   * agregado sem a fase que as avalia, e a publicação passaria a recusar por um
   * motivo que não aponta esta tela.
   */
  removerFase(indice: number): void {
    if (!this.podeRemoverFase()) return;

    const removida = this.fases.at(indice);
    if (removida === undefined) return;

    const agrupavaEtapas =
      this.catalogos.fasePorId().get(removida.controls.faseCanonicaId.value)?.agrupaEtapas === true;

    this.fases.removeAt(indice, { emitEvent: false });
    if (agrupavaEtapas) this.etapas.clear({ emitEvent: false });
    this.renumerarFases();
    this.avisoDeReordenacao.set(null);
  }

  /**
   * Troca a fase de lugar.
   *
   * A troca é sempre aplicada. Trocar duas fases adjacentes forma o ciclo de
   * ordem que o servidor não persiste numa chamada só — mas recusar aqui
   * deixaria a linha do tempo impossível de reordenar, porque toda troca entre
   * vizinhas tem essa forma. A edição aceita; quem arbitra é a gravação, e é lá
   * que a orientação aparece, com o cronograma que a provocou à vista.
   */
  mover(indice: number, direcao: -1 | 1): void {
    const destino = indice + direcao;
    const atual = this.fases.at(indice);
    const vizinha = this.fases.at(destino);
    if (atual === undefined || vizinha === undefined) return;

    this.fases.removeAt(indice, { emitEvent: false });
    this.fases.insert(destino, atual, { emitEvent: false });
    this.renumerarFases();
    this.avisoDeReordenacao.set(null);
  }

  alternarBanca(grupo: FormGroup<FaseForm>, tipoBancaId: string, evento: Event): void {
    const alvo = evento.target;
    const marcada = alvo instanceof HTMLInputElement && alvo.checked;

    const bancas = new Set(grupo.controls.tiposBancaIds.value);
    if (marcada) bancas.add(tipoBancaId);
    else bancas.delete(tipoBancaId);

    grupo.controls.tiposBancaIds.setValue([...bancas]);
  }

  bancaMarcada(grupo: FormGroup<FaseForm>, tipoBancaId: string): boolean {
    this.versaoDoFormulario();
    return grupo.controls.tiposBancaIds.value.includes(tipoBancaId);
  }

  acrescentarEtapa(): void {
    this.etapas.push(
      grupoDaEtapa({
        id: null,
        nome: '',
        carater: '',
        tipoEtapaOrigemId: '',
        peso: '',
        notaMinima: '',
        ordem: this.etapas.length + 1,
      }),
    );
  }

  removerEtapa(indice: number): void {
    this.etapas.removeAt(indice, { emitEvent: false });
    this.etapas.controls.forEach((grupo, posicao) =>
      grupo.controls.ordem.setValue(posicao + 1, { emitEvent: false }),
    );
    this.etapas.updateValueAndValidity();
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
        this.etapas.controls.map(etapaDoFormulario).map(comoComandoDeEtapa),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!etapas.ok) {
        return { valid: false, messages: [this.problemI18n.resolve(etapas.problem).title] };
      }

      const fases = await this.cadastro.definirCronogramaFases(
        processoId,
        this.fases.controls.map(faseDoFormulario).map(comoComandoDeFase),
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

  /** Reescreve a posição de 1 a N na ordem em que as fases estão. */
  private renumerarFases(): void {
    for (const [posicao, grupo] of this.fases.controls.entries()) {
      grupo.controls.ordem.setValue(posicao + 1, { emitEvent: false });
    }
    this.fases.updateValueAndValidity();
  }

  /**
   * Traz o rascunho para o formulário, sem desfazer a digitação em curso.
   *
   * Reconstrói os arrays só quando o conteúdo difere do que já está na tela: o
   * rascunho é atualizado a cada tecla pelo caminho de volta, e recriar os
   * controles a cada uma tiraria o foco do campo que está sendo preenchido.
   */
  private espelharRascunho(cronograma: {
    readonly fases: readonly FaseDoCronograma[];
    readonly etapas: readonly EtapaPontuada[];
  }): void {
    const atuais = {
      fases: this.fases.controls.map(faseDoFormulario),
      etapas: this.etapas.controls.map(etapaDoFormulario),
    };
    if (
      JSON.stringify(atuais.fases) === JSON.stringify(cronograma.fases) &&
      JSON.stringify(atuais.etapas) === JSON.stringify(cronograma.etapas)
    ) {
      return;
    }

    this.espelhando = true;
    try {
      this.fases.clear({ emitEvent: false });
      for (const fase of renumerar(cronograma.fases)) {
        this.fases.push(grupoDaFase(fase), { emitEvent: false });
      }

      this.etapas.clear({ emitEvent: false });
      for (const etapa of cronograma.etapas) {
        this.etapas.push(grupoDaEtapa(etapa), { emitEvent: false });
      }

      if (!this.store.aceitaEdicao()) this.formulario.disable({ emitEvent: false });
      this.versaoDoFormulario.update((versao) => versao + 1);
    } finally {
      this.espelhando = false;
    }
  }
}
