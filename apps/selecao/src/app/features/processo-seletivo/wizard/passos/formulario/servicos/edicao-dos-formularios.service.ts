import { inject, Injectable } from '@angular/core';
import { conteudoInicial, type ConteudoDoFormulario } from '@uniplus/shared-inscricao/formulario';

import type { FormularioDoProcessoNoRascunho } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { comFormulario, consequenciaDoCodigo } from '../formularios-do-rascunho';
import { naFase } from '../obrigatoriedade-na-fase';
import type { FormularioAAcrescentar } from '../secoes/acrescimo.component';
import { AplicacaoDeModelo } from './aplicacao-de-modelo.service';
import { FasesDosFormularios } from './fases-dos-formularios.service';

function formularioNovo({ faseCodigo, codigo, modelo }: FormularioAAcrescentar) {
  return {
    codigo,
    gravado: false,
    faseCodigo,
    obrigatorio: modelo?.obrigatorio ?? true,
    consequenciaDaFaltaDeEnvio: null,
    conteudo: conteudoInicial(),
    modeloOrigemCodigo: null,
  };
}

type Mudanca = (formulario: FormularioDoProcessoNoRascunho) => FormularioDoProcessoNoRascunho;

/**
 * As mudanças que o operador faz num formulário do rascunho: o conteúdo, o código, a fase, a
 * obrigatoriedade e a consequência da falta de envio. A fase decide o que cabe da obrigatoriedade,
 * e a consequência só existe onde cabe — por isso toda mudança de fase ou de obrigatoriedade passa
 * pela regra da fase.
 */
@Injectable()
export class EdicaoDosFormularios {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly fases = inject(FasesDosFormularios);
  private readonly aplicacao = inject(AplicacaoDeModelo);

  conteudo(codigo: string, conteudo: ConteudoDoFormulario): void {
    this.atualizar(codigo, (formulario) => ({ ...formulario, conteudo }));
  }

  fase(codigo: string, faseCodigo: string): void {
    this.atualizarNaFase(codigo, (formulario) => ({ ...formulario, faseCodigo }));
  }

  obrigatorio(codigo: string, obrigatorio: boolean): void {
    this.atualizarNaFase(codigo, (formulario) => ({ ...formulario, obrigatorio }));
  }

  consequencia(codigo: string, consequencia: string | null): void {
    this.atualizar(codigo, (formulario) => ({
      ...formulario,
      consequenciaDaFaltaDeEnvio: consequencia === null ? null : consequenciaDoCodigo(consequencia),
    }));
  }

  /** O código só muda enquanto o formulário não foi gravado. Diz se mudou. */
  codigo(anterior: string, novo: string): boolean {
    const atual = this.formularios().find((formulario) => formulario.codigo === anterior);
    if (atual === undefined || atual.gravado) return false;
    this.trocar({ ...atual, codigo: novo }, anterior);
    this.aplicacao.trocarCodigo(anterior, novo);
    return true;
  }

  /**
   * Acrescenta o formulário com o código e a fase escolhidos, só com a revisão e aceite que todo
   * formulário exige como última página; o resto vem do modelo, quando ele é aplicado. O
   * formulário é criado no servidor quando o passo for gravado.
   */
  acrescentar(pedido: FormularioAAcrescentar): void {
    const novo = this.naFase(formularioNovo(pedido), this.formularios());
    this.trocar(novo, pedido.codigo);
    if (pedido.modelo !== null) this.aplicacao.escolher(pedido.codigo, pedido.modelo.id);
  }

  private formularios(): readonly FormularioDoProcessoNoRascunho[] {
    return this.store.draft().formulario.formularios;
  }

  private atualizar(codigo: string, mudar: Mudanca): void {
    const atual = this.formularios().find((formulario) => formulario.codigo === codigo);
    if (atual !== undefined) this.trocar(mudar(atual), codigo);
  }

  private atualizarNaFase(codigo: string, mudar: Mudanca): void {
    const outros = this.formularios().filter((formulario) => formulario.codigo !== codigo);
    this.atualizar(codigo, (formulario) => this.naFase(mudar(formulario), outros));
  }

  private naFase(
    formulario: FormularioDoProcessoNoRascunho,
    outros: readonly FormularioDoProcessoNoRascunho[],
  ): FormularioDoProcessoNoRascunho {
    const fase = this.fases
      .fasesDoCronograma()
      .find((item) => item.codigo === formulario.faseCodigo);
    const ocupantes = outros.filter((outro) => outro.faseCodigo === formulario.faseCodigo);
    return naFase(formulario, fase, ocupantes);
  }

  private trocar(formulario: FormularioDoProcessoNoRascunho, codigoAnterior: string): void {
    this.store.patchSection(
      'formulario',
      comFormulario(this.store.draft().formulario, formulario, codigoAnterior),
    );
  }
}
