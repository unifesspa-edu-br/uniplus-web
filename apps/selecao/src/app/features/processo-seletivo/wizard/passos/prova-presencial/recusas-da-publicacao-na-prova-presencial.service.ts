import { computed, inject, Injectable } from '@angular/core';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { emOrdem } from '../../shared/recusas/ordem-das-recusas';
import { mesmoConteudo } from '../../shared/conteudo-canonico';
import {
  RecusasDaPublicacao,
  type RecusaDaPublicacao,
} from '../../shared/recusas/recusas-da-publicacao.service';
import type { DeclaracaoDaProvaPresencial } from './declaracao-da-prova-presencial';
import {
  recusasDaProvaPresencial,
  type RecusasDaProvaPresencial,
} from './recusas-da-prova-presencial';

function eCampoDaProvaPresencial(campoOriginal: string): boolean {
  const campo = campoOriginal
    .replace(/^\$\./, '')
    .replace(/^request\./i, '')
    .replace(/^\//, '');
  return campo.toLowerCase().startsWith('provapresencial');
}

export function eRecusaDaProvaPresencial(recusa: RecusaDaPublicacao): boolean {
  return eCampoDaProvaPresencial(recusa.campo) || recusa.codigo.startsWith('ProvaPresencial.');
}

@Injectable()
export class RecusasDaPublicacaoNaProvaPresencial {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly publicacao = inject(RecusasDaPublicacao);

  readonly recusas = computed(() => {
    const conferida = this.publicacao.provaPresencialDaResposta();
    const repartidas = recusasDaProvaPresencial(
      this.recusasDaProvaPresencial(conferida),
      conferida?.municipios ?? [],
    );
    return incluirMunicipiosRemovidosNaLista(repartidas, this.codigosDosMunicipiosAtuais());
  });

  private recusasDaProvaPresencial(conferida: DeclaracaoDaProvaPresencial | null) {
    const aConferir =
      conferida !== null && !mesmoConteudo(conferida, this.store.draft().provaPresencial);
    return this.publicacao
      .recusas()
      .filter(eRecusaDaProvaPresencial)
      .map((recusa) => recusaComConferencia(recusa, aConferir));
  }

  private codigosDosMunicipiosAtuais(): readonly string[] {
    return this.store.draft().provaPresencial.municipios.map((municipio) => municipio.codigoIbge);
  }
}

function incluirMunicipiosRemovidosNaLista(
  recusas: RecusasDaProvaPresencial,
  codigosAtuais: readonly string[],
): RecusasDaProvaPresencial {
  const porMunicipio = new Map(recusas.porMunicipio);
  const lista = [...recusas.lista];
  for (const [codigo, itens] of porMunicipio) {
    if (codigosAtuais.includes(codigo)) continue;
    lista.push(...itens);
    porMunicipio.delete(codigo);
  }
  return { ...recusas, lista: emOrdem(lista), porMunicipio };
}

function recusaComConferencia(recusa: RecusaDaPublicacao, aConferir: boolean): RecusaDaPublicacao {
  return { ...recusa, campo: eCampoDaProvaPresencial(recusa.campo) ? recusa.campo : '', aConferir };
}
