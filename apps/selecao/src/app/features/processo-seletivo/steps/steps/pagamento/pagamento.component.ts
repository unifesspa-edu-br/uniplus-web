import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { isApiOk } from '@uniplus/shared-core/http';
import {
  FundamentoIsencao,
  FundamentoIsencaoCodigo,
  FundamentoIsencaoDto,
  ProcessosSeletivosApi,
} from '@uniplus/shared-data/selecao';

import { ProblemI18nService } from '@uniplus/shared-core/http';

import { StepValidation, WizardDraft } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';

/**
 * Declaração de taxa de inscrição e dos fundamentos de isenção que o processo
 * reconhece — o que o comando de configuração recebe, nada além.
 *
 * A janela de solicitação e o prazo de recurso não estão aqui: são período do
 * cronograma e interposição, respectivamente, e o contrato não os recebe neste
 * recurso (UNI-REQ-0106).
 */
@Component({
  selector: 'sel-step-pagamento',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './pagamento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(PagamentoStepComponent)],
})
export class PagamentoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Recusa da gravação, exibida no passo sem apagar o que foi preenchido. */
  readonly erroDeGravacao = signal<string | null>(null);

  readonly fundamentos = signal<readonly FundamentoOferecivel[]>([]);
  readonly fundamentosErro = signal<string | null>(null);
  readonly fundamentosCarregando = signal(true);

  /**
   * Fundamento que o catálogo devolveu e este cliente não sabe enviar. Sem o
   * aviso, ele simplesmente não apareceria na tela.
   */
  readonly fundamentosNaoSuportados = signal<readonly string[]>([]);

  readonly form = new FormGroup({
    cobra: new FormControl<boolean | null>(null, { validators: [Validators.required] }),
    valor: new FormControl('', { nonNullable: true }),
    confirmacaoFundamentos: new FormControl(false, { nonNullable: true }),
  });

  readonly cobra = signal<boolean | null>(null);

  /** Fundamentos escolhidos, na ordem do catálogo. */
  readonly selecionados = computed(() => this.store.draft().pagamento.fundamentos);

  readonly exigeConfirmacao = computed(() => this.selecionados().length > 0);

  constructor() {
    this.carregarFundamentos();

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
      this.cobra.set(valor.cobra ?? null);
      this.store.patchObjectSection(
        'pagamento',
        coerenteComADeclaracao(
          valor.cobra ?? null,
          valor.valor ?? '',
          valor.confirmacaoFundamentos ?? false,
        ),
      );
    });

    effect(() => {
      if (this.store.aceitaEdicao()) this.form.enable({ emitEvent: false });
      else this.form.disable({ emitEvent: false });
    });

    effect(() => {
      const pagamento = this.store.draft().pagamento;
      this.cobra.set(pagamento.cobra);
      this.form.patchValue(
        {
          cobra: pagamento.cobra,
          valor: pagamento.valor,
          confirmacaoFundamentos: pagamento.confirmacaoFundamentos,
        },
        { emitEvent: false },
      );
    });
  }

  carregarFundamentos(): void {
    this.fundamentosCarregando.set(true);
    this.fundamentosErro.set(null);
    this.api
      .listarFundamentosIsencao()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.fundamentosCarregando.set(false);
        if (!isApiOk(resultado)) {
          this.fundamentosErro.set(
            'Não foi possível carregar os fundamentos de isenção. Tente novamente.',
          );
          return;
        }
        const conhecidos: FundamentoOferecivel[] = [];
        const desconhecidos: string[] = [];
        for (const fundamento of resultado.data) {
          const codigo = decodificarFundamento(fundamento.codigo);
          if (codigo === null) {
            desconhecidos.push(fundamento.nome);
            continue;
          }
          conhecidos.push({ ...fundamento, codigo });
        }
        this.fundamentos.set(conhecidos);
        this.fundamentosNaoSuportados.set(desconhecidos);
      });
  }

  estaSelecionado(codigo: FundamentoIsencaoCodigo): boolean {
    return this.selecionados().includes(codigo);
  }

  alternarFundamento(codigo: FundamentoIsencaoCodigo): void {
    // A lista de fundamentos não é controle do formulário, então o `disable`
    // acima não a alcança.
    if (!this.store.aceitaEdicao()) return;

    const atuais = this.selecionados();
    const proximos = atuais.includes(codigo)
      ? atuais.filter((item) => item !== codigo)
      : [...atuais, codigo];

    // Desmarcar o último fundamento tira o que havia a confirmar: manter a
    // confirmação gravada faria o processo ser publicado declarando uma
    // conferência que já não corresponde a nada.
    this.store.patchObjectSection('pagamento', {
      fundamentos: proximos,
      confirmacaoFundamentos:
        proximos.length > 0 && this.store.draft().pagamento.confirmacaoFundamentos,
    });
  }

  /**
   * Sem diálogo de confirmação, ao contrário da identificação: lá o clique cria
   * campos que o contrato não deixa alterar, e aqui a declaração pode ser
   * refeita enquanto o processo for rascunho.
   */
  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Grava a declaração ao concluir o passo. O processo já existe aqui — ele é
   * criado na identificação, que é o passo anterior.
   */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de declarar a taxa.'],
      };
    }

    const pagamento = this.store.draft().pagamento;
    const geracao = this.store.geracao();
    this.erroDeGravacao.set(null);
    this.store.salvando.set(true);
    try {
      const resultado = await this.cadastro.definirTaxaInscricao(processoId, {
        cobra: pagamento.cobra,
        valor: pagamento.valor === '' ? null : Number(pagamento.valor.replace(',', '.')),
        fundamentos: pagamento.fundamentos,
        confirmacaoFundamentos: pagamento.confirmacaoFundamentos,
      });

      // O editor pode ter passado a outro processo enquanto o comando corria.
      // A resposta descreve o processo anterior: anunciá-la agora contaminaria
      // a tela nova, e concluir o passo avançaria o rascunho de outro processo.
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };

      if (!resultado.ok) {
        const mensagem = this.problemI18n.resolve(resultado.problem).title;
        this.erroDeGravacao.set(mensagem);
        return { valid: false, messages: [mensagem] };
      }

      return { valid: true };
    } finally {
      // Quem destrava é a geração que travou: um editor novo pode ter comando
      // próprio em curso.
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  validate(): StepValidation {
    const pagamento = this.store.draft().pagamento;
    const mensagens: string[] = [];

    if (pagamento.cobra === null) {
      mensagens.push('Declare se o processo cobra taxa de inscrição.');
    }

    if (pagamento.cobra === true) {
      const valor = Number(pagamento.valor.replace(',', '.'));
      if (!pagamento.valor.trim() || Number.isNaN(valor) || valor <= 0) {
        mensagens.push('Informe o valor da taxa, maior que zero.');
      }
    }

    if (pagamento.fundamentos.length > 0 && !pagamento.confirmacaoFundamentos) {
      mensagens.push('Confirme os fundamentos de isenção referenciados.');
    }

    return mensagens.length > 0 ? { valid: false, messages: mensagens } : { valid: true };
  }
}

