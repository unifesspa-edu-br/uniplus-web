import { Injectable, computed, inject } from '@angular/core';
import { type UiComboboxGroup } from '@uniplus/shared-ui/components';

import { type CondicaoGatilhoConfig } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  clausulasDoGatilho,
  dominiosDoGatilho,
  fatosDoGatilhoNaFase,
  fatosParaGatilho,
  recusasDeFaseDoGatilho,
  type FatoEscolhivel,
} from '../../../shared/gatilho-de-exigencia';
import {
  motivoDoGrupoForaDoLugar,
  orientacaoDaRecusaDaRepeticao,
  type NomesDaOrientacao,
} from '../../../shared/orientacao-da-recusa-do-fato';
import {
  camposDaRepeticao,
  fasesNoCronograma,
  producaoDoRascunho,
  recusaDaRepeticao,
} from '../../../shared/producao-dos-fatos';
import {
  comExigidoDeTodos,
  comRecorteEscolhido,
  exigidoDeTodos,
  modalidadesDaExigencia,
} from '../../../shared/exigencias/recorte-por-modalidade';
import {
  comRepeticao,
  comRepeticaoEmTodasAsFases,
} from '../../../shared/exigencias/exigencias-documentais';
import { CatalogosDoCronogramaService } from '../../cronograma/catalogos-do-cronograma.service';
import { FaseEmEdicao } from '../fase-em-edicao';
import type { RepeticaoDoDocumento } from '../tipos-da-conferencia';
import { SEM_REPETICAO } from '../tipos-da-conferencia';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';

const SEM_ERROS: Readonly<Record<number, string>> = {};

/**
 * O gatilho de cada documento da fase aberta: de quem é cobrado, que fatos do candidato a
 * condição pode citar e a repetição pelas ocorrências de um grupo dos formulários.
 */
@Injectable()
export class GatilhoDasExigenciasStore {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly exigencias = inject(ExigenciasDaFaseStore);
  private readonly faseDoRascunho = this.faseEmEdicao.faseDoRascunho;
  private readonly fasesDoCronograma = this.faseEmEdicao.fasesDoCronograma;

  /**
   * Os valores dos fatos cujo domínio vem do próprio processo — as condições de atendimento e as
   * modalidades que ele oferta —, porque é o que ele oferta que vale, não um catálogo global.
   */
  readonly dominiosDoGatilho = computed(() =>
    dominiosDoGatilho(
      this.catalogos.fatos(),
      this.store.draft().atendimento.condicoes.map((condicao) => condicao.codigo),
      this.store.modalidadesDoProcesso(),
    ),
  );

  /**
   * Todos os fatos do catálogo que um gatilho sabe avaliar, sem o recorte de fase. É o
   * vocabulário com que a tela lê o público de uma exigência já declarada.
   *
   * A lista não se escreve aqui: acrescentar um fato é mudança de software — só serve o fato
   * que exista código sabendo resolver — e o catálogo é semeado por migration.
   */
  readonly fatosDoGatilho = computed<readonly FatoEscolhivel[]>(() =>
    fatosParaGatilho(this.catalogos.fatos(), this.dominiosDoGatilho()),
  );

  readonly fatoPorCodigo = computed(
    () => new Map(this.fatosDoGatilho().map((fato) => [fato.codigo, fato])),
  );

  /** O que o rascunho diz sobre o formulário e a fase em que cada fato é conhecido. */
  readonly producaoDosFatos = computed(() =>
    producaoDoRascunho(
      this.store.draft().formulario,
      fasesNoCronograma(this.fasesDoCronograma(), this.catalogos.fasePorId()),
      this.catalogos.fatos(),
    ),
  );

  /** Como a orientação nomeia o fato e a fase. */
  readonly nomesDaOrientacao = computed<NomesDaOrientacao>(() => {
    const nomeDoFato = new Map(this.catalogos.fatos().map((fato) => [fato.codigo, fato.nome]));
    return {
      fato: (codigo: string) => nomeDoFato.get(codigo) ?? codigo,
      fase: this.catalogos.nomeDaFase(),
    };
  });

