## ADDED Requirements

### Requirement: Elegir ejercicios para un día sin ninguno disponible en el catálogo
El sistema SHALL mostrar, al componer un día de una plantilla cuyo grupo muscular no tiene ningún
ejercicio disponible en el catálogo (porque no se cargó ninguno, o porque los que había se
desactivaron o se borraron), el texto "Todavía no hay ejercicios cargados para este día. Cargalos
desde el catálogo de ejercicios." junto con una acción **"Ir a Ejercicios"** que navega a la
pantalla del catálogo, en vez de una lista de opciones vacía sin contexto. Esto no afecta a los
ejercicios que la plantilla ya tenía agregados antes de que el catálogo quedara sin opciones
nuevas: esos SHALL seguir mostrándose y contando para el plan del cliente sin cambios.

#### Scenario: Sin ejercicios disponibles para agregar a un día
- **WHEN** un Dueño edita la plantilla "Fuerza 4 días" y abre el selector de ejercicios para el
  Día 3 ("Hombros"), y el catálogo no tiene ningún ejercicio activo con grupo muscular "Hombros"
- **THEN** el selector muestra "Todavía no hay ejercicios cargados para este día. Cargalos desde
  el catálogo de ejercicios." y la acción "Ir a Ejercicios", en vez de una lista vacía

#### Scenario: Una plantilla con ejercicios ya agregados sigue funcionando aunque el catálogo quede sin opciones nuevas
- **WHEN** "Fuerza 4 días" ya tiene "Press militar con barra" agregado y activo en el Día 3, y
  después se desactivan todos los demás ejercicios de "Hombros" del catálogo
- **THEN** "Press militar con barra" sigue apareciendo activo en el Día 3 de la plantilla y en el
  plan del cliente, aunque el selector no ofrezca otro ejercicio de "Hombros" para agregar
