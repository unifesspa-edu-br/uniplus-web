import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';
import {
  CondicaoAtendimentoDto,
  RecursoAcessibilidadeDto,
  TipoDeficienciaDto,
} from '@uniplus/shared-data/configuracao';

import { ReferenciaDeAtendimento, StepValidation } from '../../processo-seletivo.models';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { gravarNoPasso, RESPOSTA_DESCARTADA } from '../../shared/gravacao/gravacao-no-passo';
import { camposSemValoresOfertados } from '../formulario/formulario-de-inscricao';
import { anunciarRemocao } from './anuncio-de-remocao';
import { CatalogosDeAtendimentoService } from './catalogos-de-atendimento.service';
import {
  aposMarcarCondicao,
  aposMarcarTodas,
  aposRemover,
  comoCondicaoSelecionada,
  ehPcd,
} from './oferta-de-atendimento';
import { mensagemDeInativos, referenciasInativas } from './referencias-inativas';

/**
 * A oferta de atendimento especializado do processo (UNI-REQ-0012), gravada
 * por `PUT …/oferta-atendimento`. As três listas vêm dos cadastros de
 * Configuração — condições, recursos de acessibilidade e tipos de deficiência
 * —, referenciados por id; nenhuma delas é vocabulário local.
 *
 * **A regra do PcD é bicondicional (ADR-0067):** `tipoDeficienciaIds` só é
 * aceito quando a condição de código canônico `PCD` está entre `condicaoIds`
 * (`OfertaAtendimentoEspecializado.CodigoCondicaoPcd`), e a condição `PCD`
 * exige ao menos um tipo de deficiência. A tela recusa as duas direções antes
 * de gravar — o `CondicaoAtendimentoDto` não tem campo que vincule condição a
 * tipo de deficiência, então a checagem é por código, não por relação
 * declarada no contrato.
 */
