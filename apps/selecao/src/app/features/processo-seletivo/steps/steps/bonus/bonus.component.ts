import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService, coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import {
  BaseLegalBonusRegionalApi,
  BaseLegalBonusRegionalDto,
  TiposInstrumentoNormativoApi,
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
  /**
   * O que a norma é e o que ela diz. Sem os dois, escolher entre duas portarias de
   * identificação parecida é adivinhar — e é a norma que sustenta o bônus. Vêm do cadastro, e
   * também do snapshot congelado no processo, que guarda os dois.
   *
   * `tipoInstrumento` é o código canônico do vocabulário fechado, não o rótulo: quem traduz é
   * o próprio vocabulário, servido pela API.
   */
  readonly tipoInstrumento: string;
  readonly descricao: string;
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

  private readonly municipiosScrollRef =
    viewChild<ElementRef<HTMLDivElement>>('municipiosScroll');
  protected readonly municipiosRolavel = signal(false);

  constructor() {
    this.catalogos.carregar();
    this.carregarBasesLegais();

    this.carregarTiposDeInstrumento();

    afterRenderEffect(() => {
      // Lido aqui só para a leitura virar dependência do efeito: a lista de
      // municípios muda de tamanho (conteúdo da tabela) sem que o breakpoint
      // mude, e a caixa precisa ser remedida quando isso acontece.
      this.municipiosDaBaseLegalSelecionada();
      this.medirRolagemDosMunicipios();
    });

    if (typeof window !== 'undefined') {
      const remedir = (): void => this.medirRolagemDosMunicipios();
      window.addEventListener('resize', remedir);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', remedir));
    }
  }

  /**
   * `tabindex`/`role`/`aria-labelledby` só fazem sentido quando a tabela de
   * fato transborda a caixa — decidir só pelo breakpoint (768px) marcava
   * como focável até uma base legal com poucos municípios, que nunca chega a
   * rolar mesmo em telas largas. Medido de novo a cada mudança de conteúdo e
   * a cada redimensionamento da janela (o CSS que remove `max-height` abaixo
   * de 768px já faz `scrollHeight` bater com `clientHeight` sozinho, sem
   * precisar duplicar o valor do breakpoint aqui).
   */
  private medirRolagemDosMunicipios(): void {
    const elemento = this.municipiosScrollRef()?.nativeElement;
    this.municipiosRolavel.set(elemento !== undefined && elemento.scrollHeight > elemento.clientHeight);
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
      tipoInstrumento: base.tipoInstrumento,
      descricao: base.descricao,
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
        // O snapshot congela os quatro campos, não só dois — e é exatamente quando a norma
        // saiu do cadastro que o tipo e a descrição fazem falta para reconhecê-la.
        tipoInstrumento: snapshot.tipoInstrumento,
        descricao: snapshot.descricao,
        municipios: snapshot.municipios,
      },
      ...catalogo,
    ];
  });

  private readonly tiposInstrumentoApi = inject(TiposInstrumentoNormativoApi);

  /**
   * Os rótulos dos tipos de instrumento normativo, indexados pelo código.
   *
   * O código é UPPER_SNAKE — `INSTRUCAO_NORMATIVA` —, e exibi-lo cru numa tela em português
   * mostra a grafia da máquina a quem monta o edital. A lista não se escreve aqui: é
   * vocabulário fechado derivado de enum no servidor, e é ele quem publica o rótulo.
   */
  private readonly rotuloDoTipoInstrumento = signal<ReadonlyMap<string, string>>(new Map());

  /**
   * Se o vocabulário não pôde ser carregado.
   *
   * Engolir a falha deixaria o código da máquina — `INSTRUCAO_NORMATIVA` — permanente na tela,
   * sem nada dizendo que algo falhou nem como tentar de novo. É a mesma conduta do
   * carregamento das bases legais, ao lado.
   */
  readonly tiposInstrumentoErro = signal<string | null>(null);

  /** Se o vocabulário está sendo buscado — trava o botão e evita duas chamadas concorrentes. */
  readonly tiposInstrumentoCarregando = signal(false);

  carregarTiposDeInstrumento(): void {
    if (this.tiposInstrumentoCarregando()) return;

    this.tiposInstrumentoErro.set(null);
    this.tiposInstrumentoCarregando.set(true);

    this.tiposInstrumentoApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.tiposInstrumentoCarregando.set(false);
          if (isApiOk(resultado)) {
            this.rotuloDoTipoInstrumento.set(
              new Map(resultado.data.map((tipo) => [tipo.codigo, tipo.nome])),
            );
            return;
          }
          this.tiposInstrumentoErro.set(this.problemI18n.resolve(resultado.problem).title);
        },
        error: () => {
          this.tiposInstrumentoCarregando.set(false);
          this.tiposInstrumentoErro.set(
            'Não foi possível carregar como se lê o tipo de cada norma.',
          );
        },
      });
  }

  /** O tipo da norma como se lê, ou o código quando o vocabulário ainda não chegou. */
  rotuloDoTipo(codigo: string): string {
    if (codigo === '') return '';
    return this.rotuloDoTipoInstrumento().get(codigo) ?? codigo;
  }

  /** O que a norma escolhida diz. */
  readonly descricaoDaBaseLegal = computed<string>(() => {
    const escolhida = this.store.draft().bonus.baseLegalBonusRegionalId;
    const base = this.basesLegaisEscolhiveis().find((item) => item.id === escolhida);
    return base?.descricao ?? '';
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
    if (fator === null || fator <= 0) {
      messages.push('Informe o fator do bônus, maior que zero.');
    } else {
      messages.push(...foraDaPrecisao(bonus.fator, 'O fator do bônus'));
    }

    if (bonus.teto.trim() !== '') {
      const teto = decimal(bonus.teto);
      if (teto === null || teto <= 0) {
        messages.push('O teto do bônus, quando informado, deve ser maior que zero.');
      } else {
        messages.push(...foraDaPrecisao(bonus.teto, 'O teto do bônus'));
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

/**
 * O registro guarda fator e teto com dois dígitos inteiros e quatro decimais — teto efetivo de
 * 99,9999. Não é limite arbitrário da tela: é a precisão da coluna, e o servidor recusa o que
 * passa dela.
 *
 * Num certame cuja nota final é em base 100 ou 1000, "teto de 100 pontos" é o primeiro valor
 * que quem monta o edital escreve — e era o que voltava recusado sem que o campo dissesse
 * qualquer coisa sobre faixa.
 */
const DIGITOS_INTEIROS = 2;
const CASAS_DECIMAIS = 4;

function foraDaPrecisao(valor: string, rotulo: string): readonly string[] {
  const [inteira = '', decimal = ''] = valor.trim().replace('-', '').replace(',', '.').split('.');
  const problemas: string[] = [];

  if (inteira.replace(/^0+(?=\d)/, '').length > DIGITOS_INTEIROS) {
    problemas.push(`${rotulo} não pode passar de 99,9999 — é a precisão com que ele é guardado.`);
  }
  if (decimal.length > CASAS_DECIMAIS) {
    problemas.push(`${rotulo} aceita no máximo ${CASAS_DECIMAIS} casas decimais.`);
  }

  return problemas;
}
