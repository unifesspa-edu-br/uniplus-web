import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import type { AvaliacaoNaTela, PassoPrefixado } from '@uniplus/shared-ui/components';

import { escolhaInicialDeOfertas } from '../oferta-da-inscricao';
import { AnuncioDaInscricao } from './anuncio-da-inscricao';
import type { OfertasEscolhidas } from './corpo-da-inscricao';
import { LeituraDaInscricao } from './leitura-da-inscricao';
import {
  mensagemDaRecusa,
  RECUSAS_DA_SEGUNDA_QUE_VEM_DA_PRIMEIRA,
  type RecusaDaSegundaOpcao,
} from './recusas-da-inscricao';

/** A chave do passo em que o candidato escolhe o curso, quando o processo oferece mais de um. */
export const PASSO_DO_CURSO = 'curso';

/** Quais opções recusadas a tela levou ao campo, e o texto das que ficaram sem campo para apontar. */
export interface RecusasMostradas {
  /** A recusa que não tem campo na tela: sai como recusa geral. */
  readonly textoGeral: string | null;
  /** Quantas recusas de oferta a tela mostrou. */
  readonly mostradas: number;
}

interface DadosDoPasso {
  readonly primeira: string | null;
  readonly segunda: string | null;
  readonly comSegundaOpcao: boolean;
  readonly comErro: boolean;
}

function passoDoCurso(dados: DadosDoPasso): PassoPrefixado {
  const { primeira, segunda, comSegundaOpcao } = dados;
  return {
    chave: PASSO_DO_CURSO,
    titulo: 'Curso',
    descricao: comSegundaOpcao
      ? 'Escolha o curso da 1ª opção e, se quiser, o da 2ª opção neste processo seletivo.'
      : 'Escolha o curso em que você quer se inscrever neste processo seletivo.',
    concluido: primeira !== null,
    comErro: dados.comErro,
    resumo: comSegundaOpcao
      ? [
          { rotulo: '1ª opção', valor: primeira ?? 'Ainda não escolhida' },
          { rotulo: '2ª opção', valor: segunda ?? 'Não declarada' },
        ]
      : [{ rotulo: 'Curso', valor: primeira ?? 'Ainda não escolhido' }],
  };
}

interface LugarDasRecusas {
  /** A recusa que não tem campo na tela: sai como recusa geral. */
  readonly textoGeral: string | null;
  readonly mostradas: number;
  /** As mensagens ficam junto dos campos de curso. */
  readonly noCampo: boolean;
  /** A 2ª opção tem campo para a mensagem dela. */
  readonly segundaNoCampo: boolean;
}

/**
 * Onde cada recusa de oferta aparece. Sem o passo Curso na tela, só uma recusa de oferta pode aparecer,
 * como recusa geral. Com ele, uma por opção recusada; a da 2ª num processo que não a oferece não tem
 * campo, e o texto dela vai como recusa geral.
 */
function lugarDasRecusas(
  semPasso: boolean,
  comSegundaOpcao: boolean,
  [daPrimeira, daSegunda]: readonly [string | null, string | null],
): LugarDasRecusas {
  const semCampoDaSegunda = !semPasso && !comSegundaOpcao;
  const textoGeral = semPasso ? (daPrimeira ?? daSegunda) : semCampoDaSegunda ? daSegunda : null;
  const recusadas = Number(daPrimeira !== null) + Number(daSegunda !== null);
  return {
    textoGeral,
    mostradas: semPasso ? 1 : recusadas,
    noCampo: !(semPasso || (daPrimeira === null && semCampoDaSegunda)),
    segundaNoCampo: !semCampoDaSegunda,
  };
}

/**
 * O curso de cada opção que o candidato escolhe na tela: parte da escolha gravada ao carregar, e só
 * ele a muda, nem a releitura do ETag. Dona do erro de cada campo e do aviso de que a 2ª opção foi
 * limpa. Provida pela página.
 */
@Injectable()
export class EscolhaDoCurso {
  private readonly leitura = inject(LeituraDaInscricao);
  private readonly anuncio = inject(AnuncioDaInscricao);