  /**
   * O que o editor de cada documento da fase oferece e recusa: os fatos que o gatilho pode citar
   * nesta fase — de qualquer formulário do processo, derivados e da classificação, já conhecidos
   * aqui — e, por condição, a recusa de fase com o que fazer para resolvê-la.
   */
  readonly gatilhoPorDocumento = computed(() => {
    const producao = this.producaoDosFatos();
    const nomes = this.nomesDaOrientacao();

    return new Map(
      this.exigencias.documentosDaFase().map((doc) => {
        const exigencia = this.exigencias.exigenciaDoDocumento(doc.id);
        // Os campos do grupo pelo qual o documento se repete: o gatilho os cita além dos do candidato.
        const doGrupo = camposDaRepeticao(
          this.exigencias.repeticaoDeclarada(doc.id)?.grupo ?? null,
          producao,
        );
        const erros: Record<number, string> = {};
        for (const recusa of recusasDeFaseDoGatilho(exigencia, producao, nomes, doGrupo)) {
          erros[recusa.indice] = recusa.orientacao;
        }
        return [
          doc.id,
          {
            fatos: fatosDoGatilhoNaFase(
              this.catalogos.fatos(),
              exigencia,
              producao,
              this.dominiosDoGatilho(),
              exigencia.condicoes.map((condicao) => condicao.fato),
              doGrupo,
            ),
            erros,
          },
        ] as const;
      }),
    );
  });

  /**
   * A repetição de cada documento da fase pelas ocorrências de um grupo dos formulários
   * (ADR-0138, UNI-REQ-0069): a declarada ou a herdada do grupo de alternativas, os grupos que ela
   * pode escolher onde o documento é cobrado, os que não pode e por quê, e o que fazer quando a
   * escolhida deixou de valer — grupo removido, respondido depois da fase ou só na isenção.
   */
  readonly repeticaoPorDocumento = computed(() => {
    const producao = this.producaoDosFatos();
    const nomes = this.nomesDaOrientacao();
    const grupos = [...producao.grupos.values()];

    return new Map(
      this.exigencias.documentosDaFase().map((doc): [string, RepeticaoDoDocumento] => {
        const exigencia = this.exigencias.exigenciaDoDocumento(doc.id);
        const atual = this.exigencias.repeticaoDeclarada(doc.id);
        const avaliados = grupos.map((grupo) => ({
          grupo,
          recusa: recusaDaRepeticao(grupo.codigo, exigencia, producao),
        }));
        const recusaAtual =
          atual === null ? null : recusaDaRepeticao(atual.grupo, exigencia, producao);
        return [
          doc.id,
          {
            atual,
            rotulo: atual === null ? '' : (producao.grupos.get(atual.grupo)?.rotulo ?? atual.grupo),
            semGrupo: grupos.length === 0,
            oferecidos: avaliados.filter(({ recusa }) => recusa === null).map(({ grupo }) => grupo),
            naoOferecidos: avaliados.flatMap(({ recusa }) =>
              recusa?.tipo === 'GRUPO_FORA_DO_LUGAR'
                ? [motivoDoGrupoForaDoLugar(recusa, nomes)]
                : [],
            ),
            erro:
              recusaAtual === null || atual === null
                ? null
                : orientacaoDaRecusaDaRepeticao(recusaAtual, producao, nomes, atual.herdada),
          },
        ];
      }),
    );
  });

  /** A repetição do documento na fase aberta, com o que o campo "Repetir por" oferece. */
  repeticaoDoDocumento(id: string): RepeticaoDoDocumento {
    return this.repeticaoPorDocumento().get(id) ?? SEM_REPETICAO;
  }

  /**
   * Declara pelas ocorrências de que grupo o documento se repete, ou nenhum. O documento que vale em
   * todas as fases continua valendo: a repetição é a mesma declaração em cada uma, como o gatilho.
   * As condições que citam campo do grupo anterior ficam, marcadas, até o operador decidir.
   */
  escolherRepeticao(id: string, valor: string): void {
    const fase = this.faseDoRascunho();
    if (fase === null) return;

    const grupo = valor === '' ? null : valor;
    const exigencias = this.store.draft().documentos;
    this.store.patchSection(
      'documentos',
      this.exigencias.valeEmTodasAsFases(id)
        ? comRepeticaoEmTodasAsFases(exigencias, id, grupo)
        : comRepeticao(exigencias, id, fase.codigo, grupo),
    );
  }

  /** Os fatos que o gatilho do documento pode citar na fase aberta. */
  fatosDoGatilhoDoDocumento(id: string): readonly FatoEscolhivel[] {
    return this.gatilhoPorDocumento().get(id)?.fatos ?? [];
  }

  /**
   * O que o editor diz quando não tem fato a oferecer: com o catálogo carregado, a falta é da
   * fase — nada do candidato é conhecido até ela —, e mandar recarregar a página não resolveria.
   */
  readonly textoSemFatosDoGatilho = computed(() =>
    this.catalogos.fatos().length === 0
      ? 'O catálogo de fatos do candidato não foi carregado. Recarregue a página para declarar condições.'
      : 'Nenhum dado do candidato é conhecido até esta fase para condicionar o documento.',
  );

  /** A recusa de fase de cada condição do gatilho do documento, com a orientação, pela posição. */
  errosDeFaseDoGatilho(id: string): Readonly<Record<number, string>> {
    return this.gatilhoPorDocumento().get(id)?.erros ?? SEM_ERROS;
  }

