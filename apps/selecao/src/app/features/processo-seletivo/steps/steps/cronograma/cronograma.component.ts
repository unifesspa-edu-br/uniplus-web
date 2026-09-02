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
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';

import type {
  EtapaPontuada,
  FaseDoCronograma,
  StepValidation,
} from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import {
  CadastroInicialService,
  type ResultadoGravacao,
} from '../../shared/cadastro-inicial.service';
import { etapasDe } from '../../shared/hidratacao';
import { CatalogosDoCronogramaService } from './catalogos-do-cronograma.service';
import {
  componeNota,
  descreverFase,
  problemasDoCronograma,
  renumerar,
  type DescricaoDaFase,
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

/**
 * O que a tela responde enquanto as etapas gravadas estão sem os identificadores
 * que o servidor atribuiu. Serve à conferência do passo e à recusa da gravação,
 * que é o mesmo impedimento dito uma vez só.
 */
const AGUARDA_RELEITURA =
  'As etapas foram gravadas, mas a tela ainda não recolheu os identificadores que o servidor atribuiu. Releia as etapas antes de gravar de novo: sem eles, a gravação seguinte recriaria as etapas e desfaria as referências de desempate e eliminação.';

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
interface FaseNaLinhaDoTempo extends DescricaoDaFase {
  readonly grupo: FormGroup<FaseForm>;
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

  /**
   * As etapas existem no servidor, mas o rascunho ficou sem os identificadores
   * que ele atribuiu — a releitura que os recolheria não respondeu.
   *
   * Enquanto durar, a tela não grava: a gravação seguinte omitiria o `id` de
   * etapas que já existem, e o servidor criaria outras no lugar, deixando o
   * critério de desempate e a regra de eliminação apontando para as que
   * deixaram de existir. Instruir a reabrir o processo descreve a saída, mas não
   * fecha a porta — quem fecha é a recusa, e o bloqueio é a face visível dela.
   */
  readonly reconciliacaoPendente = signal(false);

  /** Releitura em voo: o botão que a dispara não aceita um segundo clique. */
  readonly relendo = signal(false);

  /** Por que a última tentativa de releitura não destravou a tela. */
  readonly erroDeReleitura = signal<string | null>(null);

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
    // acompanha o que o wizard já decide para os outros passos, e mais o que só
    // este passo sabe — as etapas gravadas à espera dos seus identificadores.
    effect(() => {
      const editavel = this.edicaoLiberada();
      untracked(() => {
        if (editavel) this.formulario.enable({ emitEvent: false });
        else this.formulario.disable({ emitEvent: false });
      });
    });

    // Outro processo entra em cena — por troca de rota ou por recomeço — e o
    // que travou a tela era de um cadastro que não está mais aqui. Sem isto o
    // bloqueio atravessaria a fronteira e recusaria a gravação de um processo
    // que nunca teve etapa nenhuma pendente.
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.reconciliacaoPendente.set(false);
        this.erroDeReleitura.set(null);
      });
    });
  }

  get fases() {
    return this.formulario.controls.fases;
  }

  get etapas() {
    return this.formulario.controls.etapas;
  }

  /**
   * O que a tela aceita editar: o que o wizard já permite, menos o intervalo em
   * que as etapas gravadas seguem sem identificador. Duas origens para a mesma
   * resposta, resolvidas aqui para que nenhum controle repita a conjunção.
   */
  readonly edicaoLiberada = computed(
    () => this.store.aceitaEdicao() && !this.reconciliacaoPendente(),
  );

  /**
   * A fase como a tela precisa dela, pela mesma resolução que a conferência
   * usa: o que a fase congelou vale sobre o catálogo, e o catálogo descreve a
   * que acabou de entrar. Duas resoluções separadas divergiriam, e a tela
   * mostraria uma coisa enquanto a validação cobraria outra.
   */
  readonly linhaDoTempo = computed<readonly FaseNaLinhaDoTempo[]>(() => {
    this.versaoDoFormulario();
    const fasePorId = this.catalogos.fasePorId();

    return this.fases.controls.map((grupo, indice) => ({
      grupo,
      ...descreverFase(faseDoFormulario(grupo), fasePorId),
      indice,
    }));
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

  /**
   * Atos que o seletor de uma fase oferece: os vigentes, mais o que ela já
   * referencia quando a vigência dele encerrou.
   *
   * Mesma razão do tipo de etapa inativo: um ato fora de vigência não é escolha
   * nova, mas descreve o cronograma gravado. Fora da lista, nenhuma opção casa e
   * o campo aparece vazio — enquanto o código continua lá, sendo enviado e
   * recusado pelo servidor na gravação seguinte.
   */
  atosEscolhiveisPara(grupo: FormGroup<FaseForm>): readonly { codigo: string; nome: string }[] {
    const referenciado = grupo.controls.atoProduzidoCodigo.value;
    const vigentes = this.catalogos
      .atosVigentes()
      .map((ato) => ({ codigo: ato.codigo, nome: ato.nome }));

    if (referenciado === '' || vigentes.some((ato) => ato.codigo === referenciado)) {
      return vigentes;
    }

    const rotulo = this.catalogos.rotuloDoAto().get(referenciado);
    return [
      ...vigentes,
      {
        codigo: referenciado,
        nome: rotulo === undefined ? 'Ato fora do catálogo atual' : `${rotulo} (fora de vigência)`,
      },
    ];
  }

  /**
   * Bancas que o quadro da fase mostra: as do catálogo, mais as que ela já
   * exige e saíram dele.
   *
   * A banca congelada continua fazendo parte do edital. Fora do quadro, ela
   * seguiria sendo enviada a cada gravação sem que o operador a visse — nem
   * pudesse tirá-la.
   */
  bancasDaFase(grupo: FormGroup<FaseForm>): readonly { id: string; nome: string }[] {
    const doCatalogo = this.catalogos.bancas().map((banca) => ({ id: banca.id, nome: banca.nome }));
    const conhecidas = new Set(doCatalogo.map((banca) => banca.id));

    const codigoCongelado = new Map(
      (grupo.controls.congelados.value?.bancas ?? []).map((banca) => [banca.id, banca.codigo]),
    );
    const congeladas = grupo.controls.tiposBancaIds.value
      .filter((id) => !conhecidas.has(id))
      .map((id) => {
        const codigo = codigoCongelado.get(id);
        return {
          id,
          nome:
            codigo === undefined
              ? 'Banca fora do catálogo atual'
              : `${codigo} (fora do catálogo atual)`,
        };
      });

    return [...doCatalogo, ...congeladas];
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
        congelados: null,
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

    const agrupavaEtapas = this.linhaDoTempo()[indice]?.exigencias?.agrupaEtapas === true;

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
    this.renumerarEtapas();
  }

  /**
   * Troca a etapa de lugar, movendo o grupo inteiro.
   *
   * Move o controle em vez de trocar os valores entre dois: é o `id` que
   * critério de desempate e regra de eliminação referenciam, e recriar a etapa
   * numa posição diferente lhe daria outro identificador no servidor, deixando
   * essas regras apontando para uma etapa que deixou de existir.
   */
  moverEtapa(indice: number, direcao: -1 | 1): void {
    const destino = indice + direcao;
    const atual = this.etapas.at(indice);
    if (atual === undefined || this.etapas.at(destino) === undefined) return;

    this.etapas.removeAt(indice, { emitEvent: false });
    this.etapas.insert(destino, atual, { emitEvent: false });
    this.renumerarEtapas();
  }

  /** Reescreve a posição das etapas de 1 a N, sem tocar nos identificadores. */
  private renumerarEtapas(): void {
    for (const [posicao, grupo] of this.etapas.controls.entries()) {
      grupo.controls.ordem.setValue(posicao + 1, { emitEvent: false });
    }
    this.etapas.updateValueAndValidity();
  }

  /**
   * A conferência do passo, que também é o que a gravação consulta antes de
   * enviar qualquer coisa: recusar aqui é o que impede a segunda gravação de
   * recriar etapas que já existem, e é o que impede a revisão final de declarar
   * íntegro um cronograma que o servidor ainda não confirmou.
   */
  validate(): StepValidation {
    if (this.reconciliacaoPendente()) return { valid: false, messages: [AGUARDA_RELEITURA] };

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

    const fases = this.fases.controls.map(faseDoFormulario);
    const etapas = this.etapas.controls.map(etapaDoFormulario);
    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      // A ordem segue a direção da mudança, porque a bicondicional do agregado
      // recusa os dois estados intermediários — mas em momentos opostos.
      //
      // Enquanto houver fase que agrupa etapas, as etapas vão primeiro: gravar
      // o cronograma antes deixaria essa fase sem nenhuma etapa, o que é
      // recusado na hora.
      //
      // Quando ela sai, é o inverso. Zerar as etapas primeiro deixaria a fase
      // agrupadora que ainda está no servidor sem etapa alguma, e a recusa
      // impediria a própria gravação que a removeria — a remoção da fase de
      // avaliação seria impossível de concluir. Removê-la antes deixa etapas
      // órfãs por um instante, e isso o agregado tolera: só a publicação recusa.
      const gravaEtapasPrimeiro = this.linhaDoTempo().some(
        (item) => item.exigencias?.agrupaEtapas === true,
      );

      if (!gravaEtapasPrimeiro) {
        const cronograma = await this.gravarCronograma(processoId, fases);
        if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
        if (!cronograma.ok) {
          return {
            valid: false,
            messages: [this.explicarRecusa(cronograma.problem.code, cronograma.problem)],
          };
        }
      }

      const gravacaoDeEtapas = await this.cadastro.definirEtapas(
        processoId,
        etapas.map(comoComandoDeEtapa),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!gravacaoDeEtapas.ok) {
        return {
          valid: false,
          messages: [this.problemI18n.resolve(gravacaoDeEtapas.problem).title],
        };
      }

      // As etapas já mudaram no servidor: é aqui que o rascunho recolhe os
      // identificadores atribuídos. Deixar para o fim perderia a reconciliação
      // se o cronograma fosse recusado, e a tentativa seguinte reenviaria
      // etapas que já existem sem o `id`, recriando-as.
      const reconciliada = await this.reconciliarEtapas(processoId);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!reconciliada) {
        // Trava a tela em vez de só avisar: o `finally` logo abaixo devolve o
        // botão de gravar, e o rascunho ainda tem `id: null` nas etapas que o
        // servidor acabou de criar.
        this.reconciliacaoPendente.set(true);
        return { valid: false, messages: [AGUARDA_RELEITURA] };
      }

      if (gravaEtapasPrimeiro) {
        const cronograma = await this.gravarCronograma(processoId, fases);
        if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
        if (!cronograma.ok) {
          return {
            valid: false,
            messages: [this.explicarRecusa(cronograma.problem.code, cronograma.problem)],
          };
        }
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
   * Grava o cronograma, contornando o ciclo de ordem quando ele aparece.
   *
   * Reordenar é sempre uma permutação de `1..N`, e toda permutação não-trivial
   * fecha ciclo: cada fase precisa que a outra libere a posição primeiro, e o
   * servidor não persiste isso numa chamada. Mandar o operador "mover uma para
   * o fim" não resolvia — renumerar produz `1..N` de novo, e o ciclo volta.
   *
   * O que resolve é uma posição que ninguém ocupa. O domínio aceita qualquer
   * ordem positiva, não só a sequência fechada, então uma gravação intermediária
   * em `N+1..2N` esvazia as posições `1..N` e a seguinte as ocupa sem cadeia que
   * volte a si mesma. Duas chamadas em vez de uma, e só quando a primeira acusa.
   */
  private async gravarCronograma(
    processoId: string,
    fases: readonly FaseDoCronograma[],
  ): Promise<ResultadoGravacao> {
    const pretendida = await this.cadastro.definirCronogramaFases(
      processoId,
      fases.map(comoComandoDeFase),
    );
    if (pretendida.ok || pretendida.problem.code !== PERMUTACAO_DE_ORDEM) return pretendida;

    // Deslocar pela quantidade de fases só serve se as ordens forem 1..N; o
    // domínio aceita qualquer ordem positiva, e uma lacuna faria a faixa
    // "livre" cair em cima de uma posição ocupada. Somar a maior ordem em uso
    // põe todas acima de qualquer uma que exista hoje.
    const deslocamento = Math.max(...fases.map((fase) => fase.ordem));
    const emOrdemLivre = fases.map((fase) => ({ ...fase, ordem: fase.ordem + deslocamento }));

    const intermediaria = await this.cadastro.definirCronogramaFases(
      processoId,
      emOrdemLivre.map(comoComandoDeFase),
    );
    if (!intermediaria.ok) return intermediaria;

    return this.cadastro.definirCronogramaFases(processoId, fases.map(comoComandoDeFase));
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
    const geracao = this.store.geracao();
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (!isApiOk(detalhe)) return false;

    // A leitura estava em voo e outro processo entrou no lugar: projetar agora
    // escreveria as etapas de um cadastro sobre o rascunho de outro. Quem
    // chamou confere a mesma geração e descarta o resultado.
    if (geracao !== this.store.geracao()) return false;

    this.store.projetarSecao('cronograma', { etapas: etapasDe(detalhe.data) });
    return true;
  }

  /**
   * Refaz a releitura que travou a tela.
   *
   * É a saída no próprio passo. Recarregar o processo resolve igual, mas custa
   * ao operador sair de onde está — e a tela já sabe exatamente o que faltou.
   */
  async relerEtapas(): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null || this.relendo()) return;

    const geracao = this.store.geracao();
    this.relendo.set(true);
    this.erroDeReleitura.set(null);
    try {
      const reconciliada = await this.reconciliarEtapas(processoId);
      // Outro processo assumiu a tela enquanto a leitura vinha: o bloqueio que
      // existia era do anterior, e quem o desfaz é a troca, não esta resposta.
      if (geracao !== this.store.geracao()) return;

      if (reconciliada) {
        this.reconciliacaoPendente.set(false);
        return;
      }

      this.erroDeReleitura.set(
        'Não foi possível reler as etapas agora. Tente de novo em instantes; se continuar assim, recarregue o processo.',
      );
    } finally {
      this.relendo.set(false);
    }
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
      mesmoConteudo(atuais.fases, cronograma.fases) &&
      mesmoConteudo(atuais.etapas, cronograma.etapas)
    ) {
      return;
    }

    this.espelhando = true;
    try {
      this.fases.clear({ emitEvent: false });
      for (const fase of renumerar(cronograma.fases)) {
        this.fases.push(grupoDaFase(fase), { emitEvent: false });
      }

      // A ordem das etapas vem resolvida da hidratação, que renumera o que o
      // servidor devolveu — corrigir de novo aqui deixaria o formulário e o
      // rascunho descrevendo posições diferentes.
      this.etapas.clear({ emitEvent: false });
      for (const etapa of cronograma.etapas) {
        this.etapas.push(grupoDaEtapa(etapa), { emitEvent: false });
      }

      if (!this.edicaoLiberada()) this.formulario.disable({ emitEvent: false });
      this.versaoDoFormulario.update((versao) => versao + 1);
    } finally {
      this.espelhando = false;
    }
  }
}

/**
 * Compara conteúdo, não a ordem em que os campos foram escritos.
 *
 * A projeção da leitura e a do formulário montam os mesmos objetos em ordens
 * diferentes, e `JSON.stringify` preserva a ordem de inserção — comparar assim
 * daria "diferente" para dado igual. O efeito seria reconstruir os controles a
 * cada tecla, tirando o foco do campo em que se está digitando: um sintoma que
 * não se parece nem um pouco com a causa.
 */
function mesmoConteudo(umLado: unknown, outroLado: unknown): boolean {
  return canonico(umLado) === canonico(outroLado);
}

function canonico(valor: unknown): string {
  return JSON.stringify(valor, (_chave, conteudo: unknown) =>
    conteudo !== null && typeof conteudo === 'object' && !Array.isArray(conteudo)
      ? Object.fromEntries(
          Object.entries(conteudo as Record<string, unknown>).sort(([um], [outro]) =>
            um.localeCompare(outro),
          ),
        )
      : conteudo,
  );
}
