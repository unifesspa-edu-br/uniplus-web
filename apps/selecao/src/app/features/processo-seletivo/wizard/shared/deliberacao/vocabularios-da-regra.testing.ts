import { signal } from '@angular/core';
import { VocabulariosDaRegra, type OpcaoDaRegra } from './vocabularios-da-regra.service';
import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';

const listas: Record<string, readonly OpcaoDaRegra[]> = {
  modo: [
    { codigo: 'colegiadaComVotacao', rotulo: 'Colegiada, com votação' },
    { codigo: 'atoIndividual', rotulo: 'Ato individual' },
  ],
  criterio: [
    { codigo: 'maioriaSimples', rotulo: 'Maioria simples' },
    { codigo: 'maioriaAbsoluta', rotulo: 'Maioria absoluta' },
    { codigo: 'unanimidade', rotulo: 'Unanimidade' },
  ],
  desempate: [
    { codigo: 'votoDaPresidencia', rotulo: 'Voto da presidência' },
    { codigo: 'novaVotacao', rotulo: 'Nova votação' },
  ],
  encerramento: [
    { codigo: 'todosOsTitulares', rotulo: 'Todos os titulares votam' },
    { codigo: 'presidenciaNoQuorum', rotulo: 'A presidência encerra ao atingir o quórum' },
  ],
  semUnanimidade: [
    { codigo: 'favoravel', rotulo: 'Favorável' },
    { codigo: 'desfavoravel', rotulo: 'Desfavorável' },
    { codigo: 'novaVotacao', rotulo: 'Nova votação' },
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
