import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProblemI18nService, extractNextCursor, isApiOk } from '@uniplus/shared-core/http';
import { UnidadeDto, UnidadesApi } from '@uniplus/shared-data/organizacao';
import { type CidadeResumoDto, GeoApi } from '@uniplus/shared-data/geo';
import { OrigemCandidatos } from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { LocalidadeSelecionada } from '../../processo-seletivo.models';
import { OrigemCandidatosSelecionada, StepValidation } from '../../processo-seletivo.models';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { provePassoDoWizard } from '../../passo-do-wizard';

interface UnidadeOption {
  readonly id: string;
  readonly rotulo: string;
}

/** Janela do seletor de municípios, igual à do calendário de dias úteis. */
const MUNICIPIOS_LIMIT = 20;

/**
 * Rótulos curtos de propósito: em 320 px, a largura intrínseca da opção mais
 * longa é o que decide o piso do campo. O sentido completo fica no texto de
 * apoio do campo, que quebra em várias linhas sem esticar nada.
 */
export const ORIGENS_CANDIDATOS: readonly {
  readonly value: OrigemCandidatosSelecionada;
  readonly label: string;
}[] = [
  { value: OrigemCandidatos.inscricaoPropria, label: 'Inscrição neste sistema' },
  { value: OrigemCandidatos.importacaoExterna, label: 'Importação externa' },
];

