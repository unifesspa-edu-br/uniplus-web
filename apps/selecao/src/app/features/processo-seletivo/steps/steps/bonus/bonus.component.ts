import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProblemI18nService } from '@uniplus/shared-core/http';

import { StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { regrasEscolhiveis } from '../classificacao/regra-escolhivel';
import { comoComandoDeBonus } from './bonus-para-comando';

/** Alinhado a `ConfiguracaoBonusRegional.MunicipioConvenioMaxLength` (varchar(200)). */
const MUNICIPIO_CONVENIO_MAX_LENGTH = 200;
/** Alinhado a `ConfiguracaoBonusRegional.BaseLegalMaxLength` (varchar(500)). */
const BASE_LEGAL_MAX_LENGTH = 500;

/**
 * Bônus regional (RN05, `PUT …/bonus-regional`) — toggle por presença: não
 * existe "BONUS-NENHUM", a ausência da entidade já significa sem bônus.
 * Reconstrução conforme o contrato: nenhum campo da tela anterior (`tipo`,
 * `valor`, `criterio`, `modalidades`) tem correspondente aqui.
 */
@Component({
  selector: 'sel-step-bonus',
  standalone: true,
  templateUrl: './bonus.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(BonusStepComponent)],
})
export class BonusStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);

  constructor() {
    this.catalogos.carregar();
  }

  readonly regrasBonus = computed(() => {
    const bonus = this.store.draft().bonus;
    return regrasEscolhiveis(this.catalogos.regrasBonus(), bonus.regraCodigo, bonus.regraVersao);
  });

  escolherRegra(valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');
    this.store.patchObjectSection('bonus', { regraCodigo: codigo, regraVersao: versao });
  }

  alternarAtivo(ativo: boolean): void {
    this.store.patchObjectSection('bonus', { ativo });
  }

  alterarFator(fator: string): void {
    this.store.patchObjectSection('bonus', { fator });
  }

  alterarTeto(teto: string): void {
    this.store.patchObjectSection('bonus', { teto });
  }

  alterarMunicipioConvenio(municipioConvenio: string): void {
    this.store.patchObjectSection('bonus', { municipioConvenio });
  }

  alterarBaseLegal(baseLegal: string): void {
    this.store.patchObjectSection('bonus', { baseLegal });
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validate().valid) return null;

    const bonus = this.store.draft().bonus;
    if (!bonus.ativo) {
      return {
        titulo: 'Confirmar a ausência de bônus regional',
        aviso: 'Nenhum bônus regional será declarado para este processo.',
        rotuloDeConfirmar: 'Confirmar sem bônus',
        itens: [{ rotulo: 'Bônus regional', valor: 'Não configurado' }],
      };
    }

    return {
      titulo: 'Confirmar o bônus regional',
      aviso: 'Estes dados serão gravados como o bônus regional deste processo.',
      rotuloDeConfirmar: 'Gravar bônus',
      itens: [
        { rotulo: 'Regra', valor: bonus.regraCodigo },
        { rotulo: 'Fator', valor: bonus.fator },
        { rotulo: 'Teto', valor: bonus.teto === '' ? 'sem teto' : bonus.teto },
        {
          rotulo: 'Município do convênio',
          valor: bonus.municipioConvenio === '' ? 'não informado' : bonus.municipioConvenio,
        },
        { rotulo: 'Base legal', valor: bonus.baseLegal === '' ? 'não informada' : bonus.baseLegal },
      ],
    };
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const bonus = this.store.draft().bonus;
    if (!bonus.ativo) return { valid: true };

    const messages: string[] = [];

    if (!bonus.regraCodigo) messages.push('Selecione a regra do bônus.');

    const fator = decimal(bonus.fator);
    if (fator === null || fator <= 0) messages.push('Informe o fator do bônus, maior que zero.');

    if (bonus.teto.trim() !== '') {
      const teto = decimal(bonus.teto);
      if (teto === null || teto <= 0) {
        messages.push('O teto do bônus, quando informado, deve ser maior que zero.');
      }
    }

    if (bonus.municipioConvenio.length > MUNICIPIO_CONVENIO_MAX_LENGTH) {
      messages.push(
        `Município do convênio deve ter no máximo ${MUNICIPIO_CONVENIO_MAX_LENGTH} caracteres.`,
      );
    }

    if (bonus.baseLegal.length > BASE_LEGAL_MAX_LENGTH) {
      messages.push(`Base legal deve ter no máximo ${BASE_LEGAL_MAX_LENGTH} caracteres.`);
    }

    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /** Grava o bônus regional — ativo ou não, o passo sempre grava (CA-04). */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de configurar o bônus.'],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const resultado = await this.cadastro.definirBonusRegional(
        processoId,
        comoComandoDeBonus(this.store.draft().bonus),
      );

      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };

      if (!resultado.ok) {
        return { valid: false, messages: [this.problemI18n.resolve(resultado.problem).title] };
      }

      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }
}

function decimal(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : null;
}