  /**
   * O que o operador perde ao dizer que o documento é de todo candidato: o recorte por
   * modalidade e as condições declaradas saem junto, porque uma exigência geral que carrega
   * gatilho é recusada pelo servidor.
   */
  avisoDeDescarteDoGatilho(id: string): string {
    if (this.ehExigidoDeTodos(id)) return '';

    const exigencia = this.exigencias.exigenciaDoDocumento(id);
    const recorte = modalidadesDaExigencia(exigencia) !== null;
    const condicoes = clausulasDoGatilho(exigencia).length > 0;
    if (!recorte && !condicoes) return '';

    if (recorte && condicoes) {
      return 'Passar para "todo candidato" descarta o recorte por modalidade e as condições declaradas abaixo.';
    }
    return recorte
      ? 'Passar para "todo candidato" descarta o recorte por modalidade.'
      : 'Passar para "todo candidato" descarta as condições declaradas abaixo.';
  }

  /**
   * O que a exigência alcança quando nenhuma condição foi declarada no editor: ou o recorte
   * por modalidade a sustenta, ou ela não é cobrada de ninguém. As duas situações têm a mesma
   * tela vazia, e dizer "de ninguém" nas duas fazia o operador desfazer o recorte que acabara
   * de declarar.
   */
  gatilhoSemCondicaoDiz(id: string): string {
    const recorte = modalidadesDaExigencia(this.exigencias.exigenciaDoDocumento(id));
    if (recorte === null) {
      return 'Sem condição declarada, este documento não é cobrado de ninguém.';
    }
    return 'Este documento é cobrado de quem concorre nas modalidades escolhidas acima. Acrescente condição para restringir mais.';
  }

  /** Se a exigência é cobrada de todo candidato — é DECLARADO, não deduzido do gatilho. */
  ehExigidoDeTodos(id: string): boolean {
    return exigidoDeTodos(this.exigencias.exigenciaDoDocumento(id));
  }

  /**
   * Declara de quem o documento é cobrado. Passar a "de todos" descarta o gatilho: o servidor
   * recusa a exigência geral que carrega condição, e guardá-la escondida a faria ressurgir na
   * próxima troca sem que ninguém a tivesse reescrito.
   */
  escolherExigidoDe(id: string, valor: string): void {
    this.exigencias.escreverGatilho(
      id,
      comExigidoDeTodos(this.exigencias.exigenciaDoDocumento(id), valor === 'todos'),
    );
  }

  /**
   * As condições que o editor devolve: a lista inteira, já renumerada. Trocar o gatilho
   * passa pelo mesmo caminho de qualquer outra edição da declaração desta fase.
   */
  escreverCondicoes(id: string, condicoes: readonly CondicaoGatilhoConfig[]): void {
    this.exigencias.escreverGatilho(id, { ...this.exigencias.exigenciaDoDocumento(id), condicoes });
  }

  /**
   * Modalidades que valem para o documento. Sem recorte, ele acompanha o que o quadro de
   * vagas oferta — derivado, não copiado: uma lista própria ficaria vazia no documento
   * recém-incluído e dependeria de alguém sincronizá-la.
   */
  modalidadesEfetivas(id: string): readonly string[] {
    const aceitas = this.exigencias.modalidades();
    const recorte = modalidadesDaExigencia(this.exigencias.exigenciaDoDocumento(id));
    if (recorte === null) return aceitas;

    const conjunto = new Set(aceitas);
    return recorte.filter((codigo) => conjunto.has(codigo));
  }

  /** As modalidades que o quadro de vagas oferta, como a lista de escolha as apresenta. */
  readonly modalidadesEscolhiveis = computed<readonly UiComboboxGroup[]>(() => {
    const codigos = this.exigencias.modalidades();
    if (codigos.length === 0) return [];
    return [
      {
        label: 'Modalidades do quadro de vagas',
        options: codigos.map((codigo) => ({ value: codigo, label: codigo })),
      },
    ];
  });

  /**
   * Substitui de uma vez o recorte de quem entrega o documento.
   *
   * Marcar todas as ofertadas volta ao padrão — o documento acompanha o quadro de vagas —
   * em vez de gravar uma lista que por acaso coincide com ele: a diferença aparece quando o
   * quadro muda depois, e o que acompanha o quadro acompanha a mudança.
   */
  definirModalidades(id: string, escolhidas: readonly string[]): void {
    this.exigencias.escreverGatilho(
      id,
      comRecorteEscolhido(
        this.exigencias.exigenciaDoDocumento(id),
        escolhidas,
        this.exigencias.modalidades(),
      ),
    );
  }
}
