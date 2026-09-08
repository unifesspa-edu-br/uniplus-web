import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProblemI18nService } from '@uniplus/shared-core/http';

import { CriterioDesempateConfigurado, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { regrasEscolhiveis } from '../classificacao/regra-escolhivel';
import {
  comoComandoDeCriteriosDesempate,
  desempateUsaEtapa,
  desempateUsaIdadeMinima,
  desempateUsaPredicadoFato,
} from './desempate-para-comando';

const CRITERIO_VAZIO: CriterioDesempateConfigurado = {
  regraCodigo: '',
  regraVersao: '',
  etapaRef: '',
  idadeMinima: '',
  fato: '',
  operador: '',
  valor: '',
};

/**
 * Critérios de desempate (`PUT …/criterios-desempate`), na ordem em que serão
 * avaliados. A ordem é a posição na lista — reescrita a cada mover/remover —
 * e não um vocabulário institucional fixo: `CRITERIOS_DESEMPATE` com ids de 1
 * a 7 saiu inteiro, porque nenhum campo dele coincide com o contrato.
 */
@Component({
  selector: 'sel-step-desempate',
  standalone: true,
  templateUrl: './desempate.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(DesempateStepComponent)],
})
export class DesempateStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);

  constructor() {
    this.catalogos.carregar();
  }

  readonly criterios = computed(() => this.store.draft().desempate);

  readonly etapasReferenciaveis = computed(() =>
    this.store.draft().cronograma.etapas.filter((etapa) => etapa.id !== null),
  );

  regraEscolhivel(criterio: CriterioDesempateConfigurado) {
    return regrasEscolhiveis(
      this.catalogos.criteriosDesempate(),
      criterio.regraCodigo,
      criterio.regraVersao,
    );
  }

  usaEtapa(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaEtapa(criterio.regraCodigo);
  }

  usaIdadeMinima(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaIdadeMinima(criterio.regraCodigo);
  }

  usaPredicadoFato(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaPredicadoFato(criterio.regraCodigo);
  }

  acrescentar(): void {
    this.store.patchSection('desempate', [...this.criterios(), CRITERIO_VAZIO]);
  }

  remover(indice: number): void {
    this.store.patchSection(
      'desempate',
      this.criterios().filter((_, item) => item !== indice),
    );
  }

  mover(indice: number, delta: number): void {
    const ordem = [...this.criterios()];
    const destino = indice + delta;
    if (destino < 0 || destino >= ordem.length) return;
    [ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]];
    this.store.patchSection('desempate', ordem);
  }

  escolherRegra(indice: number, valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');
    // Trocar de regra some com o que a variante anterior usava — CA-05: só os
    // argumentos aplicáveis à regra atual permanecem.
    this.atualizar(indice, {
      regraCodigo: codigo,
      regraVersao: versao,
      etapaRef: '',
      idadeMinima: '',
      fato: '',
      operador: '',
      valor: '',
    });
  }

  alterarEtapaRef(indice: number, etapaRef: string): void {
    this.atualizar(indice, { etapaRef });
  }

  alterarIdadeMinima(indice: number, idadeMinima: string): void {
    this.atualizar(indice, { idadeMinima });
  }

  alterarFato(indice: number, fato: string): void {
    this.atualizar(indice, { fato });
  }

  alterarOperador(indice: number, operador: string): void {
    this.atualizar(indice, { operador });
  }

  alterarValor(indice: number, valor: string): void {
    this.atualizar(indice, { valor });
  }

  private atualizar(indice: number, patch: Partial<CriterioDesempateConfigurado>): void {
    this.store.patchSection(
      'desempate',
      this.criterios().map((criterio, item) =>
        item === indice ? { ...criterio, ...patch } : criterio,
      ),
    );
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validate().valid) return null;

    const criterios = this.criterios();
    if (criterios.length === 0) {
      return {
        titulo: 'Confirmar a ausência de critérios de desempate',
        aviso: 'Nenhum critério de desempate será declarado para este processo.',
        rotuloDeConfirmar: 'Confirmar sem critérios',
        itens: [{ rotulo: 'Critérios de desempate', valor: 'Nenhum' }],
      };
    }

    return {
      titulo: 'Confirmar os critérios de desempate',
      aviso: 'A ordem exibida é a ordem em que os critérios serão avaliados.',
      rotuloDeConfirmar: 'Gravar critérios',
      itens: criterios.map((criterio, indice) => ({
        rotulo: `${indice + 1}º critério`,
        valor: criterio.regraCodigo,
      })),
    };
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const idsDeEtapa = new Set(this.etapasReferenciaveis().map((etapa) => etapa.id));
    const messages: string[] = [];

    this.criterios().forEach((criterio, indice) => {
      const posicao = indice + 1;
      if (!criterio.regraCodigo) {
        messages.push(`Critério de desempate ${posicao}: selecione uma regra.`);
        return;
      }

      if (this.usaEtapa(criterio)) {
        if (criterio.etapaRef === '') {
          messages.push(`Critério de desempate ${posicao}: selecione a etapa referenciada.`);
        } else if (!idsDeEtapa.has(criterio.etapaRef)) {
          messages.push(
            `Critério de desempate ${posicao}: a etapa referenciada não existe mais no cronograma.`,
          );
        }
      } else if (this.usaIdadeMinima(criterio)) {
        const idade = inteiro(criterio.idadeMinima);
        if (idade === null || idade <= 0) {
          messages.push(
            `Critério de desempate ${posicao}: informe a idade mínima, maior que zero.`,
          );
        }
      } else if (this.usaPredicadoFato(criterio)) {
        if (!criterio.fato.trim() || !criterio.operador.trim() || !criterio.valor.trim()) {
          messages.push(
            `Critério de desempate ${posicao}: informe fato, operador e valor do predicado.`,
          );
        }
      }
    });

    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /** Grava a coleção inteira, na ordem em que está na tela (CA-05). */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          'O cadastro do processo precisa estar concluído antes de configurar o desempate.',
        ],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const resultado = await this.cadastro.definirCriteriosDesempate(
        processoId,
        comoComandoDeCriteriosDesempate(this.criterios()),
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

function inteiro(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : null;
}
