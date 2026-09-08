import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProblemI18nService } from '@uniplus/shared-core/http';

import {
  EtapaPontuada,
  RegraEliminacaoConfigurada,
  StepValidation,
} from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import {
  classificacaoUsaFormulaLocal,
  comoComandoDeClassificacao,
  divisorDaMediaValido,
  eliminacaoExigeBaseadoEmEnem,
  eliminacaoUsaEtapaENotaMinima,
  eliminacaoUsaMinimo,
  mensagensDeClassificacaoBase,
} from '../classificacao/classificacao-para-comando';
import { regrasEscolhiveis } from '../classificacao/regra-escolhivel';

const REGRA_ELIMINACAO_VAZIA: RegraEliminacaoConfigurada = {
  regraCodigo: '',
  regraVersao: '',
  etapaRef: '',
  notaMinima: '',
  minimo: '',
};

/**
 * Regras de eliminação — a coleção que fecha o corpo de `PUT
 * …/classificacao` (UNI-REQ-0482). Eliminação não é dimensão própria da API:
 * é parte do payload de classificação, e por isso este é o passo que grava
 * o comando inteiro — regra de cálculo e precisão vêm do passo Fórmula, que
 * não persiste nada por conta própria.
 *
 * Sob `CLASSIFICACAO-IMPORTADA` (INV-B8), esta seção não se aplica: a lista
 * de regras é ignorada na gravação (o mapeador força `[]`), e a tela não
 * oferece edição.
 */
