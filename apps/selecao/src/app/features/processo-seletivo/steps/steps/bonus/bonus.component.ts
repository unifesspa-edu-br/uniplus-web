import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService, coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import {
  BaseLegalBonusRegionalApi,
  BaseLegalBonusRegionalDto,
} from '@uniplus/shared-data/configuracao';

import { StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { regrasEscolhiveis } from '../classificacao/regra-escolhivel';
import { comoComandoDeBonus } from './bonus-para-comando';

/** O que o `<select>` de base legal exibe — o mesmo par que `RegraEscolhivel` usa. */
interface BaseLegalEscolhivel {
  readonly id: string;
  readonly identificacao: string;
  readonly municipios: readonly MunicipioBeneficiado[];
}

/** Município de uma base legal — mesma forma tanto no catálogo quanto no snapshot congelado. */
interface MunicipioBeneficiado {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
}

/**
 * Bônus regional (`PUT …/bonus-regional`) — toggle por presença: não
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
  private readonly baseLegalApi = inject(BaseLegalBonusRegionalApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);

  private readonly basesLegais = signal<readonly BaseLegalBonusRegionalDto[]>([]);
  readonly basesLegaisCarregando = signal(true);
  readonly basesLegaisErro = signal<string | null>(null);

  constructor() {
    this.catalogos.carregar();
    this.carregarBasesLegais();
  }

  readonly regrasBonus = computed(() => {
    const bonus = this.store.draft().bonus;
    return regrasEscolhiveis(this.catalogos.regrasBonus(), bonus.regraCodigo, bonus.regraVersao);
  });

  /**
   * O catálogo ativo mais, quando faltar, a base legal que o processo já tem
   * gravada — reabrir um processo cuja base legal foi desativada depois não
   * pode mostrar o `<select>` em branco (CA-03, mesmo princípio de
   * `regrasEscolhiveis`). O snapshot do próprio processo carrega
   * `identificacao` mesmo quando a base legal já saiu do catálogo.
   */
  readonly basesLegaisEscolhiveis = computed<readonly BaseLegalEscolhivel[]>(() => {
    const catalogo = this.basesLegais().map((base) => ({
      id: base.id,
      identificacao: base.identificacao,
      municipios: base.municipios,
    }));
    const selecionadoId = this.store.draft().bonus.baseLegalBonusRegionalId;
    if (selecionadoId === '' || catalogo.some((base) => base.id === selecionadoId)) {
      return catalogo;
    }

    const snapshot = this.store.remoteSnapshot()?.bonusRegional;
    if (
      snapshot === null ||
      snapshot === undefined ||
      snapshot.baseLegalBonusRegionalId !== selecionadoId
    ) {
      return catalogo;
    }

    return [
      {
        id: snapshot.baseLegalBonusRegionalId,
        identificacao: snapshot.identificacao,
        municipios: snapshot.municipios,
      },
      ...catalogo,
    ];
  });

  /**
   * Municípios da base legal escolhida, ordenados por nome — o mesmo catálogo/snapshot
   * de `basesLegaisEscolhiveis`, então uma base fora do catálogo (CA-03) continua
   * mostrando os municípios do congelamento. Exibida junto ao select para o gestor
   * confirmar visualmente a cobertura sem precisar abrir o cadastro em outra aba.
   */
  readonly municipiosDaBaseLegalSelecionada = computed<readonly MunicipioBeneficiado[]>(() => {
    const selecionadoId = this.store.draft().bonus.baseLegalBonusRegionalId;
    if (selecionadoId === '') return [];

    const base = this.basesLegaisEscolhiveis().find((b) => b.id === selecionadoId);
    if (base === undefined) return [];

    return [...base.municipios].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });

  escolherRegra(valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');
    this.store.patchObjectSection('bonus', { regraCodigo: codigo, regraVersao: versao });
  }

  escolherBaseLegal(id: string): void {
    this.store.patchObjectSection('bonus', { baseLegalBonusRegionalId: id });
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

    const baseLegal = this.basesLegaisEscolhiveis().find(
      (base) => base.id === bonus.baseLegalBonusRegionalId,
    );

    return {
      titulo: 'Confirmar o bônus regional',
      aviso: 'Estes dados serão gravados como o bônus regional deste processo.',
      rotuloDeConfirmar: 'Gravar bônus',
      itens: [
        { rotulo: 'Regra', valor: bonus.regraCodigo },
        { rotulo: 'Fator', valor: bonus.fator },
        { rotulo: 'Teto', valor: bonus.teto === '' ? 'sem teto' : bonus.teto },
        { rotulo: 'Base legal', valor: baseLegal?.identificacao ?? 'não selecionada' },
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

    if (!bonus.baseLegalBonusRegionalId) {
      messages.push('Selecione a base legal do bônus regional.');
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

  protected carregarBasesLegais(): void {
    this.basesLegaisCarregando.set(true);
    this.basesLegaisErro.set(null);

    coletarPaginas((cursor) => this.baseLegalApi.listar({ cursor, direction: 'next' }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (!isApiOk(resultado)) {
          this.basesLegaisErro.set(
            'Não foi possível carregar as bases legais de bônus regional. Tente novamente.',
          );
          this.basesLegaisCarregando.set(false);
          return;
        }
        this.basesLegais.set(resultado.data);
        this.basesLegaisCarregando.set(false);
      });
  }
}

function decimal(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : null;
}
