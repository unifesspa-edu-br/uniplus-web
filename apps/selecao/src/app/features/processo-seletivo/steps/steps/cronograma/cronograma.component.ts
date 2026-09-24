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
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi, type ConfiguracaoDerivacaoInput } from '@uniplus/shared-data/selecao';

import {
  PAPEL_DEFINITIVO,
  PAPEL_PRELIMINAR,
  type ProdutoDaFase,
  type RecursoDaEtapa,
  type StepValidation,
  type WizardDraft,
} from '../../processo-seletivo.models';
import { PAPEIS_ESCOLHIVEIS } from '../fase/configuracao-da-fase';
import { FaseStepComponent } from '../fase/fase.component';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import {
  ORIENTACAO_DE_PERMUTACAO,
  PERMUTACAO_DE_ORDEM,
  gravarCronogramaFases,
} from '../../shared/gravacao-do-cronograma';
import {
  CONSEQUENCIA_REENVIO,
  FATO_MODALIDADE,
  STATUS_BASE_LEGAL_RESOLVIDO,
  arvoreDeExigencias,
  exigenciasDaFase,
  gruposSemNormaResolvida,
  modalidadesDaExigencia,
  semAEtapa,
  semAFase,
  todasAsExigencias,
} from '../../shared/exigencias-documentais';
import {
  fatosParaGatilho,
  nomesDoCatalogo,
  problemasDoGatilho,
} from '../../shared/gatilho-de-exigencia';
import { etapasDe } from '../../shared/hidratacao';
import {
  comCamposQueAsExigenciasPressupoem,
  fatosCitadosPelaDerivacao,
  comoComandoDeFatosColetados,
  divergeDoServidor,
} from '../formulario/formulario-de-inscricao';
import {
  inicioDeHojeNoFusoInstitucional,
  pisoDoCampoDeData,
} from '../../shared/fuso-institucional';
import { CatalogosDoCronogramaService } from './catalogos-do-cronograma.service';
import {
  componeNota,
  declaraNotaDoEnem,
  descreverFase,
  recusaDaEtapaDeNotaDoEnem,
  problemasDoCronograma,
  renumerar,
  type DescricaoDaFase,
  type ExigenciaDeclarada,
  type GrupoDeclarado,
  avisosDosGrupos,
} from './cronograma-do-certame';
import {
  etapaDoFormulario,
  faseDoFormulario,
  grupoDaEtapa,
  grupoDaFase,
  novoFormularioDoCronograma,
  type CaraterEscolhido,
  type EtapaForm,
  type FaseForm,
} from './cronograma-form';
import { comoComandoDeEtapa } from './cronograma-para-comando';

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
  imports: [FormsModule, ReactiveFormsModule, FaseStepComponent],
  templateUrl: './cronograma.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(CronogramaStepComponent)],
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

  /**
   * A convenção foi gravada com sucesso nesta sessão. Só `persistir()`
   * escreve aqui, no sucesso da terceira chamada — nunca a mirror genérica de
   * `espelharRascunho`, que roda por causa de qualquer uma das três dimensões
   * (inclusive uma reconciliação de etapas que nada tem a ver com o
   * algoritmo) e daria falso positivo se lida como confirmação do servidor.
   */
  private readonly algoritmoConfirmadoNestaSessao = signal(false);

  /**
   * A convenção já foi declarada no servidor — pela última leitura completa
   * (`remoteSnapshot`) ou por uma gravação desta sessão. Enquanto for
   * `false`, "nenhuma convenção" é opção legítima (CA-05); depois, deixa de
   * ser: o endpoint não tem operação de remoção —
   * `DefinirAlgoritmoContagemPrazoRequest` exige `codigo` e `versao` — e
   * oferecer a opção de novo convidaria a uma gravação que a tela pularia em
   * silêncio, relatando sucesso sem o servidor ter mudado nada.
   */
  readonly algoritmoDeclaradoNoServidor = computed(
    () =>
      this.store.remoteSnapshot()?.algoritmoContagemPrazo != null ||
      this.algoritmoConfirmadoNestaSessao(),
  );

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
        algoritmoContagemCodigo: this.formulario.controls.algoritmoContagemCodigo.value,
        algoritmoContagemVersao: this.formulario.controls.algoritmoContagemVersao.value,
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
        this.algoritmoConfirmadoNestaSessao.set(false);
      });
    });
  }

  get fases() {
    return this.formulario.controls.fases;
  }

  /** Os papéis escolhíveis, no mesmo vocabulário que a configuração da fase usa. */
  readonly papeis = PAPEIS_ESCOLHIVEIS;

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
      this.catalogos.atoPorCodigo(),
      (tipoBancaId) => this.catalogos.bancaPorId().get(tipoBancaId)?.nome ?? tipoBancaId,
      (tipoEtapaOrigemId) => this.catalogos.tipoEtapaPorId().get(tipoEtapaOrigemId),
      this.exigenciasDeclaradas(),
    );
  });

  /**
   * O que a publicação vai cobrar dos grupos, dito como aviso: eles não se editam aqui, e
   * bloquear a gravação por causa deles prenderia o passo sem saída.
   */
  readonly avisosDeGrupo = computed(() => avisosDosGrupos(this.gruposDeclarados()));

  /**
   * Os grupos de exigências que o rascunho carrega. A tela não os edita — eles chegam da
   * configuração do processo —, mas a publicação cobra deles a norma quando decidem o
   * resultado, e é melhor dizer isso aqui do que no último passo.
   */
  private readonly gruposDeclarados = computed<readonly GrupoDeclarado[]>(() => {
    const nomePorId = new Map(this.catalogos.tiposDocumento().map((tipo) => [tipo.id, tipo.nome]));

    return gruposSemNormaResolvida(this.store.draft().documentos).map((grupo) => ({
      decideResultado: true,
      normaResolvida: false,
      documentos: grupo.documentos.map((id) => nomePorId.get(id) ?? id),
    }));
  });

  /**
   * As exigências que o rascunho declara, na forma que a conferência entende: o nome que a
   * pessoa lê, se a exigência decide o resultado e se a norma que a sustenta está resolvida.
   */
  private readonly exigenciasDeclaradas = computed<readonly ExigenciaDeclarada[]>(() => {
    const nomePorId = new Map(
      this.catalogos.tiposDocumento().map((tipo) => [tipo.id, tipo.nome]),
    );
    // Percorre as exigências, não os tipos de documento: a norma é declarada POR exigência,
    // e o mesmo documento pode decidir o resultado numa fase e não na outra. Conferir por
    // documento aprovaria a fase cuja norma ficou pendente por causa da outra.
    const fases = this.fases.controls.map(faseDoFormulario);
    const fasePorCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));
    const ofertadas = new Set(this.store.modalidadesDoProcesso());
    // O gatilho é conferido contra o MESMO catálogo que a superfície da fase oferece: o que a
    // tela não soube propor, ela também não sabe validar, e apontar um fato que o editor não
    // mostra deixaria o operador sem o que fazer.
    const fatoPorCodigo = new Map(
      fatosParaGatilho(
        this.catalogos.fatos(),
        new Map([
          [
            'CONDICAO_ATENDIMENTO',
            this.store.draft().atendimento.condicoes.map((condicao) => condicao.codigo),
          ],
        ]),
      ).map((fato) => [fato.codigo, fato]),
    );
    const nomePorCodigo = nomesDoCatalogo(this.catalogos.fatos());

    return todasAsExigencias(this.store.draft().documentos).map((exigencia) => {
      const fase = fasePorCodigo.get(exigencia.faseCodigo);
      const recorte = modalidadesDaExigencia(exigencia);
      const admiteComplementacao =
        fase === undefined
          ? false
          : descreverFase(fase, this.catalogos.fasePorId()).permiteComplementacao;

      return {
        nome: nomePorId.get(exigencia.tipoDocumentoId) ?? exigencia.tipoDocumentoId,
        decideResultado: exigencia.obrigatorio || exigencia.consequenciaIndeferimento !== '',
        normaResolvida: exigencia.basesLegais.some(
          (base) => base.referencia.trim() !== '' && base.status === STATUS_BASE_LEGAL_RESOLVIDO,
        ),
        faseCodigo: exigencia.faseCodigo,
        faseViva: fase !== undefined,
        alcancaModalidade:
          recorte === null
            ? ofertadas.size > 0
            : recorte.some((codigo) => ofertadas.has(codigo)),
        reenvioSemComplementacao:
          exigencia.consequenciaIndeferimento === CONSEQUENCIA_REENVIO && !admiteComplementacao,
        problemasDeGatilho: problemasDoGatilho(exigencia, fatoPorCodigo, nomePorCodigo),
      };
    });
  });

  /**
   * Convenções de contagem de prazo publicadas no catálogo versionado. O DTO
   * não tem `nome` nem `descricao` — só `codigo`, `versao` e `baseLegal` são
   * legíveis, e é isso que o seletor exibe. Nenhum mapa código→rótulo é
   * escrito aqui: seria vocabulário institucional duplicado no frontend.
   */
  readonly regrasDeContagem = computed(() =>
    this.catalogos
      .regrasContagem()
      .map((regra) => ({ codigo: regra.codigo, versao: regra.versao, baseLegal: regra.baseLegal })),
  );

  /**
   * O que a convenção escolhida faz, na prosa que o próprio catálogo publica.
   *
   * O rótulo da opção trazia a base legal, e as três convenções de contagem têm a MESMA —
   * quatrocentos e sessenta e nove caracteres idênticos repetidos em cada linha, que não
   * distinguiam nada e ainda escondiam o fim do código. O que separa uma convenção da outra
   * são os invariantes: cada um descreve um caso — âncora fora da meia-noite, âncora em dia
   * não útil, contagem em dias úteis, contagem em horas — com o exemplo do resultado.
   */
  readonly invariantesDaContagem = computed<readonly string[]>(() => {
    this.versaoDoFormulario();
    const escolhida = this.formulario.controls.algoritmoContagemCodigo.value;
    if (escolhida === '') return [];

    const regra = this.catalogos.regrasContagem().find((item) => item.codigo === escolhida);
    return textosDoCatalogo(regra?.invariantes);
  });

  /** A base legal da convenção escolhida — a mesma das três, mostrada uma vez só. */
  readonly baseLegalDaContagem = computed<string>(() => {
    this.versaoDoFormulario();
    const escolhida = this.formulario.controls.algoritmoContagemCodigo.value;
    if (escolhida === '') return '';

    return this.catalogos.regrasContagem().find((item) => item.codigo === escolhida)?.baseLegal ?? '';
  });

  /** Quantas etapas compõem a nota final — o que a fórmula vai dividir. */
  /**
   * Os controles de etapa que declaram pertencer a esta fase, com o índice que cada um
   * ocupa no FormArray — é por ele que o template liga rótulo, `id` e remoção.
   *
   * A etapa é filha da fase no domínio, mas no formulário continua irmã de `fases`: um
   * `formArrayName` aninhado seria procurado dentro do grupo da fase, que não a contém.
   * Por isso a ligação é por referência, e o recorte acontece aqui.
   */
  etapasDaFase(
    codigo: string,
    agrupaEtapas: boolean,
  ): readonly { indice: number; grupo: FormGroup<EtapaForm> }[] {
    this.versaoDoFormulario();
    return this.etapas.controls
      .map((grupo, indice) => ({ indice, grupo }))
      .filter(({ grupo }) => {
        const declarada = grupo.controls.faseCodigo.value;
        // Etapa gravada antes do vínculo não declara fase: continua aparecendo sob a
        // fase que o cadastro marca como agrupadora, que é onde ela sempre esteve.
        return declarada === '' ? agrupaEtapas : declarada === codigo;
      });
  }

  readonly etapasQueCompoemNota = computed(() => {
    this.versaoDoFormulario();
    return this.etapas.controls.map(etapaDoFormulario).filter(componeNota).length;
  });

  /**
   * Etapas que nenhuma fase da linha do tempo agrupa.
   *
   * O agregado tolera o estado — só a publicação o recusa —, e chega-se a ele
   * quando a fase de avaliação sai e a gravação que esvaziaria as etapas não
   * acontece. Elas não têm onde aparecer na linha do tempo, então a tela as
   * mostra à parte: sem isso a conferência cobra a remoção de etapas que não
   * estão em lugar nenhum, e o cronograma fica sem gravação possível.
   *
   * Resolve pelo mesmo caminho da conferência — o que a fase congelou vale
   * sobre o catálogo —, para que as duas nunca discordem sobre haver ou não
   * quem agrupe.
   */
  readonly etapasOrfas = computed<readonly { indice: number; rotulo: string }[]>(() => {
    this.versaoDoFormulario();
    const codigosNaLinha = new Set(
      this.fases.controls.map((grupo) => grupo.controls.codigo.value),
    );
    const haAgrupadora = this.linhaDoTempo().some((item) => item.exigencias?.agrupaEtapas === true);

    return this.etapas.controls
      .map((grupo, indice) => ({ indice, grupo }))
      .filter(({ grupo }) => {
        const codigo = grupo.controls.faseCodigo.value;
        // Sem fase declarada, a etapa só é órfã quando nenhuma fase a agruparia.
        return codigo === '' ? !haAgrupadora : !codigosNaLinha.has(codigo);
      })
      .map(({ indice, grupo }) => {
        const nome = grupo.controls.nome.value.trim();
        return { indice, rotulo: nome === '' ? `Etapa ${indice + 1}, ainda sem nome` : nome };
      });
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
   * O que a fase publica, como a tela o mostra: nome do ato e papel da
   * publicação. É leitura, não escolha — a declaração dos produtos é de outro
   * passo, e o que está aqui atravessa a gravação inalterado.
   *
   * O ato cujo rótulo o catálogo não resolve aparece pelo código: ele descreve
   * o cronograma gravado, e escondê-lo faria a fase parecer publicar menos do
   * que publica.
   */
  produtosDaFase(
    grupo: FormGroup<FaseForm>,
  ): readonly { atoCodigo: string; nome: string; papel: string }[] {
    const rotulos = this.catalogos.rotuloDoAto();

    return grupo.controls.produtos.value.map((produto) => ({
      atoCodigo: produto.atoCodigo,
      nome: rotulos.get(produto.atoCodigo) ?? produto.atoCodigo,
      papel: rotuloDoPapel(produto.papel),
    }));
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
        produtos: [],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
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
  /**
   * Remover a fase que agrupa etapas leva as etapas junto: elas continuariam no
   * agregado sem a fase que as avalia, e a publicação passaria a recusar por um
   * motivo que não aponta esta tela.
   */
  /**
   * As fases expandidas, por posição na linha do tempo.
   *
   * Todas fechadas ao chegar: o passo se chama linha do tempo, e sete cabeçalhos mostram a
   * linha inteira numa tela só. Abrir é um clique; o que está fechado continua sendo
   * gravado, e a conferência que recusa abre tudo de volta (ver `persistir`).
   */
  private readonly fasesExpandidas = signal<ReadonlySet<number>>(new Set());

  faseExpandida(indice: number): boolean {
    return this.fasesExpandidas().has(indice);
  }

  alternarFase(indice: number): void {
    const abertas = new Set(this.fasesExpandidas());
    if (!abertas.delete(indice)) abertas.add(indice);
    this.fasesExpandidas.set(abertas);
  }

  /** Abre todas — é o que a recusa da conferência faz, para não esconder o erro. */
  private expandirTodasAsFases(): void {
    this.fasesExpandidas.set(new Set(this.linhaDoTempo().map((item) => item.indice)));
  }

  /**
   * O que a fase fechada diz de si: quantas etapas acontecem nela e quantos documentos ela
   * exige. É o bastante para o operador saber onde entrar sem abrir uma por uma.
   */
  marcasDaFase(indice: number): readonly string[] {
    const { etapas, documentos } = this.dependentesDaFase(indice);
    const marcas: string[] = [];
    if (etapas > 0) marcas.push(etapas === 1 ? '1 etapa' : `${etapas} etapas`);
    if (documentos > 0) {
      marcas.push(documentos === 1 ? '1 documento' : `${documentos} documentos`);
    }
    return marcas;
  }

  /**
   * As etapas abertas, por posição no formulário.
   *
   * Fechadas por padrão: cada etapa aberta passa de mil pixels, e a habilitação do certame
   * regional tem oito. Mais de uma pode ficar aberta ao mesmo tempo — comparar duas etapas é
   * pergunta legítima de quem monta o edital, e fechar a anterior a cada clique tiraria isso.
   */
  private readonly etapasAbertas = signal<ReadonlySet<number>>(new Set());

  etapaAberta(posicao: number): boolean {
    return this.etapasAbertas().has(posicao);
  }

  alternarEtapa(posicao: number): void {
    const abertas = new Set(this.etapasAbertas());
    if (!abertas.delete(posicao)) abertas.add(posicao);
    this.etapasAbertas.set(abertas);
  }

  /**
   * Os blocos abertos dentro de cada etapa, na chave `posição:bloco`.
   *
   * Recolhidos por padrão, como a etapa e a fase: cada janela recursal declarada ocupa uma
   * grade inteira, e a prova objetiva do certame qualificado abre duas.
   */
  private readonly blocosAbertos = signal<ReadonlySet<string>>(new Set());

  blocoAberto(posicao: number, bloco: 'recursos' | 'publica'): boolean {
    return this.blocosAbertos().has(`${posicao}:${bloco}`);
  }

  alternarBloco(posicao: number, bloco: 'recursos' | 'publica'): void {
    const abertos = new Set(this.blocosAbertos());
    const chave = `${posicao}:${bloco}`;
    if (!abertos.delete(chave)) abertos.add(chave);
    this.blocosAbertos.set(abertos);
  }

  /** O que o cabeçalho recolhido diz sobre as janelas recursais da etapa. */
  resumoDosRecursos(grupo: FormGroup<EtapaForm>): string {
    const total = this.recursosDaEtapa(grupo).length;
    if (total === 0) return 'nenhum recurso';
    return total === 1 ? '1 recurso' : `${total} recursos`;
  }

  /** O que o cabeçalho recolhido diz sobre o que a etapa publica. */
  resumoDasPublicacoes(grupo: FormGroup<EtapaForm>): string {
    const total = this.produtosDaEtapa(grupo).filter((p) => p.atoCodigo !== '').length;
    if (total === 0) return 'não publica nada';
    return total === 1 ? '1 publicação' : `${total} publicações`;
  }

  /**
   * Os caracteres que a etapa pode ter, dado o tipo escolhido.
   *
   * O recorte vem do cadastro de Configuração, onde cada tipo declara se compõe a nota final e
   * se elimina candidato — e não de uma lista de códigos escrita aqui, que envelheceria no dia
   * em que o CEPS cadastrasse um tipo novo. É esse recorte que faz peso e nota mínima
   * desaparecerem de uma análise documental sem que a tela precise saber o que ela é.
   */
  caracteresPara(grupo: FormGroup<EtapaForm>): readonly { valor: string; rotulo: string }[] {
    this.versaoDoFormulario();
    const tipo = this.catalogos.tipoEtapaPorId().get(grupo.controls.tipoEtapaOrigemId.value);

    // Sem tipo escolhido não há o que restringir: a etapa ainda não disse de que natureza é.
    // A etapa de nota do ENEM sempre compõe a média: puramente eliminatória, ela ficaria
    // fora do divisor, e a nota que ela traz não pesaria em nada.
    const notaDoEnem = this.etapaDeNotaDoEnem(grupo);
    const admitidos: readonly { valor: string; rotulo: string }[] =
      tipo === undefined
        ? CARATERES
        : CARATERES.filter(
            (opcao) =>
              (opcao.valor === 'classificatoria' && tipo.admitePontuacao) ||
              (opcao.valor === 'eliminatoria' && tipo.admiteEliminacao && !notaDoEnem) ||
              (opcao.valor === 'ambas' && tipo.admitePontuacao && tipo.admiteEliminacao),
          );

    const escolhido = grupo.controls.carater.value;
    if (escolhido === '' || admitidos.some((opcao) => opcao.valor === escolhido)) {
      return admitidos;
    }

    // Caráter que o cadastro deixou de admitir depois de a etapa ter sido gravada: continua na
    // lista, nomeado. Sumir seria o formulário mentindo sobre o que está gravado, e a gravação
    // seguinte recusaria sem que ninguém tivesse visto o quê.
    const rotulo = CARATERES.find((opcao) => opcao.valor === escolhido)?.rotulo ?? escolhido;
    return [...admitidos, { valor: escolhido, rotulo: `${rotulo} (não mais admitido)` }];
  }

  /**
   * Troca o tipo da etapa. Não mexe no caráter de propósito: se o tipo novo não o admitir, ele
   * permanece visível e marcado por `caracteresPara`, e a recusa vem na gravação com o motivo.
   * O que some da tela com o tipo novo, esse sim é descartado, porque não fica visível para
   * ser corrigido.
   */
  escolherTipoEtapa(grupo: FormGroup<EtapaForm>, tipoEtapaOrigemId: string): void {
    grupo.controls.tipoEtapaOrigemId.setValue(tipoEtapaOrigemId);
    if (this.etapaDeNotaDoEnem(grupo)) this.descartarOQueANotaDoEnemNaoTem(grupo);
    this.versaoDoFormulario.update((versao) => versao + 1);
  }

  /** A nota da etapa vem do ENEM do candidato — é calculada, não lançada por banca. */
  etapaDeNotaDoEnem(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    const etapa = grupo.getRawValue();
    return declaraNotaDoEnem(etapa, this.catalogos.tipoEtapaPorId().get(etapa.tipoEtapaOrigemId));
  }

  /**
   * Banca, publicação, janela própria e recurso contado de publicação somem da tela da
   * etapa de nota do ENEM. Ficar com o que já estava declarado seria mandar ao servidor, a
   * cada gravação, o que ninguém vê e ele recusa.
   */
  private descartarOQueANotaDoEnemNaoTem(grupo: FormGroup<EtapaForm>): void {
    grupo.controls.bancas.setValue([]);
    grupo.controls.produtos.setValue([]);
    grupo.controls.inicio.setValue('');
    grupo.controls.fim.setValue('');
    grupo.controls.recursos.setValue(
      grupo.controls.recursos.value.filter((recurso) => recurso.ancora === 'cienciaIndividual'),
    );
  }

  /**
   * A etapa entra no cálculo da nota final — e, por isso, o peso dela tem efeito.
   *
   * Quem decide é o caráter, não o tipo: `CalcularDivisorMedia` soma o peso das etapas
   * classificatórias e das que são ambas, e ignora as puramente eliminatórias. Peso numa
   * eliminatória é dado morto que o operador acredita estar declarando.
   */
  etapaComponeNota(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    const carater = grupo.controls.carater.value;
    return carater === 'classificatoria' || carater === 'ambas';
  }

  /** A etapa corta candidato — é onde a nota mínima tem o que fazer. */
  etapaElimina(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    const carater = grupo.controls.carater.value;
    return carater === 'eliminatoria' || carater === 'ambas';
  }

  /**
   * Troca o caráter e apaga o que deixou de valer.
   *
   * Sem isto, quem declara peso 3 e depois muda para eliminatória fica com o 3 gravado e
   * invisível: o campo some da tela, o valor continua no rascunho e vai para o servidor a
   * cada gravação, sem que nada o use.
   */
  escolherCarater(grupo: FormGroup<EtapaForm>, carater: string): void {
    grupo.controls.carater.setValue(carater as CaraterEscolhido);
    if (!this.etapaComponeNota(grupo)) grupo.controls.peso.setValue('');
    if (!this.etapaElimina(grupo)) grupo.controls.notaMinima.setValue('');
    this.versaoDoFormulario.update((versao) => versao + 1);
  }

  /** O nome que a etapa já tem, ou o que a linha fechada mostra enquanto ele não existe. */
  nomeDaEtapa(grupo: FormGroup<EtapaForm>): string {
    const nome = grupo.controls.nome.value.trim();
    return nome === '' ? 'Etapa sem nome' : nome;
  }

  /**
   * O que a linha fechada diz sobre a etapa, para o operador não precisar abrir para saber.
   *
   * Só o que está declarado aparece: uma etapa recém-acrescentada mostra o tipo e nada mais,
   * e é assim que a lista distingue o que já foi configurado do que ainda não.
   */
  marcasDaEtapa(grupo: FormGroup<EtapaForm>): readonly string[] {
    const marcas: string[] = [];

    const tipo = this.catalogos.rotuloDoTipoEtapa().get(grupo.controls.tipoEtapaOrigemId.value);
    if (tipo !== undefined) marcas.push(tipo);

    const publicacoes = this.produtosDaEtapa(grupo).filter((p) => p.atoCodigo !== '').length;
    if (publicacoes > 0) {
      marcas.push(publicacoes === 1 ? '1 publicação' : `${publicacoes} publicações`);
    }

    const bancas = this.bancasDaEtapa(grupo).length;
    if (bancas > 0) marcas.push(bancas === 1 ? '1 banca' : `${bancas} bancas`);

    const recursos = this.recursosDaEtapa(grupo).length;
    if (recursos > 0) marcas.push(recursos === 1 ? '1 recurso' : `${recursos} recursos`);

    if (grupo.controls.emiteParecerIndividual.value) marcas.push('parecer individual');

    return marcas;
  }

  /**
   * A fase cuja remoção espera confirmação — ninguém perde etapa e documento sem ler antes
   * quanto vai junto.
   */
  readonly remocaoAConfirmar = signal<number | null>(null);

  pedirRemocaoDaFase(indice: number): void {
    // Fase sem nada pendurado não precisa de confirmação: não há o que avisar.
    const dependentes = this.dependentesDaFase(indice);
    if (dependentes.etapas === 0 && dependentes.documentos === 0) {
      this.removerFase(indice);
      return;
    }

    this.remocaoAConfirmar.set(indice);
  }

  desistirDaRemocao(): void {
    this.remocaoAConfirmar.set(null);
  }

  confirmarRemocaoDaFase(indice: number): void {
    this.remocaoAConfirmar.set(null);
    this.removerFase(indice);
  }

  /** O que a confirmação enuncia, na língua de quem monta o edital. */
  resumoDaRemocao(indice: number): string {
    const { etapas, documentos } = this.dependentesDaFase(indice);
    const partes: string[] = [];
    if (etapas > 0) partes.push(etapas === 1 ? '1 etapa' : `${etapas} etapas`);
    if (documentos > 0) {
      partes.push(documentos === 1 ? '1 documento exigido' : `${documentos} documentos exigidos`);
    }
    return partes.join(' e ');
  }

  /**
   * O que a remoção da fase leva junto, para a confirmação dizer antes de acontecer.
   *
   * Etapas e documentos existem por causa da fase: a etapa declara em que fase acontece, e a
   * exigência documental declara em que fase é entregue. Some a fase, somem eles — mas o
   * operador precisa saber disso antes de clicar, não depois de perder a configuração.
   */
  dependentesDaFase(indice: number): { etapas: number; documentos: number } {
    const codigo = this.fases.at(indice)?.controls.codigo.value ?? '';
    if (codigo === '') return { etapas: 0, documentos: 0 };

    const etapas = this.etapas.controls.filter(
      (grupo) => grupo.controls.faseCodigo.value === codigo,
    ).length;

    // A contagem varre a ÁRVORE de exigências, que é como o rascunho as guarda. Enquanto ela
    // percorria os valores do objeto como se fossem os registros planos do modelo anterior,
    // dava sempre zero: a fase com documentos e sem etapa era removida sem confirmação
    // nenhuma, levando as exigências junto, e com etapas a confirmação omitia o que se perdia.
    const documentos = exigenciasDaFase(this.store.draft().documentos, codigo).length;

    return { etapas, documentos };
  }

  /**
   * Tira a fase da linha do tempo, com o que era só dela.
   *
   * Antes, a remoção limpava TODAS as etapas do processo quando a fase saída era a que o
   * cadastro marca como agrupadora — apagava as etapas das outras fases junto — e, em
   * qualquer outra fase, deixava as etapas dela órfãs, apontando para uma fase que não
   * existe mais; a gravação seguinte era recusada pelo servidor sem dizer o que fazer.
   */
  removerFase(indice: number): void {
    const removida = this.fases.at(indice);
    if (removida === undefined) return;

    const codigo = removida.controls.codigo.value;

    this.remocaoAConfirmar.set(null);
    this.fases.removeAt(indice, { emitEvent: false });
    this.removerEtapasDaFase(codigo);
    this.removerDocumentosDaFase(codigo);
    this.renumerarFases();
    this.avisoDeReordenacao.set(null);
  }

  /** As etapas daquela fase, e só elas — identificadas pelo código que cada uma declara. */
  private removerEtapasDaFase(codigo: string): void {
    for (let posicao = this.etapas.length - 1; posicao >= 0; posicao -= 1) {
      if (this.etapas.at(posicao).controls.faseCodigo.value === codigo) {
        this.etapas.removeAt(posicao, { emitEvent: false });
      }
    }
  }

  /**
   * Tira a fase do alcance de cada documento. O documento que valia só ali deixa de ser
   * exigido; o que valia em mais fases continua, sem ela.
   */
  private removerDocumentosDaFase(codigo: string): void {
    this.store.patchSection('documentos', semAFase(this.store.draft().documentos, codigo));
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

  /**
   * A convenção é identificada por código **e** versão: publicar versão nova
   * do catálogo não pode mudar a regra que um processo já declarou. Escolher
   * pelo código e deduzir a versão do que está carregado é o que mantém o par
   * coerente — gravar código novo com versão velha é recusado.
   */
  escolherAlgoritmo(codigo: string): void {
    const versao = this.regrasDeContagem().find((regra) => regra.codigo === codigo)?.versao ?? '';
    this.formulario.controls.algoritmoContagemCodigo.setValue(codigo);
    this.formulario.controls.algoritmoContagemVersao.setValue(versao);
    // O valor de um FormControl não é signal: sem avisar, a descrição da convenção
    // escolhida continuaria mostrando a anterior.
    this.versaoDoFormulario.update((versaoAtual) => versaoAtual + 1);
  }

  // ── O que a etapa publica ──────────────────────────────────────────────────
  // Mesmo desenho que a fase já usa um nível acima: a coleção é substituída por
  // inteiro, e trocar o ato zera o papel, porque só ato que o catálogo marca como
  // resultado o recebe.

  produtosDaEtapa(grupo: FormGroup<EtapaForm>): readonly ProdutoDaFase[] {
    this.versaoDoFormulario();
    return grupo.controls.produtos.value;
  }

  acrescentarProdutoNaEtapa(grupo: FormGroup<EtapaForm>): void {
    this.escreverProdutosDaEtapa(grupo, [
      ...grupo.controls.produtos.value,
      { atoCodigo: '', papel: null },
    ]);
  }

  removerProdutoDaEtapa(grupo: FormGroup<EtapaForm>, posicao: number): void {
    this.escreverProdutosDaEtapa(
      grupo,
      grupo.controls.produtos.value.filter((_, indice) => indice !== posicao),
    );
  }

  escolherAtoDaEtapa(grupo: FormGroup<EtapaForm>, posicao: number, atoCodigo: string): void {
    this.escreverProdutosDaEtapa(
      grupo,
      grupo.controls.produtos.value.map((produto, indice) =>
        indice === posicao ? { atoCodigo, papel: null } : produto,
      ),
    );
  }

  escolherPapelDaEtapa(grupo: FormGroup<EtapaForm>, posicao: number, papel: string): void {
    const escolhido = papel === '' ? null : (papel as ProdutoDaFase['papel']);
    this.escreverProdutosDaEtapa(
      grupo,
      grupo.controls.produtos.value.map((produto, indice) =>
        indice === posicao ? { ...produto, papel: escolhido } : produto,
      ),
    );
  }

  /** Só ato que o catálogo marca como resultado admite papel no ciclo recursal. */
  atoEhResultado(atoCodigo: string): boolean {
    return this.catalogos.atoPorCodigo().get(atoCodigo)?.ehResultado === true;
  }

  private escreverProdutosDaEtapa(grupo: FormGroup<EtapaForm>, produtos: readonly ProdutoDaFase[]): void {
    // `valueChanges` do formulário já propaga para o rascunho e incrementa a versão —
    // não há o que marcar aqui além do próprio controle.
    grupo.controls.produtos.setValue(produtos);
    grupo.controls.produtos.markAsDirty();
  }

  // ── Bancas e janelas recursais da etapa ────────────────────────────────────

  bancasDaEtapa(grupo: FormGroup<EtapaForm>): readonly string[] {
    this.versaoDoFormulario();
    return grupo.controls.bancas.value;
  }

  alternarBancaDaEtapa(grupo: FormGroup<EtapaForm>, tipoBancaId: string, marcada: boolean): void {
    const atuais = grupo.controls.bancas.value;
    const proximas = marcada
      ? [...new Set([...atuais, tipoBancaId])]
      : atuais.filter((id) => id !== tipoBancaId);
    grupo.controls.bancas.setValue(proximas);
    grupo.controls.bancas.markAsDirty();
  }

  recursosDaEtapa(grupo: FormGroup<EtapaForm>): readonly RecursoDaEtapa[] {
    this.versaoDoFormulario();
    return grupo.controls.recursos.value;
  }

  /**
   * A janela nasce ancorada no primeiro produto preliminar da etapa, quando existe: é o
   * caso comum, e deixar o campo vazio obrigaria o operador a escolher de novo o que a
   * própria etapa já declarou publicar.
   */
  acrescentarRecursoNaEtapa(grupo: FormGroup<EtapaForm>): void {
    const preliminar = grupo.controls.produtos.value.find((p) => p.papel === PAPEL_PRELIMINAR);
    // A etapa de nota do ENEM não publica ato: o único relógio é a ciência do candidato.
    const ancora: RecursoDaEtapa['ancora'] = this.etapaDeNotaDoEnem(grupo)
      ? 'cienciaIndividual'
      : 'atoPublicado';
    const regra = this.regraDoCatalogo(ancora);
    this.escreverRecursos(grupo, [
      ...grupo.controls.recursos.value,
      {
        ancora,
        regraCodigo: regra?.codigo ?? '',
        regraVersao: regra?.versao ?? '',
        prazoValor: '',
        prazoUnidade: 'diasUteis',
        atoAncoraCodigo: preliminar?.atoCodigo ?? '',
        // Nasce sem suspensividade — declarar o par é escolha do operador, e os dois em
        // branco são a desativação prevista daquela instância.
        suspensividadePrimeiraInstanciaValor: '',
        suspensividadePrimeiraInstanciaUnidade: '',
        suspensividadeSegundaInstanciaValor: '',
        suspensividadeSegundaInstanciaUnidade: '',
      },
    ]);
  }

  /**
   * A regra de prazo que o catálogo oferece para cada âncora. São duas regras distintas
   * porque são dois relógios: um conta da publicação do ato, o outro da ciência de cada
   * candidato.
   */
  private regraDoCatalogo(ancora: RecursoDaEtapa['ancora']) {
    const alvo = ancora === 'atoPublicado' ? 'ANCORADO-EM-ATO' : 'ANCORADO-EM-CIENCIA';
    return (
      this.catalogos.regrasRecurso().find((regra) => regra.codigo.includes(alvo)) ??
      this.catalogos.regrasRecurso()[0]
    );
  }

  /** Sem regra de prazo no catálogo, não há janela recursal declarável. */
  temRegraDeRecurso(): boolean {
    return this.catalogos.regrasRecurso().length > 0;
  }

  removerRecursoDaEtapa(grupo: FormGroup<EtapaForm>, posicao: number): void {
    this.escreverRecursos(grupo, grupo.controls.recursos.value.filter((_, i) => i !== posicao));
  }

  alterarRecursoDaEtapa(
    grupo: FormGroup<EtapaForm>,
    posicao: number,
    campo: keyof RecursoDaEtapa,
    valor: string,
  ): void {
    this.escreverRecursos(
      grupo,
      grupo.controls.recursos.value.map((recurso, i) => {
        if (i !== posicao) return recurso;
        if (campo === 'ancora') {
          const ancora = valor as RecursoDaEtapa['ancora'];
          const regra = this.regraDoCatalogo(ancora);
          // A ciência não tem publicação a referenciar: o ato âncora sai junto, e a regra
          // de prazo muda, porque o relógio é outro.
          return {
            ...recurso,
            ancora,
            regraCodigo: regra?.codigo ?? recurso.regraCodigo,
            regraVersao: regra?.versao ?? recurso.regraVersao,
            atoAncoraCodigo: ancora === 'atoPublicado' ? recurso.atoAncoraCodigo : '',
          };
        }

        if (campo === 'regraCodigo') {
          const regra = this.catalogos.regrasRecurso().find((r) => r.codigo === valor);
          return { ...recurso, regraCodigo: valor, regraVersao: regra?.versao ?? '' };
        }

        return { ...recurso, [campo]: valor };
      }),
    );
  }

  /** Os produtos preliminares da etapa — os únicos em que uma janela pode ancorar. */
  preliminaresDaEtapa(grupo: FormGroup<EtapaForm>): readonly ProdutoDaFase[] {
    this.versaoDoFormulario();
    return grupo.controls.produtos.value.filter((p) => p.papel === PAPEL_PRELIMINAR);
  }

  private escreverRecursos(grupo: FormGroup<EtapaForm>, recursos: readonly RecursoDaEtapa[]): void {
    grupo.controls.recursos.setValue(recursos);
    grupo.controls.recursos.markAsDirty();
  }

  acrescentarEtapa(faseCodigo = ''): void {
    this.etapas.push(
      grupoDaEtapa({
        id: null,
        nome: '',
        carater: '',
        tipoEtapaOrigemId: '',
        peso: '',
        notaMinima: '',
        ordem: this.etapas.length + 1,
        faseCodigo,
        produtos: [],
        inicio: '',
        fim: '',
        emiteParecerIndividual: false,
        bancas: [],
        recursos: [],
      }),
    );
  }

  removerEtapa(indice: number): void {
    const removida = this.etapas.at(indice).controls.id.value;
    this.etapas.removeAt(indice, { emitEvent: false });
    this.renumerarEtapas();
    this.desvincularDocumentosDaEtapa(removida);
  }

  /**
   * Tira a etapa removida do registro de quem a apontava como ponto de coleta. Sem isto o
   * rascunho reenviaria o identificador de uma etapa que não existe mais, e a gravação
   * seguinte seria recusada — sem que a tela mostrasse onde está o problema, porque o
   * seletor "Coletado em" não tem opção para um id que sumiu e exibe "A fase inteira".
   */
  private desvincularDocumentosDaEtapa(etapaId: string | null): void {
    if (etapaId === null || etapaId === '') return;

    this.store.patchSection('documentos', semAEtapa(this.store.draft().documentos, etapaId));
  }

  /**
   * Esvazia as etapas de uma vez. Existe para o cronograma que ficou sem a fase
   * que as agrupa: a conferência manda acrescentar a fase ou remover as etapas,
   * e remover uma a uma é o caminho longo para a mesma decisão.
   */
  removerTodasAsEtapas(): void {
    this.etapas.clear();
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
   * Grava as três dimensões: etapas e cronograma de fases, na ordem que a
   * bicondicional do agregado exige, e por último a convenção de contagem de
   * prazo — só quando o rascunho declara uma.
   *
   * A ordem entre etapas e cronograma não é preferência: a fase que agrupa
   * etapas é recusada na hora se o processo não tiver nenhuma etapa, então
   * gravar o cronograma antes das etapas derrubaria a gravação de um
   * cronograma que é válido.
   *
   * As duas vão juntas mesmo quando só uma mudou. O acoplamento que isso
   * poderia criar — uma etapa malformada impedindo a correção de uma data — não
   * chega a existir, porque a conferência acima recusa antes de qualquer envio e
   * aponta a etapa; e um `PUT` que substitui a coleção pelo mesmo conteúdo não
   * muda nada no servidor.
   *
   * O algoritmo vem por último e é opcional: ausência é estado válido
   * enquanto rascunho (CA-05) — o endpoint recusa código ou versão nulos, e
   * não existe caminho para desdeclarar a convenção depois de escolhida. Se
   * ele falhar, as duas primeiras chamadas já gravaram, e a mensagem diz isso
   * em vez de tratar a falha como se nada tivesse sido salvo.
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
    if (!conferencia.valid) {
      // O que a conferência acusa pode estar numa fase fechada: abrir todas põe o problema à
      // vista, em vez de deixar a mensagem apontar para um lugar que não está na tela.
      this.expandirTodasAsFases();
      return conferencia;
    }

    const fases = this.fases.controls.map(faseDoFormulario);
    const etapas = this.etapas.controls.map(etapaDoFormulario);
    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      // O cronograma vai primeiro, sempre: a etapa declara a fase em que acontece, e o
      // servidor recusa etapa cuja fase ainda não está no cronograma. Um certame montado do
      // zero — nenhuma fase gravada ainda — não teria como gravar etapa nenhuma na ordem
      // inversa.
      //
      // A ordem oposta existia para proteger a bicondicional por sinalizador: enquanto a fase
      // agrupadora era a única que podia ter etapas, gravar o cronograma antes a deixava sem
      // nenhuma, e o agregado recusava na hora. Desde que a etapa passou a declarar a própria
      // fase, essa recusa saiu — qualquer fase se subdivide, e é o vínculo que responde por
      // onde a etapa vive. Remover uma fase também é seguro por aqui: o agregado poda as
      // etapas dela junto.
      const cronograma = await gravarCronogramaFases(this.cadastro, processoId, fases);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!cronograma.ok) {
        return {
          valid: false,
          messages: [this.explicarRecusa(cronograma.problem.code, cronograma.problem)],
        };
      }

      const gravacaoDeEtapas = await this.cadastro.definirEtapas(
        processoId,
        etapas.map(comoComandoDeEtapa),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!gravacaoDeEtapas.ok) {
        return {
          valid: false,
          messages: [
            recusaDaEtapaDeNotaDoEnem(gravacaoDeEtapas.problem.code) ??
              this.problemI18n.resolve(gravacaoDeEtapas.problem).title,
          ],
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

      // As exigências documentais vão por último e dependem das duas gravações
      // anteriores: a exigência referencia a fase pelo id que o servidor atribui, e
      // a etapa que a coleta pelo id que a reconciliação acabou de recolher.
      const exigencias = await this.gravarExigenciasDocumentais(processoId);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!exigencias.valid) return exigencias;

      // Ausência é estado válido em rascunho (CA-05): a chamada só acontece
      // quando há escolha. O código e a versão do formulário sempre andam
      // juntos — `escolherAlgoritmo` os grava ao mesmo tempo —, então checar
      // um basta para saber que o par está completo.
      const codigoAlgoritmo = this.formulario.controls.algoritmoContagemCodigo.value;
      if (codigoAlgoritmo !== '') {
        const algoritmo = await this.cadastro.definirAlgoritmoContagemPrazo(processoId, {
          codigo: codigoAlgoritmo,
          versao: this.formulario.controls.algoritmoContagemVersao.value,
        });
        if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
        if (!algoritmo.ok) {
          return {
            valid: false,
            messages: [
              `As etapas e o cronograma de fases foram gravados. ${this.problemI18n.resolve(algoritmo.problem).title}`,
            ],
          };
        }

        // A partir daqui o endpoint não tem operação de remoção: o seletor
        // deixa de oferecer "nenhuma convenção" para não convidar a uma
        // gravação futura que a tela pularia em silêncio.
        this.algoritmoConfirmadoNestaSessao.set(true);
      }

      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * O piso do campo de data e hora: nunca antes de hoje, e nunca depois do que o campo já
   * carrega.
   *
   * Recebe os limites que valem para aquele campo — o início da fase, para uma etapa que precisa
   * caber nela; o início da própria janela, para um fim. Passar o valor atual é o que impede o
   * piso de invalidar cronograma já em curso, que é o caso da retificação.
   */
  pisoDeData(valorAtual: string, ...limites: readonly (string | null | undefined)[]): string | null {
    return pisoDoCampoDeData(valorAtual, inicioDeHojeNoFusoInstitucional(), ...limites);
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Grava os documentos que cada fase exige.
   *
   * A conversão precisa do id de cada fase, que o rascunho não guarda — ele identifica
   * a fase pelo código canônico, que é o que sobrevive à reconciliação do servidor. A
   * releitura aqui é a que traduz um no outro; sem ela, a exigência sairia apontando
   * para uma fase que só existe no rascunho.
   */
  private async gravarExigenciasDocumentais(processoId: string): Promise<StepValidation> {
    const geracao = this.store.geracao();
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!isApiOk(detalhe)) {
      return {
        valid: false,
        messages: [
          'As etapas e o cronograma foram gravados, mas não foi possível reler as fases para gravar os documentos exigidos. Tente gravar de novo.',
        ],
      };
    }

    const faseIdPorCodigo = new Map(detalhe.data.cronogramaFases.map((f) => [f.codigo, f.id]));
    const raizes = arvoreDeExigencias(
      this.store.draft().documentos,
      faseIdPorCodigo,
      this.store.modalidadesDoProcesso(),
      new Set(detalhe.data.etapas.map((etapa) => etapa.id)),
    );

    // Os campos do formulário saem ANTES das exigências, e não é preferência de ordem: uma
    // exigência condicionada a um fato só se resolve se o certame coletar aquele fato. Quem
    // declara a condição é este passo, então é ele que garante o campo — o operador não
    // deveria precisar lembrar que decidir de quem o documento é cobrado mexe no formulário.
    // A matriz de derivação é buscada ANTES de os campos serem gravados: as regras dela
    // perguntam ao candidato se ele quer concorrer a cada cota, e uma regra que cita fato que o
    // processo não coleta é recusada. Os dois comandos gravam em seguida, nessa ordem.
    const proposta = await this.propostaDeDerivacaoDeModalidade(processoId, detalhe.data);
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!proposta.ok) return proposta.recusa;

    const campos = await this.garantirCamposQueAsExigenciasPressupoem(
      processoId,
      detalhe.data,
      proposta.dependencias,
    );
    if (geracao !== this.store.geracao()) return { valid: true };
    if (campos !== null) return campos;

    const derivacao = await this.gravarDerivacaoDeModalidade(
      processoId,
      proposta.matriz,
      detalhe.data,
    );
    if (geracao !== this.store.geracao()) return { valid: true };
    if (derivacao !== null) return derivacao;

    const gravacao = await this.cadastro.definirDocumentosExigidos(processoId, raizes);
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!gravacao.ok) {
      return {
        valid: false,
        messages: [
          `As etapas, o cronograma, o formulário de inscrição e as regras de modalidade foram gravados. ${this.problemI18n.resolve(gravacao.problem).title}`,
        ],
      };
    }

    return { valid: true };
  }

  /**
   * Põe no formulário de inscrição os campos que as exigências deste cronograma pressupõem, e
   * grava. Devolve `null` quando deu certo, ou a recusa a ser exibida.
   *
   * Nada é gravado quando não há o que mudar: o comando substitui a coleção inteira, e uma
   * chamada por gravação de cronograma seria escrita à toa na maioria das vezes.
   */
  private async garantirCamposQueAsExigenciasPressupoem(
    processoId: string,
    servidor: ProcessoSeletivoDto,
    dependenciasDaDerivacao: readonly string[],
  ): Promise<StepValidation | null> {
    const draft = this.store.draft();
    const antes = new Set(draft.formulario.fatos.map((campo) => campo.fatoCodigo));

    // Este caminho só ACRESCENTA — o conjunto de "postos por exigência" vai vazio de propósito.
    // Quem decide TIRAR campo é o passo do formulário, que sabe distinguir o que entrou por
    // causa de um gatilho do que foi declarado de propósito.
    const reconciliado = comCamposQueAsExigenciasPressupoem(
      draft.formulario,
      draft.documentos,
      this.catalogos.fatos(),
      new Set(),
      dependenciasDaDerivacao,
    );

    if (reconciliado !== draft.formulario) {
      // O que entrou aqui entrou SOZINHO, e precisa ficar registrado como tal: sem isso, o
      // formulário não reconhece o campo como posto por exigência e o preserva mesmo depois
      // de o gatilho que o pediu ser apagado — a inscrição seguiria coletando dado pessoal
      // que já não tem finalidade declarada.
      const acrescentados = reconciliado.fatos
        .map((campo) => campo.fatoCodigo)
        .filter((codigo) => !antes.has(codigo));
      if (acrescentados.length > 0) {
        this.store.camposPostosPelasExigencias.update(
          (atual) => new Set([...atual, ...acrescentados]),
        );
      }

      this.store.patchSection('formulario', reconciliado);
    }

    // A decisão de gravar é contra o SERVIDOR, não contra o rascunho. Comparando com o
    // rascunho, a retentativa pulava justamente o comando que tinha falhado: a primeira
    // tentativa já havia aplicado a mudança localmente, e a segunda não via mais diferença.
    const desejados = comoComandoDeFatosColetados(reconciliado);
    if (!divergeDoServidor(desejados, servidor.fatosColetados ?? [])) return null;

    const gravacao = await this.cadastro.definirFatosColetados(processoId, desejados);
    if (gravacao.ok) return null;

    return {
      valid: false,
      messages: [
        `As etapas e o cronograma foram gravados. ${this.problemI18n.resolve(gravacao.problem).title}`,
      ],
    };
  }

  /**
   * A matriz de derivação de modalidade a gravar, e os campos de formulário de que ela
   * depende. Devolve matriz vazia quando não há o que fazer.
   *
   * A modalidade não é declarada pelo candidato: ela RESULTA da avaliação dos opt-ins e das
   * elegibilidades dele contra as regras do certame. Sem essas regras, dizer "este documento é
   * de quem concorre na cota tal" é escrever uma condição que nunca resolverá — e é por isso
   * que o servidor recusa a gravação, não porque o recorte esteja errado.
   *
   * A matriz vem do próprio servidor, recortada para as modalidades que este processo oferta.
   * Ela não é escrita aqui de propósito: de que opt-ins e de que elegibilidades cada cota se
   * compõe é matéria da Lei 12.711/2012, e uma segunda cópia dela no wizard divergiria em
   * silêncio da que classifica os candidatos.
   *
   * As dependências saem daqui junto com a matriz porque as duas coisas se gravam em ordem: as
   * regras perguntam ao candidato se ele quer concorrer a cada cota e se veio de escola
   * pública, e uma regra que cite fato que o processo não coleta é recusada. Buscá-las depois
   * de gravar os campos deixaria o certame com uma matriz que o servidor não aceita.
   */
  private async propostaDeDerivacaoDeModalidade(
    processoId: string,
    servidor: ProcessoSeletivoDto,
  ): Promise<
    | { ok: true; matriz: readonly ConfiguracaoDerivacaoInput[]; dependencias: readonly string[] }
    | { ok: false; recusa: StepValidation }
  > {
    const vazia = { ok: true, matriz: [], dependencias: [] } as const;

    const recorta = todasAsExigencias(this.store.draft().documentos).some(
      (exigencia) => modalidadesDaExigencia(exigencia) !== null,
    );
    if (!recorta) return vazia;

    // Quem já declara como deriva a modalidade não tem a matriz substituída pela proposta a
    // cada gravação de cronograma: o ajuste que fez é dele.
    const jaDeriva = (servidor.regrasDerivacao ?? []).some(
      (config) => config.codigoFato === FATO_MODALIDADE,
    );
    if (jaDeriva) return vazia;

    const proposta = await firstValueFrom(this.api.obterRegrasDerivacaoNormativas(processoId));
    if (!isApiOk(proposta)) {
      return {
        ok: false,
        recusa: {
          valid: false,
          messages: [
            `As etapas e o cronograma foram gravados. ${this.problemI18n.resolve(proposta.problem).title}`,
          ],
        },
      };
    }

    // Proposta vazia é o processo que ainda não declarou quadro de vagas. A exigência que
    // recorta modalidade nenhuma já é acusada pela conferência de alcance, com uma mensagem
    // que fala do quadro de vagas — a que viria daqui falaria de regra de derivação, que é
    // consequência, não causa.
    if (proposta.data.length === 0) return vazia;

    return {
      ok: true,
      matriz: proposta.data,
      dependencias: [
        ...new Set(
          proposta.data.flatMap((config) => fatosCitadosPelaDerivacao(config.regras)),
        ),
      ],
    };
  }

  /** Grava a matriz proposta. Devolve `null` quando deu certo, ou a recusa a ser exibida. */
  private async gravarDerivacaoDeModalidade(
    processoId: string,
    matriz: readonly ConfiguracaoDerivacaoInput[],
    servidor: ProcessoSeletivoDto,
  ): Promise<StepValidation | null> {
    if (matriz.length === 0) return null;

    // O comando SUBSTITUI a coleção inteira. Enviar só a matriz de modalidade apagaria a
    // derivação de qualquer outro fato que o processo já declarasse — hoje não há um segundo
    // fato derivável no catálogo, e é justamente por isso que o dia em que houver a perda
    // seria silenciosa.
    const preservadas = (servidor.regrasDerivacao ?? []).filter(
      (config) => config.codigoFato !== FATO_MODALIDADE,
    );

    const gravacao = await this.cadastro.definirRegrasDerivacao(processoId, [
      ...preservadas,
      ...matriz,
    ]);
    if (!gravacao.ok) {
      return {
        valid: false,
        messages: [
          `As etapas e o cronograma foram gravados, e o formulário de inscrição está com os campos que as regras de modalidade pressupõem. ${this.problemI18n.resolve(gravacao.problem).title}`,
        ],
      };
    }

    // O rascunho acompanha o que foi gravado — sem isto, os campos que a matriz acabou de
    // pressupor apareceriam no passo do formulário como campos que nada no certame usa, e a
    // tela pediria para conferir se ainda há motivo para pedi-los ao candidato.
    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      derivacao: [...preservadas, ...matriz].map((config) => ({
        codigoFato: config.codigoFato,
        regras: config.regras,
      })),
    });

    return null;
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
    if (codigo === PERMUTACAO_DE_ORDEM) return ORIENTACAO_DE_PERMUTACAO;
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
  private espelharRascunho(cronograma: WizardDraft['cronograma']): void {
    const atuais = {
      fases: this.fases.controls.map(faseDoFormulario),
      etapas: this.etapas.controls.map(etapaDoFormulario),
    };
    const algoritmoIgual =
      this.formulario.controls.algoritmoContagemCodigo.value ===
        cronograma.algoritmoContagemCodigo &&
      this.formulario.controls.algoritmoContagemVersao.value ===
        cronograma.algoritmoContagemVersao;

    if (
      mesmoConteudo(atuais.fases, cronograma.fases) &&
      mesmoConteudo(atuais.etapas, cronograma.etapas) &&
      algoritmoIgual
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

      this.formulario.controls.algoritmoContagemCodigo.setValue(
        cronograma.algoritmoContagemCodigo,
        { emitEvent: false },
      );
      this.formulario.controls.algoritmoContagemVersao.setValue(
        cronograma.algoritmoContagemVersao,
        { emitEvent: false },
      );

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

/**
 * Lê uma lista de textos publicada pelo catálogo — os invariantes de uma regra chegam como
 * JSON solto, e o contrato não promete a forma.
 *
 * Nada de inventar: o que não for texto dentro de um array é descartado em silêncio, e a
 * tela mostra o que sobrou. Uma lista vazia esconde a seção inteira, que é melhor do que
 * exibir um rótulo de seção sem nada embaixo.
 */
function textosDoCatalogo(conteudo: unknown): readonly string[] {
  if (!Array.isArray(conteudo)) return [];
  return conteudo.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

/**
 * Como a tela nomeia o papel de uma publicação. O token que o contrato venha a
 * acrescentar aparece como veio: inventar rótulo para o desconhecido esconderia
 * do operador que a fase declara algo que esta tela ainda não sabe descrever.
 */
function rotuloDoPapel(papel: string | null): string {
  if (papel === PAPEL_PRELIMINAR) return 'resultado preliminar';
  if (papel === PAPEL_DEFINITIVO) return 'resultado definitivo';
  return papel ?? 'não é resultado';
}
