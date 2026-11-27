import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import {
  FalhaDeLeituraComponent,
  FalhaDeLeituraDoCampoComponent,
  RolagemFocavelDirective,
  ValorEmConsultaComponent,
  ValorLegivelDirective,
} from '@uniplus/shared-ui/components';

import { PASSO_FORMULARIO } from '../../processo-seletivo.data';
import { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { gravarNoPasso, RESPOSTA_DESCARTADA } from '../../shared/gravacao/gravacao-no-passo';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import { CatalogoDeFases } from '../cronograma/catalogos/catalogo-de-fases.service';
import { conteudoDaInscricao } from '../formulario/formularios-do-rascunho';
import { fasesQueColetamInscricao } from '../../shared/descricao-da-fase';
import { leituraDoCampoDecimal } from '../../shared/numero-do-campo';
import {
  lerChaveDaRegra,
  regrasEscolhiveis,
  rotuloDaRegraEscolhida,
} from '../classificacao/regra-escolhivel';
import { BasesLegaisDoFada } from './bases-legais-do-fada.service';
import { confirmacaoDoFada } from './confirmacao-do-fada';
import { comoComandoDoFada } from './fada-para-comando';
import { validarFada } from './validacao-do-fada';
import {
  type FatoDeElegibilidade,
  citaFatoDeElegibilidade,
  fatosDeElegibilidade,
} from './fato-de-elegibilidade';

const MENSAGEM_SEM_CADASTRO =
  'O cadastro do processo precisa estar concluído antes de configurar o Fator de Atenuação.';

/**
 * FADA (`PUT …/fada`) — o processo declara se aplica o Fator de Atenuação ou não, e a
 * ausência da configuração só significa "sem Fator de Atenuação" quando a declaração é falsa. Não existe
 * "BONUS-NENHUM". Reconstrução conforme o contrato: nenhum campo da tela anterior (`tipo`,
 * `valor`, `criterio`, `modalidades`) tem correspondente aqui.
 */
@Component({
  selector: 'sel-step-fada',
  standalone: true,
  imports: [
    FalhaDeLeituraComponent,
    FalhaDeLeituraDoCampoComponent,
    ValorLegivelDirective,
    ReactiveFormsModule,
    RolagemFocavelDirective,
    ValorEmConsultaComponent,
  ],
  templateUrl: './fada.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BasesLegaisDoFada, provePassoDoWizard(FadaPassoComponent)],
})
export class FadaPassoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacao);
  private readonly catalogoDeFases = inject(CatalogoDeFases);
  protected readonly basesLegais = inject(BasesLegaisDoFada);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cadastro = inject(CadastroInicial);
  private readonly problemI18n = inject(ProblemI18nService);

  /**
   * A resposta de aplicar ou não o FADA. O rascunho do store é a fonte da verdade: o controle
   * grava nele ao mudar e o acompanha quando o rascunho é hidratado ou a edição é bloqueada.
   */
  readonly aplica = new FormControl<boolean | null>(null);

  constructor() {
    this.aplica.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((aplica) => {
      this.store.patchObjectSection('fada', { aplica });
    });
    effect(() => {
      const aplica = this.store.draft().fada.aplica;
      if (this.aplica.value !== aplica) this.aplica.setValue(aplica, { emitEvent: false });
      const editavel = this.store.aceitaEdicao();
      if (editavel && this.aplica.disabled) this.aplica.enable({ emitEvent: false });
      if (!editavel && this.aplica.enabled) this.aplica.disable({ emitEvent: false });
    });

    this.catalogos.carregar();
  }

  readonly regrasFada = computed(() => {
    const fada = this.store.draft().fada;
    return regrasEscolhiveis(this.catalogos.regrasFada(), fada.regraCodigo, fada.regraVersao);
  });

  /** Leva ao passo em que o formulário de inscrição é montado, de onde saem as opções da escolha. */
  irParaFormularios(): void {
    this.store.goTo(PASSO_FORMULARIO);
  }

  /** Se o formulário de inscrição já tem algum item: a lista vazia, então, não é de formulário por montar. */
  readonly formularioMontado = computed(
    () => (this.formularioDaInscricao().itens ?? []).length > 0,
  );

  private readonly formularioDaInscricao = computed(() => {
    const draft = this.store.draft();
    const fases = fasesQueColetamInscricao(
      draft.cronograma.fases,
      this.catalogoDeFases.fasePorId(),
    );
    return conteudoDaInscricao(draft.formulario, fases);
  });

  /** Se o passo pede o fato que decide quem recebe o acréscimo. */
  readonly citaElegibilidade = computed(() => citaFatoDeElegibilidade(this.store.draft()));

  /** Os fatos que podem decidir quem recebe o acréscimo, lidos do formulário de inscrição. */
  readonly fatosDeElegibilidade = computed(() =>
    fatosDeElegibilidade(this.formularioDaInscricao(), this.store.draft().formulario.derivacao),
  );

  /**
   * O fato escolhido que deixou de estar no formulário de inscrição como campo de sim ou não,
   * nem é mais derivado assim pelo processo. Fica visível para quem configura, em vez de sumir
   * do seletor.
   */
  readonly fatoEscolhidoForaDoFormulario = computed<string | null>(() => {
    const codigo = this.store.draft().fada.fatoElegibilidadeCodigo;
    if (codigo === '') return null;
    return this.fatosDeElegibilidade().some((fato) => fato.codigo === codigo) ? null : codigo;
  });

  rotuloDoFatoDeElegibilidade(fato: FatoDeElegibilidade): string {
    return fato.origem === 'campo'
      ? `${fato.rotulo} (${fato.codigo})`
      : `${fato.codigo} (derivado pelo processo)`;
  }

  /** O FADA como se lê em consulta, com o rótulo de cada escolha. */
  readonly leitura = computed(() => {
    const fada = this.store.draft().fada;
    const base = this.basesLegais.escolhiveis().find((item) => item.id === fada.baseLegalDoFadaId);
    return {
      aplicacao: aplicacaoEmConsulta(fada.aplica),
      regra: rotuloDaRegraEscolhida(this.regrasFada()),
      fator: leituraDoCampoDecimal(fada.fator),
      teto: leituraDoCampoDecimal(fada.teto),
      baseLegal: base === undefined ? null : this.basesLegais.rotuloDaBaseLegal(base),
      fatoElegibilidade: this.leituraDoFatoDeElegibilidade(fada.fatoElegibilidadeCodigo),
    };
  });

  escolherRegra(valor: string): void {
    const { codigo, versao } = lerChaveDaRegra(valor);
    this.store.patchObjectSection('fada', { regraCodigo: codigo, regraVersao: versao });
  }

  private leituraDoFatoDeElegibilidade(codigo: string): string | null {
    if (codigo === '') return null;
    const fato = this.fatosDeElegibilidade().find((item) => item.codigo === codigo);
    return fato === undefined ? codigo : this.rotuloDoFatoDeElegibilidade(fato);
  }

  escolherFatoDeElegibilidade(codigo: string): void {
    this.store.patchObjectSection('fada', { fatoElegibilidadeCodigo: codigo });
  }

  escolherBaseLegal(id: string): void {
    this.store.patchObjectSection('fada', { baseLegalDoFadaId: id });
  }

  escolherAplicacao(aplica: boolean): void {
    this.aplica.setValue(aplica);
  }

  alterarFator(fator: string): void {
    this.store.patchObjectSection('fada', { fator });
  }

  alterarTeto(teto: string): void {
    this.store.patchObjectSection('fada', { teto });
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validar().valid) return null;

    const fada = this.store.draft().fada;
    return confirmacaoDoFada({
      fada,
      identificacaoDaBaseLegal: this.basesLegais
        .escolhiveis()
        .find((base) => base.id === fada.baseLegalDoFadaId)?.identificacao,
      citaElegibilidade: this.citaElegibilidade(),
      fatoDeElegibilidade: this.leitura().fatoElegibilidade,
    });
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validar(): ValidacaoDoPasso {
    const messages = validarFada(this.store.draft().fada);
    return messages.length ? { valid: false, messages: [...messages] } : { valid: true };
  }

  /** Grava a declaração do Fator de Atenuação — aplica ou não, o passo sempre grava. */
  async persistir(): Promise<ValidacaoDoPasso> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) return { valid: false, messages: [MENSAGEM_SEM_CADASTRO] };

    const conferencia = this.validar();
    if (!conferencia.valid) return conferencia;

    return gravarNoPasso(this.store, () => this.gravarDeclaracao(processoId));
  }

  private async gravarDeclaracao(processoId: string) {
    const geracao = this.store.geracao();
    const resultado = await this.cadastro.definirFada(
      processoId,
      comoComandoDoFada(this.store.draft().fada),
    );

    if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
    return resultado.ok
      ? { valid: true }
      : { valid: false, messages: [this.problemI18n.resolve(resultado.problem).title] };
  }
}

/** A declaração como se lê em consulta; sem resposta, o servidor ainda não a tem. */
function aplicacaoEmConsulta(aplica: boolean | null): string | null {
  if (aplica === null) return null;
  return aplica ? 'Aplicado neste processo' : 'Não aplicado neste processo';
}
