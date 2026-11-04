import { DestroyRef, Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiFailure, ProblemI18nService } from '@uniplus/shared-core/http';
import type { FormularioRenderizavelDto, InscricaoDto } from '@uniplus/shared-data/selecao';
import {
  type MunicipiosGravados,
  LEITURA_DE_MUNICIPIO_POR_CODIGO,
  NomesDeMunicipios,
  type SimulacaoDoFormulario,
  type ValorJson,
  separarMunicipiosGravados,
} from '@uniplus/shared-ui/components';

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
  readonly formulario: FormularioRenderizavelDto;
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

type EstadoDaLeitura = 'carregando' | 'erro' | 'pronto';

/**
 * A inscrição do candidato como o servidor a tem: a lida ao abrir a página e a última salva, enviada
 * ou relida. Inicia a inscrição e lê o formulário da versão dela e as ofertas do processo. Quem grava
 * a adota por `adotar` e `adotarETag`; só a leitura troca a inscrição por inteira. Provida pela página.
 */
@Injectable()
export class LeituraDaInscricao {
  private readonly servico = inject(InscricaoDoCandidatoService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly usuario = inject(UserContextService);
  private readonly avaliacao = inject(AvaliacaoDaInscricaoEstado);
  private readonly nomes = inject(NomesDeMunicipios);
  private readonly lerMunicipio = inject(LEITURA_DE_MUNICIPIO_POR_CODIGO);
  private leituraEmCurso: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.leituraEmCurso?.unsubscribe());
  }

  readonly processoId = signal<string | null>(null);
  readonly estado = signal<EstadoDaLeitura>('carregando');
  readonly erroAoCarregar = signal<string | null>(null);
  /** O que chegou na última leitura; só ela o troca, nunca uma gravação. */
  readonly carregada = signal<InscricaoCarregada | null>(null);
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
    this.estado.set('carregando');
    this.leituraEmCurso?.unsubscribe();
    this.leituraEmCurso = this.servico.iniciar(processoId).subscribe((inscricao) => {
      if (!inscricao.ok) return this.falhar(inscricao);
      this.leituraEmCurso = this.servico.obterFormulario(processoId).subscribe((formulario) => {
        if (!formulario.ok) return this.falhar(formulario);
        this.adotarCarga(processoId, inscricao.data, formulario.data);
      });
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

  private falhar(falha: ApiFailure): void {
    this.erroAoCarregar.set(this.problemas.resolve(falha.problem).title);
    this.estado.set('erro');
  }

  private adotarCarga(
    processoId: string,
    inscricao: InscricaoDto,
    formulario: FormularioRenderizavelDto,
  ): void {
    const municipios = this.respostasIniciais(inscricao, formulario);
    const carga: InscricaoCarregada = {
      inscricao,
      formulario,
      ofertas: ofertasDaInscricao(inscricao),
      numeroDeOpcoes: numeroDeOpcoesDeCurso(inscricao.numeroDeOpcoesDeCurso),
      inicial: { respostas: municipios.respostas, grupos: municipios.grupos },
      municipiosGravados: municipios.gravados,
      termosAceitos: inscricao.aceites.map((a) => a.codigo),
    };
    this.nomes.carregar(municipios.semNome, this.lerMunicipio);
    this.iniciarAAvaliacao(processoId, carga);
    this.carregada.set(carga);
    this.estado.set('pronto');
  }

  private iniciarAAvaliacao(processoId: string, carga: InscricaoCarregada): void {
    const { inscricao, formulario } = carga;
    const escolha = escolhaInicialDeOfertas(inscricao, carga.ofertas, carga.numeroDeOpcoes);
    this.avaliacao.iniciar(
      processoId,
      inscricao.avaliacao,
      formulario.dependenciasDaAvaliacao,
      carga.inicial,
      escolha.oferta,
      escolha.segunda,
    );
  }

  private respostasIniciais(
    inscricao: InscricaoDto,
    formulario: FormularioRenderizavelDto,
  ): ReturnType<typeof separarMunicipiosGravados> {
    // As respostas chegam em JSON: são os valores que o formulário lê.
    const gravadas = inscricao.respostas as Readonly<Record<string, ValorJson>>;
    return separarMunicipiosGravados(formulario, {
      respostas: {
        ...respostasIniciaisDoNomeSocial(this.usuario.user(), gravadas, formulario),
        ...gravadas,
      },
      grupos: inscricao.grupos as NonNullable<SimulacaoDoFormulario['grupos']>,
    });
  }
}
