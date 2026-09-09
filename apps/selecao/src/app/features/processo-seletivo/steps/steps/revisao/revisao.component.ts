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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { SnapshotVigenteDto, StatusProcesso } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';
import { AnexoEditalComponent } from '../../shared/anexo-edital/anexo-edital.component';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { instanteDoCampo } from '../../shared/fuso-institucional';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { PreflightDaPublicacaoService } from './preflight-da-publicacao.service';
import {
  ObrigatoriedadeReprovadaProblem,
  PendenciaEstruturalProblem,
  agruparPorDimensao,
  comExtensoesDePublicacao,
  comoComandoDePublicacao,
  dataReferenciaLegalDe,
  eErroDeDocumentoOuAto,
  faseQueAncoraOPeriodoDeInscricao,
  mensagensDePublicacao,
  passoDaDimensao,
  rotuloDaDimensao as rotularDimensao,
  temFaseDeColetaInscricao,
} from './publicacao-para-comando';

/**
 * O que a última tentativa de publicar devolveu — CA-06: a corrida entre
 * preview e comando mostra o estado atual, não o congelado no `GET` anterior.
 *
 * `obrigatoriedadesReprovadas` é `null` quando esta tentativa **não chegou**
 * a avaliar a conformidade legal — o handler roda os gates estruturais
 * primeiro (`PublicarProcessoSeletivoCommandHandler.cs`) e só passa à
 * conferência legal se todos passarem; a extensão só vem preenchida quando o
 * erro É `ConformidadeLegalInsuficiente`
 * (`ProcessoSeletivoController.cs:810`). Tratar `null` como "sem reprovação"
 * anunciaria "legal ok" sobre um estado que a tentativa nem chegou a checar.
 */
interface RecusaDePublicacao {
  readonly pendencias: readonly PendenciaEstruturalProblem[];
  readonly obrigatoriedadesReprovadas: readonly ObrigatoriedadeReprovadaProblem[] | null;
  /** Preenchido só para os erros nomeados que nenhum dos dois checklists cobre (documento, tipo de ato). */
  readonly documentoOuAto: string | null;
}

/**
 * O código do WIRE, não o de domínio: `problem.code` carrega a taxonomia
 * `uniplus.<modulo>.<razao>` (`#743`). Comparado com `ProcessoSeletivo.*`, isto
 * nunca casava, e `obrigatoriedadesReprovadas` do 422 era descartado sempre.
 */
const CODIGO_CONFORMIDADE_LEGAL_INSUFICIENTE =
  'uniplus.selecao.processo_seletivo.conformidade_legal_insuficiente';

/**
 * Passo Revisão e Publicação (`#486`). Substitui a contagem de passos
 * concluídos — que anunciava "tudo pronto" e a publicação recusava no clique
 * seguinte — pelo preflight que o servidor realmente aplica: checklist
 * estrutural, conformidade legal e o par documento confirmado/tipo de ato,
 * nenhum dos três redundante com os outros dois
 * (`ProcessoSeletivo.cs:1690-1697`).
 *
 * `validate()` daqui é complemento de `validarRascunho()` da página (CA-01):
 * o que falta preencher NESTA tela, não o que os passos anteriores não
 * gravaram — esse continua sendo o trabalho da página, que já roda `validate()`
 * de todos os passos antes de deixar publicar.
 */
