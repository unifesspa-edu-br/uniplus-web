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
  formularioDaInscricaoRequest,
} from '@uniplus/shared-data/selecao';
import {
  type MunicipiosGravados,
  type MunicipiosSeparados,
  type SimulacaoDoFormulario,
  type ValorJson,
  separarMunicipiosGravados,
} from '@uniplus/shared-inscricao/formulario';
import { LEITURA_DE_MUNICIPIO_POR_CODIGO, NomesDeMunicipios } from '@uniplus/shared-ui/components';

import {
  escolhaInicialDeOfertas,
  numeroDeOpcoesDeCurso,
  type OfertaDaInscricao,
  ofertasDaInscricao,
} from '../oferta-da-inscricao';
import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';
import { respostasIniciaisDoNomeSocial } from './respostas-da-conta';

/** A inscrição e o formulário como chegaram do servidor ao abrir a página, e o que se tira deles. */
export interface InscricaoCarregada {
  readonly inscricao: InscricaoDto;
  readonly formulario: FormularioApresentadoDoProcessoDto;
  /** As ofertas da versão em que está a inscrição, não as do certame ao vivo. */
  readonly ofertas: readonly OfertaDaInscricao[];
  /** Quantas opções de curso a versão da inscrição admite. */
  readonly numeroDeOpcoes: 1 | 2;
  /** A partida do formulário: as respostas e as ocorrências como chegaram. */
  readonly inicial: SimulacaoDoFormulario;
  /** O nome que a inscrição enviada guardou de cada município, para o campo e a revisão o mostrarem. */
  readonly municipiosGravados: MunicipiosGravados;
  readonly termosAceitos: readonly string[];
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
      const formulario = this.formularioLido.data();
      if (iniciada && formulario) {
        untracked(() => this.montarCarga(iniciada, formulario));
      }
    });
  }

  readonly processoId = signal<string | null>(null);
  private readonly iniciada = signal<InscricaoIniciada | null>(null);
  private readonly falhaDaLeitura = signal<string | null>(null);
  /** O formulário só é pedido depois de a inscrição ser iniciada: a versão que vale é a dela. */
  private readonly formularioLido = useApiResource<FormularioApresentadoDoProcessoDto>(() => {
    const iniciada = this.iniciada();
    return iniciada ? formularioDaInscricaoRequest(this.basePath, iniciada.processoId) : undefined;
  });
  /** O que chegou na última leitura; só ela o troca, nunca uma gravação. */
  readonly carregada = signal<InscricaoCarregada | null>(null);
  readonly erroAoCarregar = computed(() => {
    const falha = this.falhaDaLeitura();
    if (falha !== null) return falha;
    const problema = this.formularioLido.problem();
    if (problema) return this.problemas.resolve(problema).title;
    const formulario = this.formularioLido;
    if (formulario.error() || (formulario.value()?.ok && !formulario.data())) {
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
  readonly formulario = computed(() => this.carregada()?.formulario ?? null);
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
    formulario: FormularioApresentadoDoProcessoDto,
  ): void {
    try {
      this.adotarCarga(iniciada, formulario);
    } catch {
      this.falhaDaLeitura.set(FALHA_AO_MONTAR_A_INSCRICAO);
      this.erros.handleError(new Error('Não foi possível montar a inscrição.'));
    }
  }

  private adotarCarga(
    { processoId, inscricao }: InscricaoIniciada,
    formulario: FormularioApresentadoDoProcessoDto,
  ): void {
    const municipios = this.respostasIniciais(inscricao, formulario);
    const carga = inscricaoCarregada(inscricao, formulario, municipios);
    this.nomes.carregar(municipios.semNome, this.lerMunicipio);
    this.iniciarAAvaliacao(processoId, carga);
    this.carregada.set(carga);
  }

  private iniciarAAvaliacao(processoId: string, carga: InscricaoCarregada): void {
    const { inscricao, formulario, ofertas, numeroDeOpcoes } = carga;
    const escolha = escolhaInicialDeOfertas(inscricao.escolhasDeCurso, ofertas, numeroDeOpcoes);
    this.avaliacao.iniciar({
      processoId,
      avaliacao: inscricao.avaliacao,
      dependencias: formulario.dependenciasDaAvaliacao,
      simulacao: carga.inicial,
      oferta: escolha.oferta,
      segundaOferta: escolha.segunda,
    });
  }

  private respostasIniciais(
    inscricao: InscricaoDto,
    formulario: FormularioApresentadoDoProcessoDto,
  ): MunicipiosSeparados {
    // As respostas chegam em JSON: são os valores que o formulário lê.
    const gravadas = inscricao.formulario.respostas as Readonly<Record<string, ValorJson>>;
    return separarMunicipiosGravados(formulario.formulario, {
      respostas: {
        ...respostasIniciaisDoNomeSocial(this.usuario.user(), gravadas, formulario),
        ...gravadas,
      },
      grupos: inscricao.formulario.grupos as NonNullable<SimulacaoDoFormulario['grupos']>,
    });
  }
}

function inscricaoCarregada(
  inscricao: InscricaoDto,
  formulario: FormularioApresentadoDoProcessoDto,
  municipios: MunicipiosSeparados,
): InscricaoCarregada {
  return {
    inscricao,
    formulario,
    ofertas: ofertasDaInscricao(inscricao.escolhasDeCurso),
    numeroDeOpcoes: numeroDeOpcoesDeCurso(inscricao.escolhasDeCurso.numeroDeOpcoesDeCurso),
    inicial: { respostas: municipios.respostas, grupos: municipios.grupos },
    municipiosGravados: municipios.gravados,
    termosAceitos: inscricao.formulario.aceites.map((a) => a.codigo),
  };
}
