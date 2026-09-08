import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import {
  CondicaoAtendimentoDto,
  RecursoAcessibilidadeDto,
  TipoDeficienciaDto,
} from '@uniplus/shared-data/configuracao';

import {
  AtendimentoCondicaoSelecionada,
  ReferenciaDeAtendimento,
  StepValidation,
} from '../../processo-seletivo.models';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeAtendimentoService, CODIGO_CONDICAO_PCD } from './catalogos-de-atendimento.service';

/**
 * Mensagem que nomeia as referências inativas de uma lista — o handler
 * (`DefinirOfertaAtendimentoCommandHandler`) resolve cada id no cadastro
 * **vivo** e recusa com 422 (`CondicaoNaoEncontrada`/`RecursoNaoEncontrado`/
 * `TipoDeficienciaNaoEncontrado`) se qualquer um não existir mais lá. Sem
 * este diagnóstico local, "Gravar e avançar" falharia sempre que o rascunho
 * guardasse uma referência inativa, e nada na tela apontaria qual item é a
 * causa — `undefined` quando a lista está vazia, para não gerar mensagem à toa.
 */
function mensagemDeInativos(
  singular: string,
  plural: string,
  itens: readonly { readonly nome: string }[],
): string | undefined {
  if (itens.length === 0) return undefined;
  const nomes = itens.map((item) => item.nome).join(', ');
  return itens.length === 1
    ? `Remova ${singular} "${nomes}", que já saiu do cadastro ativo, antes de gravar.`
    : `Remova ${plural} que já saíram do cadastro ativo antes de gravar: ${nomes}.`;
}

/**
 * A oferta de atendimento especializado do processo (UNI-REQ-0012), gravada
 * por `PUT …/oferta-atendimento`. As três listas vêm dos cadastros de
 * Configuração — condições, recursos de acessibilidade e tipos de deficiência
 * —, referenciados por id; nenhuma delas é vocabulário local.
 *
 * **A regra do PcD vive no agregado, não aqui.** `tipoDeficienciaIds` só é
 * aceito quando a condição de código canônico `PCD` está entre `condicaoIds`
 * (`OfertaAtendimentoEspecializado.CodigoCondicaoPcd`, ADR-0067) — o
 * `CondicaoAtendimentoDto` não tem campo que vincule condição a tipo de
 * deficiência, então a checagem é por código, não por relação declarada no
 * contrato.
 */