@Component({
  selector: 'sel-step-identificacao',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './identificacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(IdentificacaoStepComponent)],
})
export class IdentificacaoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly unidadesApi = inject(UnidadesApi);

  private readonly geo = inject(GeoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Campos inválidos detectados na última validação (chave → `.is-invalid`). */
  readonly invalidFields = signal<ReadonlySet<string>>(new Set());
  readonly origens = ORIGENS_CANDIDATOS;
  /** Resultado corrente da busca de município na Geo. */
  readonly municipios = signal<readonly CidadeResumoDto[]>([]);
  readonly municipiosCarregando = signal(false);
  readonly municipiosErro = signal<string | null>(null);
  /** Termo digitado no seletor; não é persistido no rascunho. */
  readonly buscaMunicipio = signal('');

  private readonly catalogoUnidades = signal<readonly UnidadeOption[]>([]);

  /**
   * Catálogo vivo mais, quando faltar, a unidade que o processo retomado
   * declara.
   *
   * A unidade referenciada pode ter saído do catálogo, e a própria leitura do
   * catálogo pode falhar. Em ambos os casos o campo — congelado depois da
   * criação — abriria sem valor, e o operador não teria como identificar quem
   * administra o certame. O snapshot devolvido por Seleção traz sigla e nome,
   * e é a única fonte desse rótulo nessa situação.
   */
  readonly unidades = computed<readonly UnidadeOption[]>(() => {
    const catalogo = this.catalogoUnidades();
    const snapshot = this.store.remoteSnapshot()?.unidadeAdministradora;

    if (snapshot === undefined) return catalogo;
    if (catalogo.some((opcao) => opcao.id === snapshot.origemId)) return catalogo;

    return [{ id: snapshot.origemId, rotulo: `${snapshot.sigla} — ${snapshot.nome}` }, ...catalogo];
  });
  readonly unidadesCarregando = signal(true);
  readonly unidadesErro = signal<string | null>(null);

  /**
   * Enquanto o cadastro inicial não existe, o operador pode corrigir tudo;
   * depois de criado, o contrato não expõe atualização de identificação, então
   * os campos que compuseram o comando ficam somente-leitura.
   */
  readonly camposDoComandoBloqueados = computed(() => this.store.cadastroInicialCongelado());
  /**
   * Uma criação sem resposta definitiva precisa ser repetida com o mesmo corpo,
   * senão a mesma chave devolve `body_mismatch` e a correção seguinte cria um
   * segundo processo. Editar não adiantaria — daí manter os campos travados,
   * aqui e no passo 1.
   */
  readonly criacaoIndefinida = this.store.criacaoIndefinida;

  /**
   * Formulário tipado dos campos que compõem o comando de criação. A
   * localidade fica fora: é um trio escolhido inteiro numa busca, não um
   * controle de texto.
   *
   * O store continua sendo a fonte — o formulário é a superfície de edição, e
   * `valueChanges` alimenta o rascunho.
   */
  readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    unidadeAdministradoraId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    origemCandidatos: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor() {
    this.carregarUnidades();

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
      this.store.patchObjectSection('identificacao', {
        nome: valor.nome ?? '',
        unidadeAdministradoraId: valor.unidadeAdministradoraId ?? '',
        origemCandidatos: (valor.origemCandidatos ?? '') as OrigemCandidatosSelecionada,
      });
    });

    // A hidratação escreve no store; o formulário reflete sem devolver o eco,
    // que reabriria o ciclo e marcaria o campo como sujo sem o operador tocar.
    effect(() => {
      const identificacao = this.store.draft().identificacao;
      const congelado = this.store.cadastroInicialCongelado();

      this.form.setValue(
        {
          nome: identificacao.nome,
          unidadeAdministradoraId: identificacao.unidadeAdministradoraId,
          origemCandidatos: identificacao.origemCandidatos,
        },
        { emitEvent: false },
      );

      if (congelado && this.form.enabled) this.form.disable({ emitEvent: false });
      if (!congelado && this.form.disabled) this.form.enable({ emitEvent: false });
    });
  }

  /** Grava o trio inteiro vindo da opção escolhida — nunca campo a campo. */
  selecionarLocalidade(localidade: LocalidadeSelecionada): void {
    this.store.patchObjectSection('identificacao', { localidade });
    this.buscaMunicipio.set('');
    this.municipios.set([]);
  }

  limparLocalidade(): void {
    this.store.patchObjectSection('identificacao', { localidade: null });
  }

  buscarMunicipios(termo: string): void {
    this.buscaMunicipio.set(termo);
    const busca = termo.trim();
    if (busca.length < 3) {
      this.municipios.set([]);
      this.municipiosErro.set(null);
      // Uma busca em voo pode ter começado com termo mais longo: a resposta dela
      // será descartada pela guarda de termo obsoleto, então é aqui que o estado
      // de carregamento precisa voltar — senão o campo fica anunciando consulta
      // que ninguém mais vai concluir.
      this.municipiosCarregando.set(false);
      return;
    }

    this.municipiosCarregando.set(true);
    this.municipiosErro.set(null);
    // Resultado da busca anterior sai de cena ao começar a nova: enquanto a
    // requisição corre, uma opção do termo antigo continuaria clicável, e numa
    // conexão lenta o operador gravaria o município que já não procurava.
    this.municipios.set([]);
    this.geo
      .listarCidades({ q: busca, limit: MUNICIPIOS_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        // Resposta de busca anterior chegando depois da atual: descartar, senão a
        // lista exibiria resultado de um termo que o operador já trocou.
        if (this.buscaMunicipio().trim() !== busca) {
          return;
        }
        this.municipiosCarregando.set(false);
        if (!isApiOk(result)) {
          this.municipios.set([]);
          this.municipiosErro.set(this.problemI18n.resolve(result.problem).title);
          return;
        }
        this.municipios.set(result.data);
      });
  }

  carregarUnidades(): void {
    this.unidadesCarregando.set(true);
    this.unidadesErro.set(null);
    this.carregarPaginaDeUnidades();
  }

  private carregarPaginaDeUnidades(
    cursor?: string,
    acumuladas: readonly UnidadeOption[] = [],
  ): void {
    const consulta =
      cursor === undefined
        ? this.unidadesApi.listar()
        : this.unidadesApi.listar({ cursor, direction: 'next' });

    consulta.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        if (!isApiOk(result)) {
          this.exibirErroDeUnidades();
          return;
        }

        const unidades = [...acumuladas, ...result.data.map((item) => toOption(item))];
        const proximoCursor = extractNextCursor(result.headers.get('Link'));
        if (proximoCursor !== null) {
          this.carregarPaginaDeUnidades(proximoCursor, unidades);
          return;
        }

        this.catalogoUnidades.set(unidades);
        this.unidadesCarregando.set(false);
      },
      error: () => this.exibirErroDeUnidades(),
    });
  }

  private exibirErroDeUnidades(): void {
    this.unidadesCarregando.set(false);
    this.unidadesErro.set(
      'Não foi possível carregar as unidades administradoras. Tente novamente.',
    );
  }

  /** Recusa da criação, exibida no passo — o anexo tem o erro dele próprio. */
  readonly erroDeCriacao = signal<string | null>(null);

  /** Campos que compõem o comando de criação e ainda estão vazios. */
  private camposFaltantesDoComando(): string[] {
    const identificacao = this.store.draft().identificacao;
    const faltando: string[] = [];
    if (!this.store.draft().tipoProcesso.selected) faltando.push('tipo do processo (passo 1)');
    if (!identificacao.nome.trim()) faltando.push('nome do processo seletivo');
    if (!identificacao.unidadeAdministradoraId) faltando.push('unidade administradora');
    if (!identificacao.origemCandidatos) faltando.push('origem dos candidatos');
    if (identificacao.localidade === null) faltando.push('município que rege os prazos');
    return faltando;
  }

  /**
   * Cria o processo se ainda não existe, a partir de um instantâneo do rascunho
   * — os campos ficam bloqueados durante a requisição, para que a resposta
   * nunca descreva um estado diferente do enviado.
   */
  private async garantirProcessoCriado(): Promise<string | null> {
    const existente = this.store.processoSeletivoId();
    if (existente !== null) return existente;
    if (this.store.salvando()) return null;

    const identificacao = this.store.draft().identificacao;
    const tipoProcessoOrigemId = this.store.draft().tipoProcesso.selected;
    const faltando = this.camposFaltantesDoComando();
    if (faltando.length > 0) {
      this.erroDeCriacao.set(`Para avançar, preencha: ${faltando.join(', ')}.`);
      return null;
    }

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const resultado = await this.cadastro.criar({
        nome: identificacao.nome.trim(),
        tipoProcessoOrigemId,
        origemCandidatos: identificacao.origemCandidatos as OrigemCandidatos,
        unidadeAdministradoraOrigemId: identificacao.unidadeAdministradoraId,
        localidadeCodigoIbge: identificacao.localidade?.codigoIbge ?? null,
        localidadeNome: identificacao.localidade?.nome ?? null,
        localidadeUf: identificacao.localidade?.uf ?? null,
      });

      // O editor pode ter passado a outro processo enquanto a criação corria:
      // registrar o id agora o atribuiria ao processo que está em tela.
      if (geracao !== this.store.geracao()) return null;

      if (!resultado.ok) {
        this.store.criacaoIndefinida.set(this.cadastro.temCriacaoPendente());
        this.erroDeCriacao.set(
          this.store.criacaoIndefinida()
            ? `${this.problemI18n.resolve(resultado.problem).title} Não é possível saber se o cadastro chegou a ser criado; use "Tentar novamente" para repetir o mesmo envio.`
            : this.problemI18n.resolve(resultado.problem).title,
        );
        return null;
      }

      this.store.criacaoIndefinida.set(false);
      this.store.processoSeletivoId.set(resultado.processoSeletivoId);
      return resultado.processoSeletivoId;
    } finally {
      // Quem destrava é a geração que travou: um editor novo pode ter comando
      // próprio em curso.
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * O botão diz o que faz. Concluir este passo cria o Processo Seletivo no
   * servidor, ao contrário dos demais, onde avançar só muda de tela.
   *
   * São três estados, e não dois. Com o processo criado, avançar é só navegar.
   * Com a criação em estado indefinido — sem resposta, 5xx, conflito de
   * processamento — não há id conhecido, mas acionar o botão reenvia o mesmo
   * comando retido: chamar isso de "Próximo" descreveria navegação onde há
   * reenvio, e contradiria o aviso na tela, que pede para tentar de novo.
   */
  rotuloDeAvanco(): string {
    if (this.store.processoSeletivoId() !== null) return 'Próximo';
    if (this.store.criacaoIndefinida()) return 'Repetir a gravação';
    return 'Gravar e avançar';
  }

  /**
   * Resumo do que a criação vai gravar, para conferência antes de qualquer
   * requisição. Nenhum destes campos é alterável depois — o contrato não expõe
   * atualização deles — e o aviso que hoje só aparece com o cadastro já criado
   * chega aqui a tempo de o operador desistir.
   *
   * Devolve `null` com o processo já criado: não há o que gravar, e o passo
   * volta a ser navegação como os outros.
   */
  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (this.store.cadastroInicialCongelado()) return null;

    // A navegação pelo stepper é livre, então dá para chegar aqui com o tipo
    // do processo — que é do passo 1 — ainda por escolher. O resumo listaria
    // "Tipo do processo" em branco e prometeria um comando pronto que a
    // criação recusaria logo depois. Sem confirmação, a recusa de
    // `persistir()` aparece direto e nomeia o que falta.
    if (this.camposFaltantesDoComando().length > 0) return null;

    const draft = this.store.draft();
    const identificacao = draft.identificacao;
    const unidade = this.unidades().find(
      (item) => item.id === identificacao.unidadeAdministradoraId,
    );
    const origem = this.origens.find((item) => item.value === identificacao.origemCandidatos);
    const localidade = identificacao.localidade;

    return {
      titulo: 'Confirmar o cadastro do processo seletivo',
      aviso:
        'Estes dados não poderão ser alterados depois de gravados. Confira antes de continuar.',
      rotuloDeConfirmar: 'Gravar processo',
      itens: [
        { rotulo: 'Nome do processo seletivo', valor: identificacao.nome },
        { rotulo: 'Tipo do processo', valor: draft.tipoProcesso.rotulo },
        { rotulo: 'Unidade administradora', valor: unidade?.rotulo ?? '' },
        {
          rotulo: 'Município que rege os prazos',
          valor: localidade === null ? '' : `${localidade.nome} — ${localidade.uf}`,
        },
        { rotulo: 'Origem dos candidatos', valor: origem?.label ?? '' },
      ],
    };
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const id = this.store.draft().identificacao;
    const messages: string[] = [];
    const invalid = new Set<string>();

    if (!id.nome.trim()) {
      messages.push('Informe o nome do processo seletivo.');
      invalid.add('nome');
    }
    if (!id.unidadeAdministradoraId) {
      messages.push('Selecione a unidade administradora.');
      invalid.add('unidadeAdministradoraId');
    }
    if (!id.origemCandidatos) {
      messages.push('Informe a origem dos candidatos.');
      invalid.add('origemCandidatos');
    }
    if (id.localidade === null) {
      messages.push('Informe o município cujo calendário rege os prazos do processo.');
      invalid.add('localidade');
    }
    this.invalidFields.set(invalid);
    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /**
   * Commit assíncrono do passo: cria o cadastro inicial ao concluir a
   * identificação. É aqui que o processo nasce — antes o gatilho era o anexo do
   * edital, o que fazia um requisito de publicação decidir o momento de criação
   * do rascunho. Idempotente: repetir o passo não cria um segundo. O caso
   * de a criação ter falhado e o operador reagir pelo rodapé.
   */
  async persistir(): Promise<StepValidation> {
    if (this.store.processoSeletivoId() !== null) return { valid: true };

    const processoId = await this.garantirProcessoCriado();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          this.erroDeCriacao() ?? 'Não foi possível criar o cadastro inicial. Tente novamente.',
        ],
      };
    }
    return { valid: true };
  }

  /**
   * Decisão explícita entre documentos confirmados (CA-06). O wizard nunca
   * elege sozinho: adotar o mais recente trocaria o edital do certame sem o
   * operador perceber.
   */
}

function toOption(unidade: UnidadeDto): UnidadeOption {
  return { id: unidade.id, rotulo: `${unidade.sigla} — ${unidade.nome}` };
}