@Component({
  selector: 'sel-step-atendimento',
  standalone: true,
  imports: [ValorEmConsultaComponent],
  templateUrl: './atendimento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CatalogosDeAtendimentoService, provePassoDoWizard(AtendimentoStepComponent)],
})
export class AtendimentoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeAtendimentoService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);

  readonly erroDeGravacao = signal<string | null>(null);

  constructor() {
    this.catalogos.carregar();

    // As rotas do editor reusam a mesma instância ao trocar de processo: sem isto, a recusa de
    // gravação do processo anterior continuaria na tela de um processo que nunca tentou gravar.
    effect(() => {
      this.store.geracao();
      untracked(() => this.erroDeGravacao.set(null));
    });
  }

  readonly atendimento = computed(() => this.store.draft().atendimento);

  /*
   * Em consulta, a oferta lida é a gravada: o rascunho guarda o nome de cada referência, e o
   * catálogo vivo, que pode ter inativado alguma, não muda o que o processo publicou.
   */
  readonly nomesDasCondicoes = computed(() =>
    this.atendimento().condicoes.map((item) => item.nome),
  );

  readonly nomesDosTiposDeDeficiencia = computed(() =>
    this.atendimento().tiposDeficiencia.map((item) => item.nome),
  );

  readonly nomesDosRecursos = computed(() => this.atendimento().recursos.map((item) => item.nome));

  /**
   * A condição PcD está entre as selecionadas: é o que libera tipos de deficiência (ADR-0067).
   * Deriva do **rascunho**, não do catálogo ativo: depender de `catalogos.condicaoPcd()` faria a
   * seção de tipos sumir, e `validate()` recusar sem saída, assim que a condição fosse inativada
   * ou o carregamento falhasse, mesmo com ela marcada e visível na tela.
   */
  readonly pcdSelecionada = computed(() =>
    this.atendimento().condicoes.some((item) => ehPcd(item.codigo)),
  );

  /**
   * O catálogo confirmou sucesso: só então a tela sabe distinguir "saiu do cadastro" de "ainda não
   * sei". Enquanto carregando ou depois de uma falha, as listas de inativas capturam tudo que está
   * selecionado, e qualquer controle que as mutasse nesse estado apagaria parte de uma oferta
   * gravada sem possibilidade de desfazer.
   */
  readonly catalogoConfirmado = computed(
    () => !this.catalogos.carregando() && this.catalogos.erro() === null,
  );

  /** Referências que o rascunho guarda mas o cadastro ativo já não tem: seguem visíveis, sem opção de escolher de novo. */
  readonly condicoesInativas = computed(() =>
    referenciasInativas(this.atendimento().condicoes, this.catalogos.condicoes()),
  );

  readonly recursosInativos = computed(() =>
    referenciasInativas(this.atendimento().recursos, this.catalogos.recursos()),
  );

  readonly tiposDeficienciaInativos = computed(() =>
    referenciasInativas(this.atendimento().tiposDeficiencia, this.catalogos.tiposDeficiencia()),
  );

  /** "Marcar todas" só olha para as condições ativas: referências inativas não entram na conta. */
  readonly todasAsCondicoesSelecionadas = computed(() => {
    const ativas = this.catalogos.condicoes();
    return ativas.length > 0 && ativas.every((item) => this.condicaoMarcada(item.id));
  });

  readonly condicoesParcialmenteSelecionadas = computed(() => {
    const ativas = this.catalogos.condicoes();
    const marcadas = ativas.filter((item) => this.condicaoMarcada(item.id)).length;
    return marcadas > 0 && marcadas < ativas.length;
  });

  readonly todosOsRecursosSelecionados = computed(() => {
    const ativos = this.catalogos.recursos();
    return ativos.length > 0 && ativos.every((item) => this.recursoMarcado(item.id));
  });

  readonly recursosParcialmenteSelecionados = computed(() => {
    const ativos = this.catalogos.recursos();
    const marcados = ativos.filter((item) => this.recursoMarcado(item.id)).length;
    return marcados > 0 && marcados < ativos.length;
  });

  condicaoMarcada(id: string): boolean {
    return this.atendimento().condicoes.some((item) => item.id === id);
  }

  recursoMarcado(id: string): boolean {
    return this.atendimento().recursos.some((item) => item.id === id);
  }

  tipoDeficienciaMarcado(id: string): boolean {
    return this.atendimento().tiposDeficiencia.some((item) => item.id === id);
  }

  toggleCondicao(condicao: CondicaoAtendimentoDto, marcada: boolean): void {
    this.store.patchObjectSection(
      'atendimento',
      aposMarcarCondicao(this.atendimento().condicoes, comoCondicaoSelecionada(condicao), marcada),
    );
  }

  toggleRecurso(recurso: RecursoAcessibilidadeDto, marcado: boolean): void {
    const atual = this.atendimento().recursos;
    const proximo = marcado
      ? [...atual, { id: recurso.id, nome: recurso.nome }]
      : atual.filter((item) => item.id !== recurso.id);
    this.store.patchObjectSection('atendimento', { recursos: proximo });
  }

  /**
   * Marca ou desmarca de uma vez só as condições ativas do catálogo. Referências inativas
   * preservadas no rascunho não são tocadas: seguem removíveis apenas individualmente.
   */
  marcarTodasAsCondicoes(marcar: boolean): void {
    this.store.patchObjectSection(
      'atendimento',
      aposMarcarTodas(
        this.condicoesInativas(),
        this.catalogos.condicoes().map(comoCondicaoSelecionada),
        marcar,
      ),
    );
  }

  /**
   * Marca ou desmarca de uma vez só os recursos ativos do catálogo. Referências inativas
   * preservadas no rascunho não são tocadas.
   */
  marcarTodosOsRecursos(marcar: boolean): void {
    const inativos = this.recursosInativos();
    const proximo = marcar
      ? [
          ...inativos,
          ...this.catalogos.recursos().map((item) => ({ id: item.id, nome: item.nome })),
        ]
      : [...inativos];
    this.store.patchObjectSection('atendimento', { recursos: proximo });
  }

  toggleTipoDeficiencia(tipo: TipoDeficienciaDto, marcado: boolean): void {
    const atual = this.atendimento().tiposDeficiencia;
    const proximo = marcado
      ? [...atual, { id: tipo.id, nome: tipo.nome }]
      : atual.filter((item) => item.id !== tipo.id);
    this.store.patchObjectSection('atendimento', { tiposDeficiencia: proximo });
  }

  /** O que mudou, para quem não vê a tela: a remoção de uma referência inativa tirava a linha do DOM em silêncio. */
  readonly anuncio = signal('');

  private readonly injector = inject(Injector);

  private anunciar(
    inativas: readonly ReferenciaDeAtendimento[],
    remocao: {
      readonly id: string;
      readonly nome: string | undefined;
      readonly prefixoDoId: string;
      readonly tituloDaSecao: string;
    },
  ): void {
    anunciarRemocao(this.anuncio, this.injector, {
      nome: remocao.nome,
      prefixoDoId: remocao.prefixoDoId,
      indice: inativas.findIndex((item) => item.id === remocao.id),
      tituloDaSecao: remocao.tituloDaSecao,
    });
  }

  removerCondicaoInativa(id: string): void {
    const atual = this.atendimento().condicoes;
    this.anunciar(this.condicoesInativas(), {
      id,
      nome: atual.find((item) => item.id === id)?.nome,
      prefixoDoId: 'atend-cond-inativa',
      tituloDaSecao: 'atend-secao-condicoes',
    });
    this.store.patchObjectSection('atendimento', aposRemover(atual, id));
  }

  removerRecursoInativo(id: string): void {
    const atual = this.atendimento().recursos;
    this.anunciar(this.recursosInativos(), {
      id,
      nome: atual.find((item) => item.id === id)?.nome,
      prefixoDoId: 'atend-rec-inativo',
      tituloDaSecao: 'atend-secao-recursos',
    });
    this.store.patchObjectSection('atendimento', {
      recursos: atual.filter((item) => item.id !== id),
    });
  }

  removerTipoDeficienciaInativo(id: string): void {
    const atual = this.atendimento().tiposDeficiencia;
    this.anunciar(this.tiposDeficienciaInativos(), {
      id,
      nome: atual.find((item) => item.id === id)?.nome,
      prefixoDoId: 'atend-tipo-inativo',
      tituloDaSecao: 'atend-secao-tipos',
    });
    this.store.patchObjectSection('atendimento', {
      tiposDeficiencia: atual.filter((item) => item.id !== id),
    });
  }

  /**
   * "Inativo no cadastro" só se sustenta quando o catálogo carregou com sucesso: carregando ou em
   * falha, o catálogo comparado está vazio, e não é porque os itens saíram dele. "Ainda não sei"
   * não é "não existe mais", nem no rótulo.
   */
  rotuloDeSituacaoInativa(): string {
    if (this.catalogos.carregando()) return 'Carregando catálogo…';
    return this.catalogos.erro() !== null ? 'Catálogo indisponível' : 'Inativo no cadastro';
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Os fatos que o formulário de inscrição pergunta ao candidato e cujo domínio sai DESTA
   * tela — a condição de atendimento e o recurso de acessibilidade. O tipo de deficiência perguntado no formulário oferece os
   * tipos do cadastro, com ou sem oferta (UNI-REQ-0012).
   *
   * O acoplamento é real e a publicação o cobra: um campo de seleção sobre um desses fatos com a
   * lista correspondente da oferta vazia é pendência estrutural. Sem dizê-lo aqui, o operador grava a oferta vazia
   * sem nada indicando o problema, descobre na revisão, e o botão "Ir para Atend. especial" o
   * traz de volta a uma tela que não menciona por que ele veio.
   */
  readonly fatosQueDependemDaOferta = computed<readonly string[]>(() =>
    camposSemValoresOfertados(this.store.draft().formulario, this.atendimento()),
  );

  /**
   * O cadastro de condições, já confirmado, não tem a condição PCD e o rascunho também não a
   * guarda — sem ela não há como declarar tipos de deficiência por esta tela.
   */
  readonly pcdAusenteDoCadastro = computed(
    () => this.catalogoConfirmado() && !this.catalogos.condicaoPcd() && !this.pcdSelecionada(),
  );

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const mensagens: string[] = [];

    // Espelha o gate de publicação: o formulário pergunta ao candidato algo cujo domínio sai
    // desta oferta, e a oferta não declara valor nenhum. Descobrir isso na revisão obriga a
    // refazer o caminho, e a mensagem de lá fala de "fato coletável", não do que preencher.
    for (const pendente of this.fatosQueDependemDaOferta()) {
      mensagens.push(
        `O formulário de inscrição pergunta ${pendente} ao candidato, e esta oferta não declara nenhum valor para escolher. Declare ao menos um, ou retire o campo do formulário.`,
      );
    }

    if (this.atendimento().tiposDeficiencia.length > 0 && !this.pcdSelecionada()) {
      mensagens.push(
        'Tipos de deficiência exigem a condição "Pessoa com deficiência" marcada entre as condições aceitas.',
      );
    }

    if (this.atendimento().tiposDeficiencia.length === 0 && this.pcdSelecionada()) {
      mensagens.push(
        'A condição "Pessoa com deficiência" exige ao menos um tipo de deficiência marcado. Marque um tipo ou desmarque a condição.',
      );
    }

    // A checagem de referência inativa só é confiável depois que os três catálogos carregaram:
    // antes disso eles estão vazios, e "não sei ainda" seria confundido com "não existe mais",
    // mandando o operador apagar uma oferta válida por causa de uma indisponibilidade temporária.
    // O erro de carga já está no banner do template.
    if (this.catalogoConfirmado()) mensagens.push(...this.mensagensDeInativos());

    return mensagens.length > 0 ? { valid: false, messages: mensagens } : { valid: true };
  }

  private mensagensDeInativos(): string[] {
    return [
      mensagemDeInativos('a condição', 'as condições', this.condicoesInativas()),
      mensagemDeInativos('o recurso', 'os recursos', this.recursosInativos()),
      mensagemDeInativos(
        'o tipo de deficiência',
        'os tipos de deficiência',
        this.tiposDeficienciaInativos(),
      ),
    ].filter((mensagem): mensagem is string => mensagem !== undefined);
  }

  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          'O cadastro do processo precisa estar concluído antes de configurar o atendimento.',
        ],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const atendimento = this.atendimento();
    this.erroDeGravacao.set(null);
    return gravarNoPasso(this.store, async () => {
      const geracao = this.store.geracao();
      const resultado = await this.cadastro.definirOfertaAtendimento(processoId, {
        condicaoIds: atendimento.condicoes.map((item) => item.id),
        recursoIds: atendimento.recursos.map((item) => item.id),
        tipoDeficienciaIds: atendimento.tiposDeficiencia.map((item) => item.id),
      });

      // O editor pode ter passado a outro processo enquanto o comando corria.
      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      if (resultado.ok) return { valid: true };

      const mensagem = this.problemI18n.resolve(resultado.problem).title;
      this.erroDeGravacao.set(mensagem);
      return { valid: false, messages: [mensagem] };
    });
  }
}