@Component({
  selector: 'sel-step-revisao',
  standalone: true,
  imports: [AnexoEditalComponent, ReactiveFormsModule],
  templateUrl: './revisao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(RevisaoStepComponent), PreflightDaPublicacaoService],
})
export class RevisaoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly preflight = inject(PreflightDaPublicacaoService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);
  /**
   * Provido na página, mesma instância que `CronogramaStepComponent` já usa.
   * Necessário para resolver `coletaInscricao` de uma fase acrescentada nesta
   * sessão — ver `coletaInscricao()` em `publicacao-para-comando.ts`.
   */
  private readonly catalogosDoCronograma = inject(CatalogosDoCronogramaService);

  /** O que a última tentativa de `POST …/publicacao` devolveu, ou `null` enquanto não houve tentativa (ou ela publicou). */
  readonly ultimaRecusa = signal<RecusaDePublicacao | null>(null);

  /** O snapshot lido depois do `204` (CA-08) — só existe quando esta sessão acabou de publicar. */
  readonly snapshotConfirmado = signal<SnapshotVigenteDto | null>(null);

  /**
   * Formulário reativo tipado do ato de publicação (AGENTS.md: "formulários
   * reativos tipados"), mesmo padrão de `cascata-remanejamento.component.ts`
   * (`#726`/`f91c71b`): o rascunho continua sendo a fonte de verdade — um
   * `effect` empurra `valoresDoRascunho()` para o formulário sem realimentar
   * o próprio evento (`emitEvent: false`) —, e o único caminho de volta é
   * `form.valueChanges`. Habilitar/desabilitar é feito pelo próprio
   * formulário (`enable()`/`disable()`), nunca por `[disabled]` no
   * template: os dois juntos disparam aviso do Angular e o binding de
   * atributo perde a corrida contra o `FormGroup`.
   */
  readonly form = new FormGroup({
    numero: new FormControl<string>('', { nonNullable: true }),
    tipoAtoCodigo: new FormControl<string>('', { nonNullable: true }),
    orgao: new FormControl<string>('', { nonNullable: true }),
    serie: new FormControl<string>('', { nonNullable: true }),
    ano: new FormControl<string>('', { nonNullable: true }),
    dataPublicacao: new FormControl<string>('', { nonNullable: true }),
    assinante: new FormControl<string>('', { nonNullable: true }),
    periodoInscricaoInicio: new FormControl<string>('', { nonNullable: true }),
    periodoInscricaoFim: new FormControl<string>('', { nonNullable: true }),
  });

  private readonly valoresDoRascunho = computed(() => {
    const draft = this.store.draft().publicacao;
    return {
      numero: draft.numero,
      tipoAtoCodigo: draft.ato.tipoAtoCodigo,
      orgao: draft.ato.orgao,
      serie: draft.ato.serie,
      ano: draft.ato.ano,
      dataPublicacao: draft.ato.dataPublicacao,
      assinante: draft.ato.assinante,
      periodoInscricaoInicio: draft.periodoInscricaoInicio,
      periodoInscricaoFim: draft.periodoInscricaoFim,
    };
  });

  constructor() {
    // Todos os passos ficam montados (`[hidden]`) desde a entrada na
    // página — não há criação/destruição deste componente ao navegar pelo
    // stepper, então "entrar no passo" só existe como transição de sinal,
    // nunca como ciclo de vida. `store.isLast()` é como o passo se
    // identifica sem saber a própria posição (o mesmo princípio de
    // `passo-do-wizard.ts`: "o passo não sabe se é o segundo ou o quinto"),
    // e a Revisão é sempre o último (`PASSOS.slice(0, -1)` em
    // `processo-seletivo.data.ts`).
    //
    // Recarrega — força, não só popula o cache — a cada entrada, porque
    // qualquer dimensão gravada num passo anterior (Vagas, Cronograma,
    // Taxa…) muda o que o servidor considera conforme, e nenhuma delas sabe
    // invalidar o cache deste serviço. Sem isto, o fluxo normal de criação
    // chegava aqui com o checklist de quando o processo foi criado — todo
    // vermelho, porque nenhuma dimensão existia ainda —, e `validate()`
    // bloqueava a publicação até o operador descobrir sozinho o botão
    // "Atualizar checklist" (achado do Codex na #486: o caminho feliz da
    // Story falhando).
    effect(() => {
      const id = this.store.processoSeletivoId();
      const entrouNoPasso = this.store.isLast();
      if (id === null || !entrouNoPasso) return;
      untracked(() => {
        void this.preflight.recarregar(id, this.dataReferenciaLegal());
      });
    });

    // O reuseKey da rota mantém esta instância viva ao trocar de processo por
    // endereço — só o `id` muda, o componente não é recriado. `ultimaRecusa`
    // e `snapshotConfirmado` são estado LOCAL desta sessão de revisão, e sem
    // este reset a recusa (ou o snapshot) do processo A continuaria valendo
    // para o processo B assim que ele carregasse (achado do Codex na #486).
    // `store.geracao()` já é o sinal que o resto do wizard usa para "o
    // processo em tela mudou" — `cronograma.component.ts` reseta seu próprio
    // estado local do mesmo jeito.
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.ultimaRecusa.set(null);
        this.snapshotConfirmado.set(null);
      });
    });

    // Empurra o rascunho para o formulário sem disparar `valueChanges` — quem
    // decide o valor exibido é o rascunho (hidratação, troca de processo por
    // endereço), nunca o formulário por si.
    effect(() => {
      const valores = this.valoresDoRascunho();
      untracked(() => {
        for (const chave of Object.keys(valores) as (keyof typeof valores)[]) {
          const controle = this.form.controls[chave];
          if (controle.value !== valores[chave]) controle.setValue(valores[chave], { emitEvent: false });
        }
      });
    });

    effect(() => {
      const habilitado = this.store.aceitaEdicao();
      untracked(() => {
        if (habilitado && this.form.disabled) this.form.enable({ emitEvent: false });
        if (!habilitado && this.form.enabled) this.form.disable({ emitEvent: false });
      });
    });

    // Um "Atualizar checklist" pode trazer um catálogo de tipos de ato sem o
    // código escolhido antes (ele deixou de ser vigente entre as duas
    // leituras). O `<select>` recua para o placeholder na tela, mas sem esta
    // limpeza o rascunho continuava com o código velho — `mensagensDePubli-
    // cacao` só checa "não vazio", então `validate()` aprovava e o operador
    // só descobria com o 422, depois de confirmar o diálogo de publicação
    // (achado do Codex na #486). Só limpa com o catálogo definitivamente
    // carregado (fora de `carregando`/`erro`) — nunca durante a primeira
    // carga, quando `tiposAto()` ainda está no valor inicial vazio.
    effect(() => {
      const carregando = this.preflight.carregando();
      const erro = this.preflight.erro();
      const tipos = this.preflight.tiposAto();
      if (carregando || erro !== null) return;
      untracked(() => {
        const codigoAtual = this.store.draft().publicacao.ato.tipoAtoCodigo;
        if (codigoAtual !== '' && !tipos.some((tipo) => tipo.codigo === codigoAtual)) {
          this.store.patchObjectSection('publicacao', {
            ato: { ...this.store.draft().publicacao.ato, tipoAtoCodigo: '' },
          });
        }
      });
    });

    // O único caminho de volta: interação do operador com o formulário.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe((valores) => {
      this.store.patchObjectSection('publicacao', {
        numero: valores.numero ?? '',
        periodoInscricaoInicio: valores.periodoInscricaoInicio ?? '',
        periodoInscricaoFim: valores.periodoInscricaoFim ?? '',
        ato: {
          orgao: valores.orgao ?? '',
          serie: valores.serie ?? '',
          ano: valores.ano ?? '',
          dataPublicacao: valores.dataPublicacao ?? '',
          assinante: valores.assinante ?? '',
          tipoAtoCodigo: valores.tipoAtoCodigo ?? '',
        },
      });
    });
  }

  recarregarPreflight(): void {
    void this.recarregarChecklist();
  }

  /**
   * `PassoDoWizard.recarregarChecklist()` — o mesmo recarregar do botão
   * "Atualizar checklist", mas aguardável: `ProcessoSeletivoPage.publicar()`
   * chama isto depois de `gravarPassosAnteriores()` gravar de novo um passo
   * anterior corrigido, para o checklist em tela refletir a correção antes
   * de `validarRascunho()` julgar de novo — sem isto, a correção fica
   * gravada no servidor, mas `validate()` desta tela ainda recusa com o
   * checklist de antes dela (achado do Codex na #486, P1).
   */
  async recarregarChecklist(): Promise<void> {
    const id = this.store.processoSeletivoId();
    if (id === null) return;
    this.ultimaRecusa.set(null);
    await this.preflight.recarregar(id, this.dataReferenciaLegal());
  }

  private dataReferenciaLegal(): string | null {
    return dataReferenciaLegalDe(this.store.draft(), this.catalogosDoCronograma.fasePorId());
  }

  /**
   * O edital confirmado escolhido para a publicação — o vínculo que
   * `sel-anexo-edital`, hospedado nesta mesma tela, restaura ou grava
   * (Story #478). `null` enquanto não há um só documento confirmado
   * vinculado: sem escolha explícita (CA-02) ou sem upload nenhum ainda.
   */
  readonly documentoEditalId = computed(() => {
    const upload = this.store.draft().identificacao.uploads[0];
    return upload && upload.fase === 'confirmado' ? (upload.documentoEditalId ?? null) : null;
  });

  /** Mais de um documento confirmado aguardando escolha explícita — resolvida na Identificação (CA-02). */
  readonly precisaEscolherDocumento = computed(() => this.store.documentosParaEscolha().length > 0);

  readonly temFaseDeColeta = computed(() =>
    temFaseDeColetaInscricao(this.store.draft(), this.catalogosDoCronograma.fasePorId()),
  );
  readonly faseAncora = computed(() =>
    faseQueAncoraOPeriodoDeInscricao(this.store.draft(), this.catalogosDoCronograma.fasePorId()),
  );

  /**
   * Checklist estrutural agrupado por dimensão — `null` enquanto não carregou.
   *
   * Enquanto `ultimaRecusa()` existir, ela é a fonte inteira (não só para
   * decidir "ok"): o `GET` anterior pode estar desatualizado, e mostrar os
   * grupos antigos ao lado do banner verde de `estruturalOk()` contradiria a
   * própria tela — a pendência reaparece só quando `recarregarPreflight()`
   * busca um novo `GET` e `ultimaRecusa()` é limpa.
   */
  readonly gruposEstruturais = computed(() => {
    const recusa = this.ultimaRecusa();
    if (recusa !== null) {
      return agruparPorDimensao(recusa.pendencias.map((pendencia) => ({ ...pendencia, ok: false })));
    }
    const itens = this.preflight.estrutural();
    return itens === null ? null : agruparPorDimensao(itens);
  });

  readonly estruturalOk = computed(() => {
    const recusa = this.ultimaRecusa();
    if (recusa !== null) return recusa.pendencias.length === 0;
    const itens = this.preflight.estrutural();
    return itens !== null && itens.every((item) => item.ok);
  });

  readonly regrasLegaisReprovadas = computed<readonly ObrigatoriedadeReprovadaProblem[]>(() => {
    const daUltimaRecusa = this.ultimaRecusa()?.obrigatoriedadesReprovadas;
    if (daUltimaRecusa !== null && daUltimaRecusa !== undefined) return daUltimaRecusa;

    const legal = this.preflight.legal();
    if (legal === null) return [];
    return legal.regras
      .filter((regra) => !regra.aprovada)
      .map((regra) => ({
        regraCodigo: regra.regraCodigo,
        descricaoHumana: regra.descricaoHumana,
        baseLegal: regra.baseLegal,
        motivo: regra.motivo,
      }));
  });

  readonly legalOk = computed(() => {
    const daUltimaRecusa = this.ultimaRecusa()?.obrigatoriedadesReprovadas;
    if (daUltimaRecusa !== null && daUltimaRecusa !== undefined) return daUltimaRecusa.length === 0;

    const legal = this.preflight.legal();
    return legal !== null && legal.regras.every((regra) => regra.aprovada);
  });

  /**
   * O checklist legal em tela foi avaliado para uma `dataReferencia` que já
   * não é a que o rascunho declara agora — a fase de coleta mudou, ou o
   * operador terminou de digitar o início do período depois de o preflight
   * ter carregado sem essa data (achado do Codex na #486: sem esta checagem,
   * `validate()` podia aprovar um checklist legal avaliado para a data
   * errada). Não recarrega sozinho — `dataReferenciaLegalDe` muda a cada
   * tecla no campo de período, e recarregar a cada tecla é justamente a
   * corrida que `PreflightDaPublicacaoService` foi corrigido para evitar; o
   * operador usa "Atualizar checklist", que já existe na tela.
   */
  readonly legalDesatualizada = computed(() => {
    if (this.preflight.legal() === null) return false;
    return this.preflight.dataReferenciaCarregada() !== this.dataReferenciaLegal();
  });

  readonly rotuloDaDimensao = rotularDimensao;
  readonly passoDaDimensao = passoDaDimensao;

  /** Navega ao passo dono da dimensão, pelo código estável — nunca por comparação de frase (CA-04). */
  irParaSecao(index: number): void {
    this.store.goTo(index);
  }

  rotuloDeAvanco(): string {
    return 'Publicar processo';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validate().valid) return null;

    const draft = this.store.draft();
    const ato = draft.publicacao.ato;
    const tipoAto = this.preflight.tiposAto().find((item) => item.codigo === ato.tipoAtoCodigo);
    const temFase = this.temFaseDeColeta();

    return {
      titulo: 'Confirmar a publicação do processo seletivo',
      aviso:
        'Depois de publicado, este processo vira somente leitura nesta jornada — não é possível desfazer aqui.',
      rotuloDeConfirmar: 'Publicar processo',
      itens: [
        { rotulo: 'Número do ato', valor: draft.publicacao.numero.trim() || 'não informado' },
        {
          rotulo: 'Tipo de ato',
          valor: tipoAto ? `${tipoAto.nome} (${tipoAto.codigo})` : ato.tipoAtoCodigo,
        },
        { rotulo: 'Órgão', valor: ato.orgao },
        { rotulo: 'Série', valor: ato.serie },
        { rotulo: 'Ano', valor: ato.ano },
        { rotulo: 'Data de publicação do ato', valor: ato.dataPublicacao },
        { rotulo: 'Assinante', valor: ato.assinante },
        {
          rotulo: 'Período de inscrição',
          valor: temFase
            ? `janela da fase do cronograma (${this.faseAncora()?.codigo ?? ''})`
            : `${draft.publicacao.periodoInscricaoInicio} até ${draft.publicacao.periodoInscricaoFim}`,
        },
      ],
    };
  }

  /**
   * O que falta NESTA tela — campo em branco, checklist reprovado ou
   * documento ainda não escolhido. Não repete `validarRascunho()` da página,
   * que cobre os passos anteriores (CA-01).
   */
  validate(): StepValidation {
    if (this.store.processoSeletivoId() === null) {
      return {
        valid: false,
        messages: ['Conclua a identificação do processo antes de revisar a conformidade.'],
      };
    }

    const erroDoPreflight = this.preflight.erro();
    if (erroDoPreflight !== null) {
      return { valid: false, messages: [erroDoPreflight] };
    }

    if (this.preflight.carregando() || this.preflight.estrutural() === null) {
      return {
        valid: false,
        messages: ['Aguarde o carregamento do checklist de conformidade.'],
      };
    }

    const messages: string[] = [];
    if (!this.estruturalOk()) {
      messages.push('Há pendências estruturais no checklist. Corrija-as antes de publicar.');
    }
    const legalIndisponivel = this.preflight.legalIndisponivel();
    if (legalIndisponivel !== null) {
      // A conformidade legal não chegou a ser avaliada — dizer "há
      // obrigatoriedades reprovadas" mandaria o operador procurar uma
      // reprovação que não existe. O que falta é o insumo que o próprio
      // servidor nomeou (`#742`).
      messages.push(legalIndisponivel);
    } else if (this.legalDesatualizada()) {
      messages.push(
        'A data de referência do checklist legal mudou desde a última carga. Use "Atualizar checklist" antes de publicar.',
      );
    } else if (!this.legalOk()) {
      messages.push('Há obrigatoriedades legais reprovadas. Corrija-as antes de publicar.');
    }
    if (this.precisaEscolherDocumento()) {
      messages.push(
        'Há mais de um documento confirmado. Escolha o oficial na Identificação antes de publicar.',
      );
    }
    messages.push(
      ...mensagensDePublicacao(
        this.store.draft(),
        this.documentoEditalId(),
        this.catalogosDoCronograma.fasePorId(),
      ),
    );

    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /**
   * Publica e, com `204`, confirma o snapshot (CA-08) antes de devolver
   * sucesso — `store.hidratar()` do detalhe relido é o que leva o wizard a
   * somente leitura (CA-09), pela mesma `edicaoPermitida()` que todo passo já
   * respeita.
   */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['Conclua a identificação do processo antes de publicar.'],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const documentoEditalId = this.documentoEditalId();
    if (documentoEditalId === null) {
      // `validate()` já cobre este caso via `mensagensDePublicacao`; a
      // checagem aqui só estreita o tipo para `comoComandoDePublicacao`.
      return { valid: false, messages: [] };
    }

    const comando = comoComandoDePublicacao(
      this.store.draft(),
      documentoEditalId,
      this.catalogosDoCronograma.fasePorId(),
    );
    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    this.ultimaRecusa.set(null);

    try {
      const resultado = await this.cadastro.publicar(processoId, comando);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };

      if (!resultado.ok) {
        // Rede, 5xx ou `processing_conflict`: `CadastroInicialService`
        // preserva a `Idempotency-Key` porque o comando pode já ter sido
        // executado, mas isso só protege um replay que reenvie o MESMO
        // corpo. Se o operador editar um campo antes de tentar de novo,
        // `ChaveDeSubstituicao.contextoPara()` gira a chave para o corpo
        // mudado — o retry deixa de ser o replay seguro do comando incerto e
        // pode correr contra a primeira tentativa. Mantém a tela travada
        // pelo mesmo sinal do caminho "204 mas releitura falhou", em vez de
        // deixar o `finally` liberar a edição sobre um resultado que ainda
        // não se sabe se aplicou (achado do Codex na #486, P1).
        if (resultado.inconclusiva) this.store.publicacaoNaoConfirmada.set(true);

        const problem = comExtensoesDePublicacao(resultado.problem);
        this.ultimaRecusa.set({
          pendencias: problem.pendencias ?? [],
          // A extensão só vem quando ESTA tentativa avaliou a conformidade
          // legal (ver doc de `RecusaDePublicacao`) — fora desse código,
          // `null` preserva o último estado conhecido em vez de anunciar
          // "sem reprovação" sobre o que a tentativa nem chegou a checar.
          obrigatoriedadesReprovadas:
            problem.code === CODIGO_CONFORMIDADE_LEGAL_INSUFICIENTE
              ? (problem.obrigatoriedadesReprovadas ?? [])
              : null,
          documentoOuAto: eErroDeDocumentoOuAto(problem.code)
            ? this.problemI18n.resolve(problem).title
            : null,
        });
        return { valid: false, messages: [this.problemI18n.resolve(problem).title] };
      }

      const confirmado = await this.confirmarPublicacao(processoId);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };

      if (!confirmado) {
        return {
          valid: false,
          messages: [
            'A publicação foi aceita, mas não foi possível confirmar o estado do processo. Recarregue a página para conferir.',
          ],
        };
      }

      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * CA-08 — depois do `204`, relê `GET /{id}` e `GET /snapshot-vigente`. O
   * `configuracao` que o snapshot traz não é reinterpretado como comando de
   * gravação (fica só como prova visível de hash/versão); quem edita a
   * configuração é o rascunho local, que a partir daqui está bloqueado por
   * `edicaoPermitida()`.
   */
  private async confirmarPublicacao(processoId: string): Promise<boolean> {
    const [detalhe, snapshot] = await Promise.all([
      this.cadastro.obterDetalhe(processoId),
      this.cadastro.obterSnapshotVigente(processoId),
    ]);

    if (!detalhe.ok) {
      // O `POST` já devolveu `204` — a publicação pode ter acontecido de
      // verdade — mas sem o detalhe relido não há como confirmar nem
      // descartar. `persistir()` ainda vai liberar `salvando` no `finally`;
      // sem este sinal a edição destravaria sobre um processo possivelmente
      // já publicado (achado do Codex na #486). Só uma releitura que chegue
      // ao fim — aqui numa nova tentativa, ou na retomada da página — limpa
      // isto, em `store.hidratar()`.
      this.store.publicacaoNaoConfirmada.set(true);
      return false;
    }

    if (detalhe.data.status === StatusProcesso.rascunho) {
      // O `POST` já devolveu `204` — a publicação foi aceita —, mas esta
      // releitura ainda mostra rascunho. Atraso de propagação (réplica que
      // ainda não viu a escrita) ou falha real de aplicar — não dá para
      // distinguir daqui, e as duas exigem a MESMA cautela. `hidratar()`
      // aplicaria este status desatualizado E limparia
      // `publicacaoNaoConfirmada` (é o que ele faz para resolver a
      // incerteza numa releitura que CHEGA a uma resposta definitiva) —
      // tratando um estado ainda intermediário como se fosse o final
      // (achado do Codex na #486, P1: a mesma família que já apareceu
      // nesta frente). Mantém travado; só uma releitura que mostre um
      // status definitivo resolve.
      this.store.publicacaoNaoConfirmada.set(true);
      return false;
    }

    // Hidrata assim que o detalhe responde com um status definitivo, mesmo
    // que o snapshot falhe: o POST já pode ter publicado de verdade, e
    // deixar o rascunho no estado antigo reabriria os controles de edição e
    // de publicar sobre um processo que o servidor já considera imutável
    // (achado do Codex na #486). `persistir()` ainda devolve inválido
    // quando `snapshot` falha — só a hidratação, que é o que trava a tela,
    // não pode esperar por ele.
    this.store.hidratar(detalhe.data);

    if (!snapshot.ok) return false;

    this.snapshotConfirmado.set(snapshot.data);
    return detalhe.data.status === StatusProcesso.publicado;
  }

  /** O `<input type="datetime-local">` só existe fora do ramo de fase de coleta — este helper valida o formato antes de exibir feedback. */
  periodoValido(valor: string): boolean {
    return instanteDoCampo(valor) !== null;
  }
}
