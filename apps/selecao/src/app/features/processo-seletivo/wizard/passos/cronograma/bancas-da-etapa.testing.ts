import type { FormGroup } from '@angular/forms';
import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import { novaChave } from '../../shared/chaves/chave-local';
import type { EtapaForm } from './cronograma-form';
import type { EdicaoDaEtapa } from './servicos/edicao-da-etapa.service';

export function acrescentarBancaNaEtapa(
  edicao: EdicaoDaEtapa,
  etapa: FormGroup<EtapaForm>,
  tipoBancaId: string,
): void {
  const atuais = edicao.bancasDaEtapa(etapa);
  const tomadas = new Set(atuais.map((banca) => banca.identificadorLocal));
  edicao.escreverBancas(etapa, [...atuais, bancaNova(tipoBancaId, tomadas)]);
}

function bancaNova(tipoBancaId: string, tomadas: ReadonlySet<string>) {
  return {
    id: null,
    identificadorLocal: novaChave({ tipo: 'banca', nome: '', tomadas }),
    copiaDoTipo: null,
    tipoBancaId,
    regraDeDeliberacao: null,
  };
}

export function retirarBancaDaEtapa(
  edicao: EdicaoDaEtapa,
  etapa: FormGroup<EtapaForm>,
  chave: string,
): void {
  edicao.escreverBancas(
    etapa,
    edicao.bancasDaEtapa(etapa).filter((banca) => banca.identificadorLocal !== chave),
  );
}

export function declararRegraNaBanca(
  edicao: EdicaoDaEtapa,
  etapa: FormGroup<EtapaForm>,
  chave: string,
  regra: RegraDeDeliberacaoDaBanca | null,
): void {
  edicao.escreverBancas(
    etapa,
    edicao
      .bancasDaEtapa(etapa)
      .map((banca) =>
        banca.identificadorLocal === chave ? { ...banca, regraDeDeliberacao: regra } : banca,
      ),
  );
}