  /** As ofertas da versão em que está a inscrição, não as do certame ao vivo. */
  readonly ofertas = computed(() => this.leitura.carregada()?.ofertas ?? []);
  private readonly numeroDeOpcoes = computed(() => this.leitura.carregada()?.numeroDeOpcoes ?? 1);
  private readonly inicial = computed(() => {
    const carregada = this.leitura.carregada();
    return carregada
      ? escolhaInicialDeOfertas(carregada.inscricao, carregada.ofertas, carregada.numeroDeOpcoes)
      : { oferta: null, segunda: null };
  });

  readonly ofertaEscolhida = linkedSignal<string | null>(() => this.inicial().oferta);
  readonly segundaOfertaEscolhida = linkedSignal<string | null>(() => this.inicial().segunda);
  readonly erroDaOferta = linkedSignal<string | null>(() => this.zeradoNaCarga());
  readonly erroDaSegundaOferta = linkedSignal<string | null>(() => this.zeradoNaCarga());
  /** Por que a 2ª opção foi limpa, até o candidato escolher de novo. */
  readonly avisoDaSegundaLimpa = linkedSignal<string | null>(() => this.zeradoNaCarga());
  private codigoDaRecusaDaSegunda: string | null = null;
  /**
   * Pede o foco no campo recusado. `primeira` diz se a 1ª opção é a recusada. O valor é novo a cada
   * pedido, para repetir o foco na mesma recusa.
   */
  readonly pedidoDeFoco = linkedSignal<{ readonly primeira: boolean } | null>(() =>
    this.zeradoNaCarga(),
  );

  /** A oferta escolhida, se ainda é uma das do processo: um id gravado que saiu da lista não vale. */
  readonly ofertaEscolhidaValida = computed(
    () => this.ofertas().find((o) => o.id === this.ofertaEscolhida()) ?? null,
  );
  /** O processo admite 2 opções e há de onde escolher a 2ª. */
  readonly comSegundaOpcao = computed(
    () => this.numeroDeOpcoes() === 2 && this.ofertas().length > 1,
  );
  /** A 2ª opção escolhida, se ainda vale: há 2 opções, a 1ª está escolhida e a 2ª é outra oferta. */
  private readonly segundaOfertaValida = computed(() => {
    const primeira = this.ofertaEscolhidaValida();
    if (!this.comSegundaOpcao() || primeira === null) return null;
    return (
      this.ofertas().find((o) => o.id === this.segundaOfertaEscolhida() && o.id !== primeira.id) ??
      null
    );
  });
  /** As ofertas da 2ª opção: todas, menos a escolhida na 1ª. */
  readonly ofertasDaSegunda = computed(() =>
    this.ofertas().filter((o) => o.id !== this.ofertaEscolhidaValida()?.id),
  );
  /** As ofertas escolhidas, como a API as recebe. */
  readonly escolhidas = computed<OfertasEscolhidas>(() => ({
    ofertaCursoId: this.ofertaEscolhidaValida()?.id ?? null,
    ofertaCursoSegundaOpcaoId: this.segundaOfertaValida()?.id ?? null,
  }));
  /** O processo com mais de uma oferta pede o curso antes de seguir. */
  readonly semCurso = computed(
    () => this.ofertas().length > 1 && this.ofertaEscolhidaValida() === null,
  );

  /** Os nomes dos cursos escolhidos, para as modalidades de cada opção terem título. */
  private readonly opcoesDeCurso = computed(() => ({
    primeira: this.ofertaEscolhidaValida()?.nome ?? null,
    segunda: this.segundaOfertaValida()?.nome ?? null,
  }));

  /** A avaliação da tela, com o curso de cada opção quando o processo admite 2. */
  comOpcoesDeCurso(avaliacao: AvaliacaoNaTela | null): AvaliacaoNaTela | null {
    return avaliacao && this.comSegundaOpcao()
      ? { ...avaliacao, opcoesDeCurso: this.opcoesDeCurso() }
      : avaliacao;
  }