@Component({
  selector: 'sel-step-eliminacao',
  standalone: true,
  templateUrl: './eliminacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(EliminacaoStepComponent)],
})
export class EliminacaoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);

  constructor() {
    this.catalogos.carregar();
  }

  readonly usaFormulaLocal = computed(() =>
    classificacaoUsaFormulaLocal(this.store.draft().classificacao.regraCalculoCodigo),
  );

  readonly regras = computed(() => this.store.draft().classificacao.regrasEliminacao);

  /** Só etapas já persistidas (com `id`) podem ser referenciadas por `etapaRef`. */
  readonly etapasReferenciaveis = computed(() =>
    this.store
      .draft()
      .cronograma.etapas.filter(
        (etapa): etapa is EtapaPontuada & { id: string } => etapa.id !== null,
      ),
  );

  readonly regrasDoCatalogo = computed(() => this.catalogos.regrasEliminacao());

  regraEscolhivel(regra: RegraEliminacaoConfigurada) {
    return regrasEscolhiveis(this.regrasDoCatalogo(), regra.regraCodigo, regra.regraVersao);
  }

  usaEtapaENotaMinima(regra: RegraEliminacaoConfigurada): boolean {
    return eliminacaoUsaEtapaENotaMinima(regra.regraCodigo);
  }

  usaMinimo(regra: RegraEliminacaoConfigurada): boolean {
    return eliminacaoUsaMinimo(regra.regraCodigo);
  }

  rotuloDaEtapa(etapaId: string): string {
    const etapa = this.store.draft().cronograma.etapas.find((item) => item.id === etapaId);
    return etapa === undefined ? 'Etapa removida do cronograma' : etapa.nome || 'Etapa sem nome';
  }

  /** O divisor da média fica zero sem etapa que componha a nota (item `classificacao_divisor_media_invalido`). */
  readonly divisorInvalido = computed(
    () => this.usaFormulaLocal() && !divisorDaMediaValido(this.store.draft().cronograma.etapas),
  );

  acrescentarRegra(): void {
    this.store.patchObjectSection('classificacao', {
      regrasEliminacao: [...this.regras(), REGRA_ELIMINACAO_VAZIA],
    });
  }

  removerRegra(indice: number): void {
    this.store.patchObjectSection('classificacao', {
      regrasEliminacao: this.regras().filter((_, item) => item !== indice),
    });
  }

  escolherRegra(indice: number, valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');
    this.atualizarRegra(indice, {
      regraCodigo: codigo,
      regraVersao: versao,
      // Trocar de regra some com o que não se aplica mais ao shape novo — o
      // operador não vê um campo preenchido que a regra escolhida ignora.
      etapaRef: '',
      notaMinima: '',
      minimo: '',
    });
  }

  alterarEtapaRef(indice: number, etapaRef: string): void {
    this.atualizarRegra(indice, { etapaRef });
  }

  alterarNotaMinima(indice: number, notaMinima: string): void {
    this.atualizarRegra(indice, { notaMinima });
  }

  alterarMinimo(indice: number, minimo: string): void {
    this.atualizarRegra(indice, { minimo });
  }

  private atualizarRegra(indice: number, patch: Partial<RegraEliminacaoConfigurada>): void {
    this.store.patchObjectSection('classificacao', {
      regrasEliminacao: this.regras().map((regra, item) =>
        item === indice ? { ...regra, ...patch } : regra,
      ),
    });
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validate().valid) return null;

    const classificacao = this.store.draft().classificacao;
    const local = this.usaFormulaLocal();

    return {
      titulo: 'Confirmar a classificação do processo',
      aviso: 'A classificação, a precisão e a eliminação serão gravadas juntas nesta confirmação.',
      rotuloDeConfirmar: 'Gravar classificação',
      itens: [
        { rotulo: 'Regra de cálculo', valor: classificacao.regraCalculoCodigo },
        {
          rotulo: 'Arredondamento',
          valor: local
            ? `${classificacao.regraArredondamentoCodigo} — ${classificacao.casasArredondamento} casas`
            : 'não se aplica (classificação importada)',
        },
        { rotulo: 'Ordem de alocação', valor: classificacao.regraOrdemAlocacaoCodigo },
        { rotulo: 'Número de opções de curso', valor: classificacao.nOpcoesAlocacao },
        { rotulo: 'Baseada em ENEM', valor: classificacao.baseadoEmEnem ? 'Sim' : 'Não' },
        {
          rotulo: 'Regras de eliminação',
          valor: local
            ? `${classificacao.regrasEliminacao.length} regra(s)`
            : 'nenhuma (classificação importada)',
        },
      ],
    };
  }

  /**
   * Validação declarativa — acionada pela page ao clicar em "Próximo" e antes
   * de gravar. Inclui os campos que o passo Fórmula coleta
   * (`mensagensDeClassificacaoBase`): a navegação do wizard é livre, e este
   * passo grava o comando de classificação inteiro — não só a eliminação —
   * então não pode supor que o operador passou pela Fórmula antes de chegar
   * aqui.
   */
  validate(): StepValidation {
    const classificacao = this.store.draft().classificacao;
    const messages: string[] = [...mensagensDeClassificacaoBase(classificacao)];

    if (!this.usaFormulaLocal()) {
      // CLASSIFICACAO-IMPORTADA (ou regra ainda não escolhida) não usa
      // eliminação local — nada além da base acima a validar aqui.
      return messages.length ? { valid: false, messages } : { valid: true };
    }

    if (this.divisorInvalido()) {
      messages.push(
        'Nenhuma etapa do Cronograma compõe a nota. Volte ao Cronograma e declare ao menos uma etapa classificatória (ou ambas) com peso maior que zero.',
      );
    }

    const idsDeEtapa = new Set(this.etapasReferenciaveis().map((etapa) => etapa.id));

    this.regras().forEach((regra, indice) => {
      const posicao = indice + 1;
      if (!regra.regraCodigo) {
        messages.push(`Regra de eliminação ${posicao}: selecione uma regra.`);
        return;
      }

      if (this.usaEtapaENotaMinima(regra)) {
        if (regra.etapaRef === '') {
          messages.push(`Regra de eliminação ${posicao}: selecione a etapa referenciada.`);
        } else if (!idsDeEtapa.has(regra.etapaRef)) {
          messages.push(
            `Regra de eliminação ${posicao}: a etapa referenciada não existe mais no cronograma.`,
          );
        }
        if (!decimalValido(regra.notaMinima)) {
          messages.push(`Regra de eliminação ${posicao}: informe a nota mínima.`);
        }
      } else if (this.usaMinimo(regra)) {
        if (!decimalValido(regra.minimo)) {
          messages.push(`Regra de eliminação ${posicao}: informe o mínimo exigido.`);
        }
      }

      if (eliminacaoExigeBaseadoEmEnem(regra.regraCodigo) && !classificacao.baseadoEmEnem) {
        messages.push(
          `Regra de eliminação ${posicao}: só se aplica quando a classificação está marcada como baseada em ENEM (passo Fórmula).`,
        );
      }
    });

    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /**
   * Grava a classificação inteira — regra de cálculo, precisão, ordem de
   * alocação e o vetor de eliminação — num comando só. É o único `persistir()`
   * das duas telas: gravar também no Fórmula enviaria `regrasEliminacao`
   * vazio antes da hora e derrubaria o item de conformidade que esta gravação
   * levanta.
   */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          'O cadastro do processo precisa estar concluído antes de configurar a classificação.',
        ],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const resultado = await this.cadastro.definirClassificacao(
        processoId,
        comoComandoDeClassificacao(this.store.draft().classificacao),
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

function decimalValido(texto: string): boolean {
  const limpo = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpo);
}
