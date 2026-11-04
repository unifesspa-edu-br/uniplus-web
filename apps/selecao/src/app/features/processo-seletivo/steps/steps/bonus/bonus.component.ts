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
  RolagemFocavelDirective,
  ValorEmConsultaComponent,
  ValorLegivelDirective,
} from '@uniplus/shared-ui/components';

import { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { gravarNoPasso, RESPOSTA_DESCARTADA } from '../../shared/gravacao/gravacao-no-passo';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import { leituraDoCampoDecimal } from '../../shared/numero-do-campo';
import {
  lerChaveDaRegra,
  regrasEscolhiveis,
  rotuloDaRegraEscolhida,
} from '../classificacao/regra-escolhivel';
import { BasesLegaisDeBonus } from './bases-legais-de-bonus.service';
import { comoComandoDeBonus } from './bonus-para-comando';
import { confirmacaoDoBonus } from './confirmacao-do-bonus';
import { validarBonus } from './validacao-do-bonus';
import {
  type FatoDeElegibilidade,
  citaFatoDeElegibilidade,
  fatosDeElegibilidade,
} from './fato-de-elegibilidade';

/**
 * Bônus regional (`PUT …/bonus-regional`) — o processo declara se aplica o bônus ou não, e a
 * ausência da configuração só significa "sem bônus" quando a declaração é falsa. Não existe
 * "BONUS-NENHUM". Reconstrução conforme o contrato: nenhum campo da tela anterior (`tipo`,
 * `valor`, `criterio`, `modalidades`) tem correspondente aqui.
 */
@Component({
  selector: 'sel-step-bonus',
  standalone: true,
  imports: [
    ValorLegivelDirective,
    ReactiveFormsModule,
    RolagemFocavelDirective,
    ValorEmConsultaComponent,
  ],
  templateUrl: './bonus.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BasesLegaisDeBonus, provePassoDoWizard(BonusPassoComponent)],
})
export class BonusPassoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacao);
  protected readonly basesLegais = inject(BasesLegaisDeBonus);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cadastro = inject(CadastroInicial);
  private readonly problemI18n = inject(ProblemI18nService);

  /**
   * A resposta de aplicar ou não o bônus. O rascunho do store é a fonte da verdade: o controle
   * grava nele ao mudar e o acompanha quando o rascunho é hidratado ou a edição é bloqueada.
   */
  readonly aplica = new FormControl<boolean | null>(null);

  constructor() {
    this.aplica.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((aplica) => {
      this.store.patchObjectSection('bonus', { aplica });
    });
    effect(() => {
      const aplica = this.store.draft().bonus.aplica;
      if (this.aplica.value !== aplica) this.aplica.setValue(aplica, { emitEvent: false });
      const editavel = this.store.aceitaEdicao();
      if (editavel && this.aplica.disabled) this.aplica.enable({ emitEvent: false });
      if (!editavel && this.aplica.enabled) this.aplica.disable({ emitEvent: false });
    });

    this.catalogos.carregar();
  }

  readonly regrasBonus = computed(() => {
    const bonus = this.store.draft().bonus;
    return regrasEscolhiveis(this.catalogos.regrasBonus(), bonus.regraCodigo, bonus.regraVersao);
  });

  /** Se o passo pede o fato que decide quem recebe o acréscimo. */
  readonly citaElegibilidade = computed(() => citaFatoDeElegibilidade(this.store.draft()));

  /** Os fatos que podem decidir quem recebe o acréscimo, lidos do formulário de inscrição. */
  readonly fatosDeElegibilidade = computed(() =>
    fatosDeElegibilidade(this.store.draft().formulario),
  );

  /**
   * O fato escolhido que deixou de estar no formulário de inscrição como campo de sim ou não,
   * nem é mais derivado assim pelo processo. Fica visível para quem configura, em vez de sumir
   * do seletor.
   */
  readonly fatoEscolhidoForaDoFormulario = computed<string | null>(() => {
    const codigo = this.store.draft().bonus.fatoElegibilidadeCodigo;
    if (codigo === '') return null;
    return this.fatosDeElegibilidade().some((fato) => fato.codigo === codigo) ? null : codigo;
  });

  rotuloDoFatoDeElegibilidade(fato: FatoDeElegibilidade): string {
    return fato.origem === 'campo'
      ? `${fato.rotulo} (${fato.codigo})`
      : `${fato.codigo} (derivado pelo processo)`;
  }

  /** O bônus como se lê em consulta, com o rótulo de cada escolha. */
  readonly leitura = computed(() => {
    const bonus = this.store.draft().bonus;
    const base = this.basesLegais
      .escolhiveis()
      .find((item) => item.id === bonus.baseLegalBonusRegionalId);
    return {
      aplicacao: aplicacaoEmConsulta(bonus.aplica),
      regra: rotuloDaRegraEscolhida(this.regrasBonus()),
      fator: leituraDoCampoDecimal(bonus.fator),
      teto: leituraDoCampoDecimal(bonus.teto),
      baseLegal: base === undefined ? null : this.basesLegais.rotuloDaBaseLegal(base),
      fatoElegibilidade: this.leituraDoFatoDeElegibilidade(bonus.fatoElegibilidadeCodigo),
    };
  });

  escolherRegra(valor: string): void {
    const { codigo, versao } = lerChaveDaRegra(valor);
    this.store.patchObjectSection('bonus', { regraCodigo: codigo, regraVersao: versao });
  }

  private leituraDoFatoDeElegibilidade(codigo: string): string | null {
    if (codigo === '') return null;
    const fato = this.fatosDeElegibilidade().find((item) => item.codigo === codigo);
    return fato === undefined ? codigo : this.rotuloDoFatoDeElegibilidade(fato);
  }

  escolherFatoDeElegibilidade(codigo: string): void {
    this.store.patchObjectSection('bonus', { fatoElegibilidadeCodigo: codigo });
  }

  escolherBaseLegal(id: string): void {
    this.store.patchObjectSection('bonus', { baseLegalBonusRegionalId: id });
  }

  escolherAplicacao(aplica: boolean): void {
    this.aplica.setValue(aplica);
  }

  alterarFator(fator: string): void {
    this.store.patchObjectSection('bonus', { fator });
  }

  alterarTeto(teto: string): void {
    this.store.patchObjectSection('bonus', { teto });
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validar().valid) return null;

    const bonus = this.store.draft().bonus;
    return confirmacaoDoBonus({
      bonus,
      identificacaoDaBaseLegal: this.basesLegais
        .escolhiveis()
        .find((base) => base.id === bonus.baseLegalBonusRegionalId)?.identificacao,
      citaElegibilidade: this.citaElegibilidade(),
      fatoDeElegibilidade: this.leitura().fatoElegibilidade,
    });
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validar(): ValidacaoDoPasso {
    const messages = validarBonus(this.store.draft().bonus);
    return messages.length ? { valid: false, messages: [...messages] } : { valid: true };
  }

  /** Grava a declaração do bônus regional — aplica ou não, o passo sempre grava. */
  async persistir(): Promise<ValidacaoDoPasso> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de configurar o bônus.'],
      };
    }

    const conferencia = this.validar();
    if (!conferencia.valid) return conferencia;

    return gravarNoPasso(this.store, async () => {
      const geracao = this.store.geracao();
      const resultado = await this.cadastro.definirBonusRegional(
        processoId,
        comoComandoDeBonus(this.store.draft().bonus),
      );

      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      return resultado.ok
        ? { valid: true }
        : { valid: false, messages: [this.problemI18n.resolve(resultado.problem).title] };
    });
  }
}

/** A declaração como se lê em consulta; sem resposta, o servidor ainda não a tem. */
function aplicacaoEmConsulta(aplica: boolean | null): string | null {
  if (aplica === null) return null;
  return aplica ? 'Aplicado neste processo' : 'Não aplicado neste processo';
}
