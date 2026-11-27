import {
  DestroyRef,
  ErrorHandler,
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import type { Subscription } from 'rxjs';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { ProblemI18nService, useApiResource } from '@uniplus/shared-core/http';
import {
  type FormularioApresentadoDoProcessoDto,
  type InscricaoDto,
  SELECAO_BASE_PATH,
  formulariosDaInscricaoRequest,
} from '@uniplus/shared-data/selecao';
import type { SimulacaoDoFormulario } from '@uniplus/shared-inscricao/formulario';
import { LEITURA_DE_MUNICIPIO_POR_CODIGO, NomesDeMunicipios } from '@uniplus/shared-ui/components';

import {
  escolhaInicialDeOfertas,
  numeroDeOpcoesDeCurso,
  type OfertaDaInscricao,
  ofertasDaInscricao,
} from '../oferta-da-inscricao';
import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';
import {
  type FormularioCarregado,
  dependenciasDaInscricao,
  formularioCarregado,
  inicialDaInscricao,
} from './formularios-da-inscricao';

/** A inscrição e o formulário como chegaram do servidor ao abrir a página, e o que se tira deles. */
export interface InscricaoCarregada {
  readonly inscricao: InscricaoDto;
  /** Os formulários obrigatórios da fase, na ordem em que a API os entrega. */
  readonly formularios: readonly FormularioCarregado[];
  /** As ofertas da versão em que está a inscrição, não as do certame ao vivo. */
  readonly ofertas: readonly OfertaDaInscricao[];
  /** Quantas opções de curso a versão da inscrição admite. */
  readonly numeroDeOpcoes: 1 | 2;
  /** A partida da avaliação: as respostas e as ocorrências de todos os formulários, como chegaram. */
  readonly inicial: SimulacaoDoFormulario;
}

/** Por que a página precisa ser recarregada, quando precisa. */
export type MotivoDoRecarregar = 'envio' | 'incerta';

/** Quando a inscrição e o formulário chegam, mas a tela não consegue montá-los. */
const FALHA_AO_MONTAR_A_INSCRICAO =
  'Não foi possível abrir a inscrição. Tente novamente ou recarregue a página.';

type EstadoDaLeitura = 'carregando' | 'erro' | 'pronto';

/** O que o início da inscrição devolveu: a inscrição, e o processo a que o formulário se refere. */
interface InscricaoIniciada {
  readonly processoId: string;
  readonly inscricao: InscricaoDto;
}

/**
 * A inscrição do candidato como o servidor a tem: a lida ao abrir a página e a última salva, enviada
 * ou relida. Inicia a inscrição (POST) e, só depois dele, lê o formulário da versão dela (GET,
 * `useApiResource`, ADR-0018) e as ofertas do processo. Uma nova leitura cancela a anterior: o início
 * pendente é descartado e o GET do formulário é cancelado pelo próprio recurso. Quem grava adota a
 * inscrição por `adotar` e `adotarETag`; só a leitura a troca por inteira. Provida pela página.
 */
@Injectable()
export class LeituraDaInscricao {
  private readonly servico = inject(InscricaoDoCandidatoService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly usuario = inject(UserContextService);
  private readonly avaliacao = inject(AvaliacaoDaInscricaoEstado);
  private readonly nomes = inject(NomesDeMunicipios);
  private readonly lerMunicipio = inject(LEITURA_DE_MUNICIPIO_POR_CODIGO);
  private readonly basePath = inject(SELECAO_BASE_PATH);
  private readonly erros = inject(ErrorHandler);
  private inicioEmCurso: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.inicioEmCurso?.unsubscribe());
    effect(() => {
      const iniciada = this.iniciada();
      const formularios = this.formularioLido.data();
      if (iniciada && formularios && formularios.length > 0) {
        untracked(() => this.montarCarga(iniciada, formularios));
      }
    });
  }

  readonly processoId = signal<string | null>(null);
  private readonly iniciada = signal<InscricaoIniciada | null>(null);
  private readonly falhaDaLeitura = signal<string | null>(null);
  /** Os formulários só são pedidos depois de a inscrição ser iniciada: a versão que vale é a dela. */
  private readonly formularioLido = useApiResource<readonly FormularioApresentadoDoProcessoDto[]>(
    () => {
      const iniciada = this.iniciada();
      return iniciada
        ? formulariosDaInscricaoRequest(this.basePath, iniciada.processoId)
        : undefined;
    },
  );
  /** O que chegou na última leitura; só ela o troca, nunca uma gravação. */
  readonly carregada = signal<InscricaoCarregada | null>(null);
  readonly erroAoCarregar = computed(() => {
    const falha = this.falhaDaLeitura();
    if (falha !== null) return falha;
    const problema = this.formularioLido.problem();
    if (problema) return this.problemas.resolve(problema).title;
    const formulario = this.formularioLido;
    if (formulario.error() || (formulario.value()?.ok && !formulario.data()?.length)) {
      return FALHA_AO_MONTAR_A_INSCRICAO;
    }
    return null;
  });
  readonly estado = computed<EstadoDaLeitura>(() => {
    if (this.erroAoCarregar() !== null) return 'erro';
    return this.carregada() === null ? 'carregando' : 'pronto';
  });
  private readonly atual = linkedSignal<InscricaoDto | null>(
    () => this.carregada()?.inscricao ?? null,
  );
  readonly inscricao = this.atual.asReadonly();
  readonly formularios = computed(() => this.carregada()?.formularios ?? []);
  /**
   * Por que a página precisa ser recarregada: `envio` — o envio deu certo, mas a releitura da inscrição
   * falhou; `incerta` — a gravação falhou sem resposta ou com erro do servidor e a releitura também
   * falhou, então não se sabe se ela aconteceu. Nos dois casos o ETag da tela é o velho e nada mais é
   * gravado a partir dela. Uma nova leitura o zera.
   */
  readonly motivoDoRecarregar = linkedSignal<MotivoDoRecarregar | null>(() => {
    this.carregada();
    return null;
  });
  readonly precisaRecarregar = computed(() => this.motivoDoRecarregar() !== null);

  /** Inicia a inscrição e, com ela, lê o formulário da versão da inscrição e as ofertas do processo. */
  carregar(processoId: string): void {
    this.processoId.set(processoId);
    this.inicioEmCurso?.unsubscribe();
    this.iniciada.set(null);
    this.carregada.set(null);
    this.falhaDaLeitura.set(null);
    this.inicioEmCurso = this.servico.iniciar(processoId).subscribe({
      next: (resultado) => {
        if (resultado.ok) this.iniciada.set({ processoId, inscricao: resultado.data });
        else this.falhaDaLeitura.set(this.problemas.resolve(resultado.problem).title);
      },
      error: () => this.falhaDaLeitura.set(FALHA_AO_MONTAR_A_INSCRICAO),
    });
  }

  /** Lê de novo a inscrição do mesmo processo, trocando tudo o que a tela tem dela. */
  recarregar(): void {
    const processoId = this.processoId();
    if (processoId !== null) this.carregar(processoId);
  }

  /** A inscrição que uma gravação ou releitura devolveu passa a ser a da tela. */
  adotar(inscricao: InscricaoDto): void {
    this.atual.set(inscricao);
  }

  /** Só a revisão avançou: a tela fica com as respostas dela e passa a gravar com o ETag novo. */
  adotarETag(eTag: string): void {
    this.atual.update((inscricao) => (inscricao ? { ...inscricao, eTag } : inscricao));
  }

  /** Uma resposta que a tela não sabe montar vira o erro da leitura, não um carregamento sem fim. */
  private montarCarga(
    iniciada: InscricaoIniciada,
    formularios: readonly FormularioApresentadoDoProcessoDto[],
  ): void {
    try {
      this.adotarCarga(iniciada, formularios);
    } catch {
      this.falhaDaLeitura.set(FALHA_AO_MONTAR_A_INSCRICAO);
      this.erros.handleError(new Error('Não foi possível montar a inscrição.'));
    }
  }

  private adotarCarga(
    { processoId, inscricao }: InscricaoIniciada,
    formularios: readonly FormularioApresentadoDoProcessoDto[],
  ): void {
    const conta = this.usuario.user();
    const carregados = formularios.map((f) => formularioCarregado(f, inscricao, conta));
    const carga = inscricaoCarregada(inscricao, carregados);
    this.nomes.carregar(
      carregados.flatMap((f) => f.municipiosSemNome),
      this.lerMunicipio,
    );
    this.iniciarAAvaliacao(processoId, carga);
    this.carregada.set(carga);
  }

  private iniciarAAvaliacao(processoId: string, carga: InscricaoCarregada): void {
    const { inscricao, formularios, ofertas, numeroDeOpcoes } = carga;
    const escolha = escolhaInicialDeOfertas(inscricao.escolhasDeCurso, ofertas, numeroDeOpcoes);
    this.avaliacao.iniciar({
      processoId,
      avaliacao: inscricao.avaliacao,
      dependencias: dependenciasDaInscricao(formularios.map((f) => f.formulario)),
      simulacao: carga.inicial,
      oferta: escolha.oferta,
      segundaOferta: escolha.segunda,
    });
  }
}

function inscricaoCarregada(
  inscricao: InscricaoDto,
  formularios: readonly FormularioCarregado[],
): InscricaoCarregada {
  return {
    inscricao,
    formularios,
    ofertas: ofertasDaInscricao(inscricao.escolhasDeCurso),
    numeroDeOpcoes: numeroDeOpcoesDeCurso(inscricao.escolhasDeCurso.numeroDeOpcoesDeCurso),
    inicial: inicialDaInscricao(formularios),
  };
}
