import { signal } from '@angular/core';
import { VocabulariosDaRegra, type OpcaoDaRegra } from './vocabularios-da-regra.service';
import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';

const listas: Record<string, readonly OpcaoDaRegra[]> = {
  modo: [
    { codigo: 'COLEGIADA_COM_VOTACAO', rotulo: 'Colegiada, com votação' },
    { codigo: 'ATO_INDIVIDUAL', rotulo: 'Ato individual' },
  ],
  criterio: [
    { codigo: 'MAIORIA_SIMPLES', rotulo: 'Maioria simples' },
    { codigo: 'MAIORIA_ABSOLUTA', rotulo: 'Maioria absoluta' },
    { codigo: 'UNANIMIDADE', rotulo: 'Unanimidade' },
  ],
  desempate: [
    { codigo: 'VOTO_DA_PRESIDENCIA', rotulo: 'Voto da presidência' },
    { codigo: 'NOVA_VOTACAO', rotulo: 'Nova votação' },
  ],
  encerramento: [
    { codigo: 'TODOS_OS_TITULARES', rotulo: 'Todos os titulares votam' },
    { codigo: 'PRESIDENCIA_NO_QUORUM', rotulo: 'A presidência encerra ao atingir o quórum' },
  ],
  semUnanimidade: [
    { codigo: 'FAVORAVEL', rotulo: 'Favorável' },
    { codigo: 'DESFAVORAVEL', rotulo: 'Desfavorável' },
    { codigo: 'NOVA_VOTACAO', rotulo: 'Nova votação' },
  ],
};

const lista = (campo: string) => signal({ situacao: 'pronta', opcoes: listas[campo] });

export function comRotulos(regra: RegraDeDeliberacaoDaBanca): RegraDeDeliberacaoDaBanca {
  const campos = ['modo', 'criterio', 'desempate', 'encerramento', 'semUnanimidade'] as const;
  const rotulos = Object.fromEntries(
    campos.flatMap((campo) => {
      const opcao = listas[campo].find((item) => item.codigo === regra[campo]);
      return opcao ? [[campo, opcao]] : [];
    }),
  );
  return { ...regra, rotulos };
}

function vocabulariosDisponiveis() {
  return {
    recarregarIndisponiveis: () => undefined,
    pronta: signal(true),
    indisponivel: signal(false),
    modos: lista('modo'),
    criterios: lista('criterio'),
    desempates: lista('desempate'),
    encerramentos: lista('encerramento'),
    resultados: lista('semUnanimidade'),
    opcao: (campo: string, codigo: string) =>
      listas[campo]?.find((opcao) => opcao.codigo === codigo),
  };
}

export function fornecerVocabulariosDaRegra() {
  return { provide: VocabulariosDaRegra, useValue: vocabulariosDisponiveis() };
}
