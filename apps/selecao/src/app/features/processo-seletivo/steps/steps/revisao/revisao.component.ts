import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { SnapshotVigenteDto, StatusProcesso } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation, WizardDraft } from '../../processo-seletivo.models';
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

type AtoDoRascunho = WizardDraft['publicacao']['ato'];

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

const CODIGO_CONFORMIDADE_LEGAL_INSUFICIENTE = 'ProcessoSeletivo.ConformidadeLegalInsuficiente';

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
  imports: [AnexoEditalComponent],
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

  constructor() {
    // Todos os passos ficam montados (`[hidden]`) desde a entrada na página —
    // o construtor roda bem antes de o operador chegar a este passo, e numa
    // retomada por endereço o id só existe depois que `retomar()` conclui a
    // leitura. Um `effect()` — não uma checagem única aqui — é o que garante
    // carregar assim que o id passar a existir.
    effect(() => {
      const id = this.store.processoSeletivoId();
      if (id === null) return;
      untracked(() => {
        void this.preflight.carregar(id, this.dataReferenciaLegal());
      });
    });
  }

  recarregarPreflight(): void {
    const id = this.store.processoSeletivoId();
    if (id === null) return;
    this.ultimaRecusa.set(null);
    void this.preflight.recarregar(id, this.dataReferenciaLegal());
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

  readonly rotuloDaDimensao = rotularDimensao;
  readonly passoDaDimensao = passoDaDimensao;

  /** Navega ao passo dono da dimensão, pelo código estável — nunca por comparação de frase (CA-04). */
  irParaSecao(index: number): void {
    this.store.goTo(index);
  }

  alterarNumero(valor: string): void {
    this.store.patchObjectSection('publicacao', { numero: valor });
  }

  alterarPeriodoInicio(valor: string): void {
    this.store.patchObjectSection('publicacao', { periodoInscricaoInicio: valor });
  }

  alterarPeriodoFim(valor: string): void {
    this.store.patchObjectSection('publicacao', { periodoInscricaoFim: valor });
  }

  alterarAto(patch: Partial<AtoDoRascunho>): void {
    this.store.patchObjectSection('publicacao', {
      ato: { ...this.store.draft().publicacao.ato, ...patch },
    });
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
    if (!this.legalOk()) {
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
            'A publicação foi aceita, mas não foi possível confirmar o snapshot. Recarregue a página para conferir o estado do processo.',
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

    if (!detalhe.ok || !snapshot.ok) return false;

    this.store.hidratar(detalhe.data);
    this.snapshotConfirmado.set(snapshot.data);
    return detalhe.data.status === StatusProcesso.publicado;
  }

  /** O `<input type="datetime-local">` só existe fora do ramo de fase de coleta — este helper valida o formato antes de exibir feedback. */
  periodoValido(valor: string): boolean {
    return instanteDoCampo(valor) !== null;
  }
}
