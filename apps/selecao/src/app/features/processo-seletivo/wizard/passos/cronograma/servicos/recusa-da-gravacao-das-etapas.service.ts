import { inject, Injectable, Injector } from '@angular/core';
import {
  ProblemI18nService,
  type RecusaDoProblema,
  recusasDoProblema,
} from '@uniplus/shared-core/http';

import type { ValidacaoDoPasso } from '../../../processo-seletivo.models';
import { focarAposRenderizar } from '../../../shared/foco-apos-renderizar';
import { NumeracaoDasRespostasRecusadas } from '../../../shared/recusas/numeracao-das-respostas-recusadas';
import { resumoDaGravacaoRecusada } from '../../../shared/recusas/texto-da-recusa-no-resumo';
import { CatalogoDeRegras } from '../catalogos/catalogo-de-regras.service';
import { CatalogoDeTiposDeEtapa } from '../catalogos/catalogo-de-tipos-de-etapa.service';
import { campoNaTelaDaEtapa } from '../campo-da-etapa';
import { etapaDoFormulario } from '../cronograma-form';
import { alvosDaRecusaDaEtapa } from '../etapa/alvo-da-recusa-da-etapa';
import { recusaDaEtapaDeNotaDoEnem } from '../recusas-do-servidor-da-etapa';
import type { ConteudoDaGravacao, ProblemaDaGravacao } from './conteudo-da-gravacao';
import type {
  ControleNaTelaDaEtapa,
  DistribuicaoDasRecusasDasEtapas,
} from './distribuicao-das-recusas-das-etapas';
import { ExpansaoDoCronograma } from './expansao-do-cronograma.service';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';
import { RecusasDoServidorNasEtapas } from './recusas-do-servidor-nas-etapas.service';

const CAMPO_DE_RECURSO = /^recursos\./;

/**
 * O que a recusa da gravação das etapas faz na tela: guarda cada recusa na etapa e no campo a que
 * ela se refere, abre a etapa (e o bloco dos recursos, quando é o caso), leva o foco ao controle
 * da primeira recusa que a pessoa ainda precisa tratar e diz no resumo do passo só o que não
 * achou campo.
 */
@Injectable()
export class RecusaDaGravacaoDasEtapas {
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly recusas = inject(RecusasDoServidorNasEtapas);
  private readonly expansao = inject(ExpansaoDoCronograma);
  private readonly numeracao = inject(NumeracaoDasRespostasRecusadas);
  private readonly tiposDeEtapa = inject(CatalogoDeTiposDeEtapa);
  private readonly catalogoDeRegras = inject(CatalogoDeRegras);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly injetor = inject(Injector);

  recusar(conteudo: ConteudoDaGravacao, problema: ProblemaDaGravacao): ValidacaoDoPasso {
    const { deCampo } = recusasDoProblema(problema);
    const { porEtapa, semLugar } = this.recusas.registrar(
      this.numeracao.proxima(),
      conteudo,
      deCampo,
      this.controleNaTela(),
    );
    this.abrirAsEtapas(porEtapa);
    this.focarAPrimeiraRecusa();
    return { valid: false, messages: this.resumo(problema, semLugar) };
  }

  /** O que o resumo do passo diz: o texto do código da resposta e o que não achou campo. */
  private resumo(problema: ProblemaDaGravacao, semLugar: readonly RecusaDoProblema[]): string[] {
    return resumoDaGravacaoRecusada(problema, semLugar, {
      doCodigo: recusaDaEtapaDeNotaDoEnem(problema.code),
      titulo: () => this.problemI18n.resolve(problema).title,
    });
  }

  /** A etapa tem controle para o campo agora, com o que ela declara hoje e o catálogo de tipos. */
  private controleNaTela(): ControleNaTelaDaEtapa {
    const tipos = this.tiposDeEtapa.tipoEtapaPorId();
    return (grupo, campo) => {
      const etapa = etapaDoFormulario(grupo);
      return campoNaTelaDaEtapa(campo, etapa, tipos.get(etapa.tipoEtapaOrigemId));
    };
  }

  /** Abre as etapas que receberam recusa, e o bloco dos recursos nas que têm recusa de recurso. */
  private abrirAsEtapas(porEtapa: DistribuicaoDasRecusasDasEtapas['porEtapa']): void {
    for (const [grupo, recusas] of porEtapa) {
      const posicao = this.cronograma.etapas.controls.indexOf(grupo);
      if (posicao < 0) continue;
      this.expansao.abrirEtapas([posicao]);
      if (recusas.some((recusa) => CAMPO_DE_RECURSO.test(recusa.campo))) {
        this.expansao.abrirBloco(posicao, 'recursos');
      }
    }
  }

  /** Leva o foco ao alvo da primeira recusa que a pessoa ainda precisa tratar. */
  private focarAPrimeiraRecusa(): void {
    const primeira = this.recusas.primeiraRecusaAtiva();
    const posicao =
      primeira === null ? -1 : this.cronograma.etapas.controls.indexOf(primeira.grupo);
    if (primeira === null || posicao < 0) return;
    const etapa = etapaDoFormulario(primeira.grupo);
    const regras = this.catalogoDeRegras.regrasConsolidacao().map((regra) => regra.codigo);
    const alvos = alvosDaRecusaDaEtapa(primeira.recusa.campo, etapa, posicao, regras);
    focarAposRenderizar(this.injetor, ...alvos);
  }
}