@Component({
  selector: 'sel-step-atendimento',
  standalone: true,
  templateUrl: './atendimento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CatalogosDeAtendimentoService, provePassoDoWizard(AtendimentoStepComponent)],
})
export class AtendimentoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeAtendimentoService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);

  readonly erroDeGravacao = signal<string | null>(null);

  constructor() {
    this.catalogos.carregar();

    // As rotas do editor reusam a mesma instância de componente ao trocar de
    // processo — sem isto, a recusa de gravação do processo anterior
    // continuaria na tela ao abrir um processo novo que nunca tentou gravar.
    effect(() => {
      this.store.geracao();
      untracked(() => this.erroDeGravacao.set(null));
    });
  }

  readonly atendimento = computed(() => this.store.draft().atendimento);

  /**
   * A condição PcD está entre as selecionadas — é o que libera tipos de
   * deficiência (ADR-0067).
   *
   * Deriva do **rascunho**, não do catálogo ativo: o rascunho já guarda o
   * código de cada condição selecionada (`AtendimentoCondicaoSelecionada`)
   * justamente para isto. Depender de `catalogos.condicaoPcd()` faria a
   * seção de tipos de deficiência sumir — e `validate()` recusar sem saída —
   * assim que a condição PCD fosse inativada em Configuração ou o
   * carregamento do catálogo falhasse, mesmo com a condição continuando
   * marcada e visível na tela (com a tag "Inativo no cadastro").
   */
  readonly pcdSelecionada = computed(() =>
    this.atendimento().condicoes.some(
      (item) => item.codigo.toUpperCase() === CODIGO_CONDICAO_PCD,
    ),
  );

  /**
   * O catálogo confirmou sucesso — só então a tela sabe distinguir "saiu do
   * cadastro" de "ainda não sei". Enquanto carregando ou depois de uma
   * falha, `condicoesInativas()`/`recursosInativos()`/
   * `tiposDeficienciaInativos()` capturam tudo que está selecionado, e
   * qualquer controle que mutasse essas listas nesse estado (marcar,
   * desmarcar, remover) apagaria parte de uma oferta gravada sem
   * possibilidade de desfazer — `validate()` já não bloqueia o avanço
   * enquanto não sabe (achado anterior), mas isso não impede o operador de
   * remover algo sem querer se o controle continuar habilitado.
   */
  readonly catalogoConfirmado = computed(
    () => !this.catalogos.carregando() && this.catalogos.erro() === null,
  );

  /** Referências que o rascunho guarda mas o cadastro ativo já não tem — seguem visíveis, sem opção de escolher de novo (CA da #543). */
  readonly condicoesInativas = computed<readonly AtendimentoCondicaoSelecionada[]>(() => {
    const ativos = new Set(this.catalogos.condicoes().map((item) => item.id));
    return this.atendimento().condicoes.filter((item) => !ativos.has(item.id));
  });

  readonly recursosInativos = computed<readonly ReferenciaDeAtendimento[]>(() => {
    const ativos = new Set(this.catalogos.recursos().map((item) => item.id));
    return this.atendimento().recursos.filter((item) => !ativos.has(item.id));
  });

  readonly tiposDeficienciaInativos = computed<readonly ReferenciaDeAtendimento[]>(() => {
    const ativos = new Set(this.catalogos.tiposDeficiencia().map((item) => item.id));
    return this.atendimento().tiposDeficiencia.filter((item) => !ativos.has(item.id));
  });

  condicaoMarcada(id: string): boolean {
    return this.atendimento().condicoes.some((item) => item.id === id);
  }

  recursoMarcado(id: string): boolean {
    return this.atendimento().recursos.some((item) => item.id === id);
  }

  tipoDeficienciaMarcado(id: string): boolean {
    return this.atendimento().tiposDeficiencia.some((item) => item.id === id);
  }

  toggleCondicao(condicao: CondicaoAtendimentoDto, marcada: boolean): void {
    const atual = this.atendimento().condicoes;
    const proximo = marcada
      ? [...atual, { id: condicao.id, codigo: condicao.codigo, nome: condicao.nome }]
      : atual.filter((item) => item.id !== condicao.id);

    // Desmarcar a condição PcD esvazia os tipos de deficiência — sem ela o
    // servidor recusa qualquer tipo de deficiência ofertado. Só quando,
    // depois da desmarcação, não resta nenhuma outra condição de código PcD
    // em `proximo`: se o operador tinha mais de uma condição PcD marcada
    // (ex.: a inativa hidratada e a ativa que a substituiu), o pré-requisito
    // do ADR-0067 continua satisfeito.
    const ehPcd = condicao.codigo.toUpperCase() === CODIGO_CONDICAO_PCD;
    const restaPcd = proximo.some((item) => item.codigo.toUpperCase() === CODIGO_CONDICAO_PCD);
    if (!marcada && ehPcd && !restaPcd) {
      this.store.patchObjectSection('atendimento', { condicoes: proximo, tiposDeficiencia: [] });
      return;
    }
    this.store.patchObjectSection('atendimento', { condicoes: proximo });
  }

  toggleRecurso(recurso: RecursoAcessibilidadeDto, marcado: boolean): void {
    const atual = this.atendimento().recursos;
    const proximo = marcado
      ? [...atual, { id: recurso.id, nome: recurso.nome }]
      : atual.filter((item) => item.id !== recurso.id);
    this.store.patchObjectSection('atendimento', { recursos: proximo });
  }

  toggleTipoDeficiencia(tipo: TipoDeficienciaDto, marcado: boolean): void {
    const atual = this.atendimento().tiposDeficiencia;
    const proximo = marcado
      ? [...atual, { id: tipo.id, nome: tipo.nome }]
      : atual.filter((item) => item.id !== tipo.id);
    this.store.patchObjectSection('atendimento', { tiposDeficiencia: proximo });
  }

  /**
   * Remove uma referência que já saiu do cadastro ativo — a única ação
   * disponível para ela. Espelha `toggleCondicao`: se a condição removida
   * for a de código PcD, os tipos de deficiência também são esvaziados — sem
   * isso, `validate()` continuaria recusando o passo sem nenhum controle na
   * tela capaz de desfazer a causa.
   *
   * A limpeza só acontece se **depois** da remoção não restar nenhuma
   * condição de código PcD em `proximo`. Se o operador já tinha marcado a
   * condição PcD ativa que substituiu a inativa (mesmo código, id novo), o
   * pré-requisito continua satisfeito, e esvaziar os tipos de deficiência
   * apagaria uma seleção válida sem motivo.
   */
  removerCondicaoInativa(id: string): void {
    const atual = this.atendimento().condicoes;
    const removida = atual.find((item) => item.id === id);
    const proximo = atual.filter((item) => item.id !== id);

    const restaPcd = proximo.some((item) => item.codigo.toUpperCase() === CODIGO_CONDICAO_PCD);
    if (removida !== undefined && removida.codigo.toUpperCase() === CODIGO_CONDICAO_PCD && !restaPcd) {
      this.store.patchObjectSection('atendimento', { condicoes: proximo, tiposDeficiencia: [] });
      return;
    }
    this.store.patchObjectSection('atendimento', { condicoes: proximo });
  }

  removerRecursoInativo(id: string): void {
    this.store.patchObjectSection('atendimento', {
      recursos: this.atendimento().recursos.filter((item) => item.id !== id),
    });
  }

  removerTipoDeficienciaInativo(id: string): void {
    this.store.patchObjectSection('atendimento', {
      tiposDeficiencia: this.atendimento().tiposDeficiencia.filter((item) => item.id !== id),
    });
  }

  /**
   * "Inativo no cadastro" é uma afirmação que só se sustenta quando o
   * catálogo carregou com sucesso — enquanto carregando ou depois de uma
   * falha, `condicoesInativas()`/`recursosInativos()`/
   * `tiposDeficienciaInativos()` também capturam tudo que está selecionado,
   * porque o catálogo ativo comparado está vazio, não porque os itens de
   * fato saíram dele. Afirmar "inativo" nesses dois casos seria um
   * diagnóstico que a tela não tem como sustentar (CA da #543: nem falha
   * nem carregamento podem esconder ou reclassificar o que já está
   * gravado) — "ainda não sei" não é "não existe mais", nem no rótulo.
   */
  rotuloDeSituacaoInativa(): string {
    if (this.catalogos.carregando()) return 'Carregando catálogo…';
    return this.catalogos.erro() !== null ? 'Catálogo indisponível' : 'Inativo no cadastro';
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const mensagens: string[] = [];

    if (this.atendimento().tiposDeficiencia.length > 0 && !this.pcdSelecionada()) {
      mensagens.push(
        'Tipos de deficiência exigem a condição "Pessoa com deficiência" marcada entre as condições aceitas.',
      );
    }

    // A checagem de referência inativa só é confiável depois que os três
    // catálogos carregaram com sucesso. Enquanto carregando ou depois de uma
    // falha, `catalogos.condicoes()`/`recursos()`/`tiposDeficiencia()` ficam
    // vazios — não porque nada está ativo, mas porque a tela ainda não sabe
    // o que está ativo —, e `condicoesInativas()` e as demais confundiriam
    // "não sei ainda" com "não existe mais", classificando toda seleção
    // gravada como inativa e mandando o operador apagar uma oferta válida e
    // inalterada por causa de uma indisponibilidade temporária. O erro de
    // carga já está reportado no banner do template (`catalogos.erro()`);
    // repeti-lo aqui bloquearia o avanço de um rascunho que não mudou.
    if (this.catalogoConfirmado()) {
      const inativos = [
        mensagemDeInativos('a condição', 'as condições', this.condicoesInativas()),
        mensagemDeInativos('o recurso', 'os recursos', this.recursosInativos()),
        mensagemDeInativos(
          'o tipo de deficiência',
          'os tipos de deficiência',
          this.tiposDeficienciaInativos(),
        ),
      ].filter((mensagem): mensagem is string => mensagem !== undefined);
      mensagens.push(...inativos);
    }

    return mensagens.length > 0 ? { valid: false, messages: mensagens } : { valid: true };
  }

  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          'O cadastro do processo precisa estar concluído antes de configurar o atendimento.',
        ],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const atendimento = this.atendimento();
    const geracao = this.store.geracao();
    this.erroDeGravacao.set(null);
    this.store.salvando.set(true);
    try {
      const resultado = await this.cadastro.definirOfertaAtendimento(processoId, {
        condicaoIds: atendimento.condicoes.map((item) => item.id),
        recursoIds: atendimento.recursos.map((item) => item.id),
        tipoDeficienciaIds: atendimento.tiposDeficiencia.map((item) => item.id),
      });

      // O editor pode ter passado a outro processo enquanto o comando corria.
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };

      if (!resultado.ok) {
        const mensagem = this.problemI18n.resolve(resultado.problem).title;
        this.erroDeGravacao.set(mensagem);
        return { valid: false, messages: [mensagem] };
      }

      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }
}