  /**
   * O curso é o primeiro passo quando há mais de uma oferta; com uma só, ela é escolhida sozinha e
   * aparece no cabeçalho. Com 2 opções, o passo escolhe a 1ª e a 2ª (opcional).
   */
  readonly passosPrefixados = computed<readonly PassoPrefixado[]>(() =>
    this.ofertas().length <= 1
      ? []
      : [
          passoDoCurso({
            primeira: this.ofertaEscolhidaValida()?.nome ?? null,
            segunda: this.segundaOfertaValida()?.nome ?? null,
            comSegundaOpcao: this.comSegundaOpcao(),
            comErro: this.erroDaOferta() !== null || this.erroDaSegundaOferta() !== null,
          }),
        ],
  );

  escolherOferta(valor: string | null): void {
    this.ofertaEscolhida.set(valor);
    this.erroDaOferta.set(null);
    const recusaDaSegunda = this.codigoDaRecusaDaSegunda;
    if (recusaDaSegunda === null || RECUSAS_DA_SEGUNDA_QUE_VEM_DA_PRIMEIRA.has(recusaDaSegunda)) {
      this.erroDaSegundaOferta.set(null);
    }
    this.limparASegundaQueNaoValeMais(valor);
  }

  escolherSegundaOferta(valor: string | null): void {
    this.segundaOfertaEscolhida.set(valor);
    this.erroDaSegundaOferta.set(null);
    this.avisoDaSegundaLimpa.set(null);
  }

  /** Apaga as recusas de oferta que a gravação anterior deixou. */
  limparRecusas(): void {
    this.erroDaOferta.set(null);
    this.erroDaSegundaOferta.set(null);
  }

  /** O curso é obrigatório: mostra a recusa no passo Curso, com o foco no campo. */
  recusarCursoAusente(): void {
    this.mostrarRecusas(mensagemDaRecusa('uniplus.selecao.inscricao.oferta_obrigatoria'), null);
  }

  /**
   * Sem o passo Curso na tela, a recusa da oferta só pode aparecer como recusa geral. Com ele, cada
   * mensagem fica junto do campo da opção, e o foco vai para o primeiro campo recusado.
   * O código da recusa da 2ª opção decide quando ela se desfaz.
   */
  mostrarRecusas(
    daPrimeira: string | null,
    recusaDaSegunda: RecusaDaSegundaOpcao | null,
  ): RecusasMostradas {
    this.codigoDaRecusaDaSegunda = recusaDaSegunda?.codigo ?? null;
    const daSegunda = recusaDaSegunda?.mensagem ?? null;
    const lugar = lugarDasRecusas(this.ofertas().length <= 1, this.comSegundaOpcao(), [
      daPrimeira,
      daSegunda,
    ]);
    if (lugar.noCampo) {
      this.erroDaOferta.set(daPrimeira);
      this.erroDaSegundaOferta.set(lugar.segundaNoCampo ? daSegunda : null);
      this.pedidoDeFoco.set({ primeira: daPrimeira !== null });
    }
    return { textoGeral: lugar.textoGeral, mostradas: lugar.mostradas };
  }

  /**
   * A 2ª opção não existe sem a 1ª nem é a mesma oferta dela: trocar a 1ª para o curso da 2ª, ou
   * retirá-la, limpa a 2ª, e o aviso diz isso ao candidato, que não a perde sem ver.
   */
  private limparASegundaQueNaoValeMais(primeira: string | null): void {
    const segunda = this.segundaOfertaEscolhida();
    if (segunda === null || (primeira !== null && primeira !== segunda)) return;
    const aviso =
      primeira === null
        ? 'A 2ª opção foi limpa porque a 1ª opção foi retirada.'
        : 'A 2ª opção foi limpa porque é o mesmo curso da nova 1ª opção. Escolha outro, se quiser.';
    this.segundaOfertaEscolhida.set(null);
    this.erroDaSegundaOferta.set(null);
    this.avisoDaSegundaLimpa.set(aviso);
    this.anuncio.repetir(aviso);
  }

  /** Cada carga da inscrição recomeça sem recusa, aviso nem pedido de foco. */
  private zeradoNaCarga(): null {
    this.leitura.carregada();
    return null;
  }
}
