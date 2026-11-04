import { CatalogoDeAtos } from './catalogo-de-atos.service';
import { CatalogoDeBancas } from './catalogo-de-bancas.service';
import { CatalogoDeDocumentos } from './catalogo-de-documentos.service';
import { CatalogoDeFases } from './catalogo-de-fases.service';
import { CatalogoDeFatos } from './catalogo-de-fatos.service';
import { CatalogoDeRegras } from './catalogo-de-regras.service';
import { CatalogoDeTiposDeEtapa } from './catalogo-de-tipos-de-etapa.service';
import { CatalogoDeUnidadesDoCadastro } from './catalogo-de-unidades-do-cadastro.service';
import { SituacaoDosCatalogosDoCronograma } from './situacao-dos-catalogos-do-cronograma.service';

/** Os provedores dos catálogos que o cronograma e a configuração de cada fase leem, na página do wizard. */
export const CATALOGOS_DO_CRONOGRAMA = [
  CatalogoDeAtos,
  CatalogoDeBancas,
  CatalogoDeDocumentos,
  CatalogoDeFases,
  CatalogoDeFatos,
  CatalogoDeRegras,
  CatalogoDeTiposDeEtapa,
  CatalogoDeUnidadesDoCadastro,
  SituacaoDosCatalogosDoCronograma,
];
