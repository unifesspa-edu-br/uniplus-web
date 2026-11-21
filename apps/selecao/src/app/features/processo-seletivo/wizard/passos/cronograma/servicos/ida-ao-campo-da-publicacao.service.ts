import { effect, inject, Injectable, Injector, untracked } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { focarAposATrocaDePasso } from '../../../shared/foco-apos-renderizar';
import { RecusasDaPublicacao } from '../../../shared/recusas/recusas-da-publicacao.service';
import { alvosDaRecusaDaFase } from '../../fase/alvo-da-recusa-da-fase';
import { CatalogoDeRegras } from '../catalogos/catalogo-de-regras.service';
import { SituacaoDosCatalogosDoCronograma } from '../catalogos/situacao-dos-catalogos-do-cronograma.service';
import { etapaDoFormulario, faseDoFormulario } from '../cronograma-form';
import { alvosDaRecusaDaEtapa } from '../etapa/alvo-da-recusa-da-etapa';
import type { RecusaNoCronograma } from './distribuicao-das-recusas-da-publicacao';
import { ExpansaoDoCronograma } from './expansao-do-cronograma.service';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';
import { RecusasDaPublicacaoNoCronograma } from './recusas-da-publicacao-no-cronograma.service';

/**
 * Leva a pessoa que usou "Ir ao campo" na Revisão ao campo que a recusa da publicação aponta: abre
 * a fase, a etapa e o bloco dos recursos e põe o foco no controle. Espera o passo estar visível e
 * os catálogos lidos, porque deles depende saber se o campo tem controle na tela.
 */
@Injectable()
export class IdaAoCampoDaPublicacao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly publicacao = inject(RecusasDaPublicacao);
  private readonly noCronograma = inject(RecusasDaPublicacaoNoCronograma);
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly expansao = inject(ExpansaoDoCronograma);
  private readonly situacao = inject(SituacaoDosCatalogosDoCronograma);
  private readonly regras = inject(CatalogoDeRegras);
  private readonly injetor = inject(Injector);

  constructor() {
    effect(() => this.levarAoDestino());
  }

  private levarAoDestino(): void {
    const destino = this.publicacao.destino();
    if (destino === null || !this.store.cronogramaVisivel()) return;
    if (this.situacao.carregando() || this.situacao.erro() !== null) return;
    const achada = this.noCronograma.lugarDe(destino);
    untracked(() => {
      this.publicacao.destino.set(null);
      if (achada !== null) this.abrirEFocar(achada);
    });
  }

  private abrirEFocar({ lugar, recusa }: RecusaNoCronograma): void {
    if (lugar.tipo === 'fase') this.irParaFase(lugar.codigo, recusa.campo);
    else if (lugar.tipo === 'etapa' || lugar.tipo === 'recursoRegravado') {
      this.irParaEtapa(lugar.etapaId, recusa.campo);
    }
  }

  private irParaFase(codigo: string, campo: string): void {
    const item = this.cronograma
      .linhaDoTempo()
      .find((f) => f.grupo.controls.codigo.value === codigo);
    if (item === undefined) return;
    this.expansao.abrirFases([item.indice]);
    const alvos = alvosDaRecusaDaFase(campo, faseDoFormulario(item.grupo), item.indice);
    focarAposATrocaDePasso(this.injetor, ...alvos);
  }

  private irParaEtapa(etapaId: string, campo: string): void {
    const grupos = this.cronograma.etapas.controls;
    const posicao = grupos.findIndex((grupo) => grupo.controls.id.value === etapaId);
    if (posicao < 0) return;
    const etapa = etapaDoFormulario(grupos[posicao]);
    this.abrirAEtapa(posicao, etapa.faseCodigo, campo.startsWith('recursos.'));
    const regras = this.regras.regrasConsolidacao().map((regra) => regra.codigo);
    focarAposATrocaDePasso(this.injetor, ...alvosDaRecusaDaEtapa(campo, etapa, posicao, regras));
  }

  private abrirAEtapa(posicao: number, faseCodigo: string, comRecursos: boolean): void {
    const daFase = this.cronograma
      .linhaDoTempo()
      .find((f) => f.grupo.controls.codigo.value === faseCodigo);
    if (daFase !== undefined) this.expansao.abrirFases([daFase.indice]);
    this.expansao.abrirEtapas([posicao]);
    if (comRecursos) this.expansao.abrirBloco(posicao, 'recursos');
  }
}
