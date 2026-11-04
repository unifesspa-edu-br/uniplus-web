import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';
import { AnexoEditalComponent } from '../../shared/anexo-edital/anexo-edital.component';
import { AnexosDoEditalComponent } from '../../shared/anexos-do-edital/anexos-do-edital.component';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { instanteLegivel } from '../../shared/fuso-institucional';
import { RegrasDasModalidadesComponent } from '../../shared/regras-das-modalidades.component';
import { documentosPorFase } from '../../shared/documentos-exigidos';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { AvisosDaRevisaoComponent } from './avisos-da-revisao.component';
import { ehEnderecoNavegavel } from './endereco-navegavel';
import { PreflightDaPublicacaoService } from './preflight-da-publicacao.service';
import { ConferenciaDaPublicacaoService } from './servicos/conferencia-da-publicacao.service';
import { PublicacaoDoProcessoService } from './servicos/publicacao-do-processo.service';
import { faseQueAncoraOPeriodoDeInscricao, temFaseDeColetaInscricao } from './periodo-de-inscricao';
import { rotuloDaDimensao } from './grupos-da-revisao';

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
  imports: [
    ValorLegivelDirective,
    ValorEmConsultaComponent,
    AnexoEditalComponent,
    AnexosDoEditalComponent,
    DateBrPipe,
    ReactiveFormsModule,
    RegrasDasModalidadesComponent,
    AvisosDaRevisaoComponent,
    TemPermissaoDirective,
  ],
  templateUrl: './revisao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provePassoDoWizard(RevisaoStepComponent),
    PreflightDaPublicacaoService,
    ConferenciaDaPublicacaoService,
    PublicacaoDoProcessoService,
  ],
})
export class RevisaoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  protected readonly permissaoDePublicar = PERMISSAO.selecao.processosPublicar;
  private readonly permissoes = inject(PermissoesService);
  /** Só quem publica vê o campo de anexo; a orientação de anexar não serve a quem não o vê. */
  protected readonly podePublicar = computed(() => this.permissoes.tem(this.permissaoDePublicar));
  readonly preflight = inject(PreflightDaPublicacaoService);
  protected readonly conferencia = inject(ConferenciaDaPublicacaoService);
  protected readonly publicacao = inject(PublicacaoDoProcessoService);

  /**
   * Os documentos exigidos por fase, com a situação da base legal que a publicação confere: a
   * exigência que decide o resultado precisa de norma resolvida.
   */
  protected readonly documentosDasFases = computed(() => {
    const { documentos, cronograma } = this.store.draft();
    const nomeDaFase = this.catalogosDoCronograma.nomeDaFase();
    return documentosPorFase(
      documentos,
      cronograma.fases.map((fase) => fase.codigo),
    ).map((fase) => ({ ...fase, nome: nomeDaFase(fase.faseCodigo) }));
  });

  /** Quem concorre em cada modalidade ofertada, pela regra que o processo congelou. */
  protected readonly regrasDasModalidades = this.store.regrasDasModalidades;
  private readonly dataBr = new DateBrPipe();
  /** Provido na página, a mesma instância do cronograma: resolve `coletaInscricao` da fase acrescentada nesta sessão. */
  private readonly catalogosDoCronograma = inject(CatalogosDoCronogramaService);

  /**
   * A transcrição do ato gravada no rascunho, para o processo que não aceita edição e ainda não
   * tem ato publicado a mostrar (cancelado, encerrado): os campos do formulário, lidos como texto.
   */
  readonly atoDoRascunhoLido = computed(() => {
    const { publicacao } = this.store.draft();
    const { ato } = publicacao;
    const tipo = this.preflight.tiposAto().find((item) => item.codigo === ato.tipoAtoCodigo);
    return [
      { rotulo: 'Número do ato', valor: publicacao.numero.trim() || 'Não informado' },
      { rotulo: 'Tipo de ato', valor: tipo ? `${tipo.nome} (${tipo.codigo})` : ato.tipoAtoCodigo },
      { rotulo: 'Órgão', valor: ato.orgao },
      { rotulo: 'Série', valor: ato.serie },
      { rotulo: 'Ano', valor: ato.ano },
      {
        rotulo: 'Data de publicação do ato',
        valor: ato.dataPublicacao ? this.dataBr.transform(ato.dataPublicacao) : '',
      },
      { rotulo: 'Assinante', valor: ato.assinante },
    ];
  });

  /** O período de inscrição transcrito, quando o cronograma não tem fase que o derive. */
  readonly periodoDeInscricaoLido = computed(() => {
    const { periodoInscricaoInicio, periodoInscricaoFim } = this.store.draft().publicacao;
    return periodoInscricaoInicio && periodoInscricaoFim
      ? `${periodoInscricaoInicio} até ${periodoInscricaoFim}`
      : '';
  });

  /** O ato vigente como pares rótulo e valor, na ordem do formulário que ele substitui. */
  readonly resumoDoAto = computed(() => {
    const leitura = this.publicacao.atoPublicado();
    if (leitura?.estado !== 'lido') return null;
    const { ato } = leitura;
    const tipo = this.preflight.tiposAto().find((item) => item.codigo === ato.tipoCodigo);
    return [
      { rotulo: 'Número do ato', valor: ato.numero?.trim() || 'não informado' },
      { rotulo: 'Tipo de ato', valor: tipo?.nome ?? ato.tipoCodigo },
      { rotulo: 'Órgão', valor: ato.orgao },
      { rotulo: 'Série', valor: ato.serie },
      { rotulo: 'Ano', valor: String(ato.ano) },
      { rotulo: 'Data de publicação do ato', valor: this.dataBr.transform(ato.dataPublicacao) },
      { rotulo: 'Assinante', valor: ato.assinante },
    ];
  });

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
    // Recarrega a cada entrada no passo, porque qualquer dimensão gravada num passo anterior muda o
    // que o servidor considera conforme, e nenhuma delas sabe invalidar o cache do checklist.
    // `isLast()` é como o passo se identifica sem saber a própria posição: a Revisão é sempre a última.
    effect(() => {
      const id = this.store.processoSeletivoId();
      const entrouNoPasso = this.store.isLast();
      if (id === null || !entrouNoPasso) return;
      untracked(() => {
        void this.preflight.recarregar(id, this.conferencia.dataReferenciaLegal());
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
          if (controle.value !== valores[chave])
            controle.setValue(valores[chave], { emitEvent: false });
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
    // só descobria com o 422, depois de confirmar o diálogo de publicação.
    // Só limpa com o catálogo definitivamente
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

  tentarLerAtoDeNovo(): void {
    const id = this.store.processoSeletivoId();
    if (id !== null) void this.publicacao.lerAtoPublicado(id);
  }

  /**
   * Relê o checklist do servidor. `ProcessoSeletivoPage.publicar()` o chama depois de gravar de novo
   * um passo anterior corrigido, para a conferência em tela refletir a correção antes de julgar de novo.
   */
  recarregarChecklist(): Promise<void> {
    return this.conferencia.atualizar();
  }

  readonly temFaseDeColeta = computed(() =>
    temFaseDeColetaInscricao(this.store.draft(), this.catalogosDoCronograma.fasePorId()),
  );
  readonly faseAncora = computed(() =>
    faseQueAncoraOPeriodoDeInscricao(this.store.draft(), this.catalogosDoCronograma.fasePorId()),
  );

  /** A fase que ancora o período de inscrição, pelo nome e com a janela em data e hora locais. */
  readonly janelaDaInscricao = computed(() => {
    const fase = this.faseAncora();
    if (fase === null) return null;
    const nome =
      this.catalogosDoCronograma.fasePorId().get(fase.faseCanonicaId)?.nome ?? 'de inscrição';
    const janela =
      fase.inicio && fase.fim
        ? `${instanteLegivel(fase.inicio)} até ${instanteLegivel(fase.fim)}`
        : null;
    return { nome, janela };
  });

  protected readonly rotuloDaDimensao = rotuloDaDimensao;
  protected readonly ehEnderecoNavegavel = ehEnderecoNavegavel;

  /** Leva ao Cronograma já na fase citada pela recusa. */
  irParaFase(codigo: string): void {
    this.store.irParaFase(codigo);
  }

  /** Navega ao passo dono do item, pelo código estável — nunca por comparação de frase (CA-04). */
  irParaSecao(index: number): void {
    this.store.goTo(index);
  }

  rotuloDeAvanco(): string {
    return 'Publicar processo';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.conferencia.validate().valid) return null;

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
            ? `janela da fase ${this.janelaDaInscricao()?.nome ?? ''} do cronograma`
            : `${draft.publicacao.periodoInscricaoInicio} até ${draft.publicacao.periodoInscricaoFim}`,
        },
      ],
    };
  }

  validate(): StepValidation {
    return this.conferencia.validate();
  }

  persistir(): Promise<StepValidation> {
    return this.publicacao.persistir();
  }
}
