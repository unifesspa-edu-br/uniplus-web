import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { ProblemI18nService, isApiOk } from '@uniplus/shared-core/http';
import { firstValueFrom } from 'rxjs';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { ComboboxComponent, type UiComboboxGroup } from '@uniplus/shared-ui/components';
import { FatoCandidatoView, FatosCandidatoApi } from '@uniplus/shared-data/configuracao';

import type { FatoColetadoConfig, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { todasAsExigencias } from '../../shared/exigencias-documentais';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import {
  ANCORAS_DA_IDADE,
  camposSemUsoDeclarado,
  camposSemValoresOfertados,
  comCamposQueAsExigenciasPressupoem,
  comoComandoDeFatosColetados,
  comoComandoDeReferenciaTemporal,
  ehColetavel,
  fatosCitadosPelaDerivacao,
  fatosCitadosPelasExigencias,
  problemasDoFormulario,
  regrasQueDependemDoFato,
  renderizacaoDe,
  renumerar,
} from './formulario-de-inscricao';

/**
 * Formulário de inscrição — o que o candidato lê no topo e os campos que ele preenche.
 *
 * Os campos são os fatos que o certame coleta: a renderização pública projeta exatamente esta
 * lista. O passo vem depois do Cronograma porque depende dele em duas frentes — a apuração da
 * idade pode ancorar no início ou no fim de uma fase, e os campos que as exigências
 * documentais pressupõem só são conhecidos depois que elas foram declaradas.
 */
@Component({
  selector: 'sel-step-formulario',
  standalone: true,
  imports: [ComboboxComponent],
  templateUrl: './formulario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(FormularioStepComponent)],
})
export class FormularioStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly fatosApi = inject(FatosCandidatoApi);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly catalogo = signal<readonly FatoCandidatoView[]>([]);
  readonly catalogoCarregando = signal(true);
  readonly catalogoErro = signal<string | null>(null);

  /**
   * Os campos que a reconciliação acrescentou nesta sessão, por causa de um gatilho.
   *
   * Só o que entrou sozinho sai sozinho. Sem essa memória, reabrir um processo já configurado
   * esvaziaria o formulário — nenhum gatilho tinha sido lido ainda —, e a gravação seguinte
   * apagaria no servidor uma configuração que ninguém pediu para tirar.
   */

  readonly fatoAAcrescentar = signal('');

  protected readonly ancoras = ANCORAS_DA_IDADE;

  constructor() {
    this.carregarCatalogo();

    // Reconcilia a cada mudança das exigências, e não só quando o catálogo responde. Os passos
    // do wizard ficam todos montados, então "abrir o passo" não executa nada: sem este efeito,
    // o campo que um gatilho trouxe sobrevivia à remoção desse gatilho pelo resto da sessão —
    // inclusive o que o passo do cronograma acrescenta, já que aquele caminho só acrescenta.
    // Sobra dado pessoal no formulário sem nada que o justifique.
    effect(() => {
      const exigencias = this.store.draft().documentos;
      if (exigencias !== null && this.catalogo().length > 0) {
        untracked(() => this.reconciliar());
      }
    });
  }

  /**
   * Busca o vocabulário de fatos. Exposto porque a tela oferece nova tentativa: sem ela, uma
   * falha passageira deixava o catálogo vazio pelo resto da sessão, e não havia como
   * acrescentar campo nenhum ao formulário sem recarregar a página inteira.
   */
  carregarCatalogo(): void {
    this.catalogoCarregando.set(true);
    this.catalogoErro.set(null);
    this.fatosApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.catalogoCarregando.set(false);
        if (!isApiOk(resultado)) {
          this.catalogoErro.set(this.problemI18n.resolve(resultado.problem).title);
          return;
        }
        this.catalogo.set(resultado.data);
        this.reconciliar();
      });
  }

  /**
   * Põe no formulário o que as exigências pressupõem e tira o que nenhuma cita mais.
   *
   * Roda ao carregar o catálogo e a cada abertura do passo: a exigência é declarada noutro
   * passo, e o operador não deveria precisar lembrar que mudá-la mexe aqui.
   */
  reconciliar(): void {
    const draft = this.store.draft();
    const antes = new Set(draft.formulario.fatos.map((campo) => campo.fatoCodigo));
    const reconciliado = comCamposQueAsExigenciasPressupoem(
      draft.formulario,
      draft.documentos,
      this.catalogo(),
      this.store.camposPostosPelasExigencias(),
      // As regras que derivam a modalidade também pressupõem campos — se o candidato quer
      // concorrer a cada cota, se veio de escola pública. Sem contá-los aqui, um campo que
      // entrou por um gatilho e depois passou a sustentar a matriz sairia quando o gatilho
      // fosse apagado, deixando a matriz gravada citando o que o processo não coleta mais.
      draft.formulario.derivacao.flatMap((config) => fatosCitadosPelaDerivacao(config.regras)),
    );
    if (reconciliado === draft.formulario) return;

    // Registra o que ENTROU agora: é esse conjunto que a reconciliação seguinte pode remover
    // quando a exigência que o pediu deixar de existir.
    const acrescentados = reconciliado.fatos
      .map((campo) => campo.fatoCodigo)
      .filter((codigo) => !antes.has(codigo));
    if (acrescentados.length > 0) {
      this.store.camposPostosPelasExigencias.update((atual) => new Set([...atual, ...acrescentados]));
    }

    this.store.patchSection('formulario', reconciliado);
  }

  readonly campos = computed(() => this.store.draft().formulario.fatos);

  readonly titulo = computed(() => this.store.draft().formulario.titulo);

  readonly termoAceite = computed(() => this.store.draft().formulario.termoAceiteTexto);

  readonly referencia = computed(() => this.store.draft().formulario.referenciaTemporal);

  /** Se a apuração da idade precisa de fase — só então o seletor de fase aparece. */
  readonly ancoraEmFase = computed(() => {
    const tipo = this.referencia().tipo;
    return tipo === 'INICIO_FASE' || tipo === 'FIM_FASE';
  });

  /** Se alguma exigência condiciona por idade — é o que torna a política obrigatória. */
  readonly exigeApuracaoDeIdade = computed(() =>
    fatosCitadosPelasExigencias(this.store.draft().documentos).has('FAIXA_ETARIA'),
  );

  /** As fases do cronograma, para ancorar a apuração da idade. */
  readonly fasesEscolhiveis = computed(() =>
    this.store.draft().cronograma.fases.map((fase) => fase.codigo),
  );

  /**
   * O catálogo menos o que já está no formulário. Só fato coletável entra: derivado resolve por
   * outro caminho e o servidor recusa coletá-lo.
   */
  readonly fatosDisponiveis = computed<readonly UiComboboxGroup[]>(() => {
    const declarados = new Set(this.campos().map((campo) => campo.fatoCodigo));
    const opcoes = this.catalogo()
      .filter((fato) => ehColetavel(fato) && !declarados.has(fato.codigo))
      .map((fato) => ({ value: fato.codigo, label: fato.nome }));

    return opcoes.length === 0 ? [] : [{ label: 'Dados que o candidato pode declarar', options: opcoes }];
  });

  /** Se o campo está ali porque uma exigência o cita — e por isso não pode simplesmente sair. */
  exigidoPorDocumento(codigo: string): boolean {
    return fatosCitadosPelasExigencias(this.store.draft().documentos).has(codigo);
  }

  /**
   * Os documentos cujo gatilho cita este dado.
   *
   * A recusa de remoção nomeia TODOS, não um: o operador precisa saber onde mexer, e dizer
   * apenas o primeiro o faria descobrir os outros um a um.
   */
  documentosQueCitam(codigo: string): readonly string[] {
    const nomePorId = this.catalogos.tipoDocumentoPorId();
    const nomes = todasAsExigencias(this.store.draft().documentos)
      .filter((exigencia) => exigencia.condicoes.some((condicao) => condicao.fato === codigo))
      .map(
        (exigencia) =>
          nomePorId.get(exigencia.tipoDocumentoId)?.nome ?? exigencia.tipoDocumentoId,
      );

    return [...new Set(nomes)];
  }

  escolherFato(codigo: string): void {
    this.fatoAAcrescentar.set(codigo);
  }

  /** Acrescenta ao formulário um dado que nenhuma exigência pediu — decisão própria do operador. */
  acrescentarCampo(): void {
    const codigo = this.fatoAAcrescentar();
    if (codigo === '') return;

    const fato = this.catalogo().find((item) => item.codigo === codigo);
    if (fato === undefined || !ehColetavel(fato)) return;

    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      fatos: renumerar([
        ...formulario.fatos,
        {
          fatoCodigo: fato.codigo,
          ordem: 0,
          rotulo: fato.nome,
          tipoRenderizacao: renderizacaoDe(fato),
          obrigatorio: true,
          precondicao: null,
        },
      ]),
    });
    // Declarado à mão: sai da memória do que foi posto por exigência, se lá estava — a partir
    // de agora ele permanece mesmo que nenhum gatilho o cite.
    this.store.camposPostosPelasExigencias.update((atual) => {
      const seguinte = new Set(atual);
      seguinte.delete(fato.codigo);
      return seguinte;
    });
    this.fatoAAcrescentar.set('');
  }

  /**
   * Os campos que nada no certame usa — nenhuma exigência os cita, nenhuma regra de derivação
   * depende deles, nenhum outro campo os tem como pré-condição.
   *
   * Existem porque a remoção automática só alcança o que a sessão em curso acrescentou: um
   * campo que entrou ontem por causa de um gatilho sobrevive quando o gatilho é apagado hoje.
   * Enquanto sobrevive, é dado pessoal pedido ao candidato sem finalidade declarada — e é por
   * isso que a tela o aponta em vez de deixá-lo passar calado.
   */
  readonly camposSemUso = computed(() => {
    const draft = this.store.draft();
    return camposSemUsoDeclarado(draft.formulario, draft.documentos).map(
      (campo) => campo.rotulo.trim() === '' ? campo.fatoCodigo : campo.rotulo,
    );
  });

  /**
   * As regras do próprio formulário que dependem deste dado. O gatilho de documento é a outra
   * razão para o campo não poder sair, e tem aviso próprio porque se resolve noutro passo.
   */
  regrasQueDependem(codigo: string): readonly string[] {
    return regrasQueDependemDoFato(this.store.draft().formulario, codigo);
  }

  /**
   * Tira o campo do formulário. Recusado enquanto alguma exigência o citar OU alguma regra do
   * formulário depender dele: removê-lo deixaria a regra citando um fato que ninguém coleta
   * mais, e a incoerência só apareceria lá no gate da publicação.
   */
  removerCampo(codigo: string): void {
    if (this.exigidoPorDocumento(codigo) || this.regrasQueDependem(codigo).length > 0) return;

    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      fatos: renumerar(formulario.fatos.filter((campo) => campo.fatoCodigo !== codigo)),
    });
    this.store.camposPostosPelasExigencias.update((atual) => {
      const seguinte = new Set(atual);
      seguinte.delete(codigo);
      return seguinte;
    });
  }

  escreverCampo(codigo: string, patch: Partial<FatoColetadoConfig>): void {
    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      fatos: formulario.fatos.map((campo) =>
        campo.fatoCodigo === codigo ? { ...campo, ...patch } : campo,
      ),
    });
  }

  escreverTitulo(valor: string): void {
    this.store.patchSection('formulario', { ...this.store.draft().formulario, titulo: valor });
  }

  escreverTermo(valor: string): void {
    this.store.patchSection('formulario', {
      ...this.store.draft().formulario,
      termoAceiteTexto: valor,
    });
  }

  escreverReferencia(patch: Partial<{ tipo: string; data: string; faseCodigo: string }>): void {
    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      referenciaTemporal: { ...formulario.referenciaTemporal, ...patch },
    });
  }

  /**
   * Os campos que este formulário pergunta e cujos valores escolhíveis saem da oferta de
   * atendimento especializado, declarada no passo anterior.
   *
   * O acoplamento é real e a publicação o cobra: um campo de seleção sobre um desses fatos com
   * oferta vazia é pendência estrutural. O aviso mora aqui porque é aqui que o operador cria o
   * problema — ele acabou de acrescentar o campo, e a oferta que lhe daria valores ficou para
   * trás vazia. Dizê-lo só na revisão obrigaria a refazer o caminho.
   */
  readonly camposSemValoresOfertados = computed(() => {
    const draft = this.store.draft();
    return camposSemValoresOfertados(draft.formulario, draft.atendimento);
  });

  validate(): StepValidation {
    const draft = this.store.draft();
    const mensagens = [
      ...problemasDoFormulario(
        draft.formulario,
        draft.documentos,
        new Set(draft.cronograma.fases.map((fase) => fase.codigo)),
      ),
      ...this.camposSemValoresOfertados().map(
        (campo) =>
          `O formulário pergunta ${campo} ao candidato, e a oferta de atendimento especializado não declara nenhum valor para escolher. Declare ao menos um em "Atend. especial", ou retire o campo daqui.`,
      ),
    ];

    return mensagens.length === 0 ? { valid: true } : { valid: false, messages: [...mensagens] };
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Grava o formulário: cabeçalho, campos e a política que ancora a apuração da idade.
   *
   * Os campos vão como coleção inteira, porque o comando a substitui. O cabeçalho vive numa
   * rota administrativa à parte — a leitura do formulário é pública, a escrita não.
   */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de declarar o formulário.'],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const formulario = this.store.draft().formulario;

      const campos = await this.cadastro.definirFatosColetados(
        processoId,
        comoComandoDeFatosColetados(formulario),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!campos.ok) {
        return { valid: false, messages: [this.problemI18n.resolve(campos.problem).title] };
      }

      // A fase âncora é resolvida contra uma releitura FRESCA, não contra o retrato que a
      // hidratação guardou: a fase pode ter sido acrescentada nesta sessão, e aí ela não tem
      // id no retrato antigo — a apuração viajaria sem âncora e o servidor recusaria uma
      // escolha que o operador acabou de fazer na tela.
      const detalhe = await firstValueFrom(this.api.obter(processoId));
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!isApiOk(detalhe)) {
        return {
          valid: false,
          messages: [
            'Os campos do formulário foram gravados, mas não foi possível reler as fases para ancorar a apuração da idade. Tente gravar de novo.',
          ],
        };
      }

      const faseIdPorCodigo = new Map(
        detalhe.data.cronogramaFases.map((fase) => [fase.codigo, fase.id] as const),
      );
      const temporal = await this.cadastro.definirReferenciaTemporalFatos(
        processoId,
        comoComandoDeReferenciaTemporal(formulario.referenciaTemporal, faseIdPorCodigo),
      );
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!temporal.ok) {
        return { valid: false, messages: [this.problemI18n.resolve(temporal.problem).title] };
      }

      const cabecalho = await this.cadastro.definirFormulario(processoId, {
        titulo: formulario.titulo.trim() === '' ? null : formulario.titulo.trim(),
        termoAceiteTexto:
          formulario.termoAceiteTexto.trim() === '' ? null : formulario.termoAceiteTexto.trim(),
      });
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!cabecalho.ok) {
        return { valid: false, messages: [this.problemI18n.resolve(cabecalho.problem).title] };
      }

      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }
}