/** Fundamento do catálogo cujo código este cliente sabe enviar. */
interface FundamentoOferecivel extends Omit<FundamentoIsencaoDto, 'codigo'> {
  readonly codigo: FundamentoIsencaoCodigo;
}

/**
 * O catálogo devolve `codigo` como texto livre, enquanto a gravação aceita
 * apenas o vocabulário fechado. Sem traduzir, um código novo no servidor
 * chegaria ao comando e seria recusado no envio, não na escolha.
 */
function decodificarFundamento(codigo: string): FundamentoIsencaoCodigo | null {
  const conhecidos: readonly string[] = Object.values(FundamentoIsencao);
  return conhecidos.includes(codigo) ? (codigo as FundamentoIsencaoCodigo) : null;
}

/**
 * Declarar gratuidade apaga valor, fundamentos e confirmação: o agregado recusa
 * a combinação, e mantê-los no rascunho faria a revisão anunciar uma cobrança
 * que não seria gravada.
 */
function coerenteComADeclaracao(
  cobra: boolean | null,
  valor: string,
  confirmacaoFundamentos: boolean,
): Partial<WizardDraft['pagamento']> {
  return cobra === true
    ? { cobra, valor, confirmacaoFundamentos }
    : { cobra, valor: '', fundamentos: [], confirmacaoFundamentos: false };
}
