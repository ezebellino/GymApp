## MODIFIED Requirements

### Requirement: Ver el plan calculado por serie de cada ejercicio
Para el día elegido, la vista SHALL mostrar cada ejercicio agregado a ese día de esa plantilla con
su plan de series calculado por la estrategia de progresión configurada: por cada serie, el peso
objetivo y las repeticiones objetivo, junto con cualquier anotación que corresponda ("20 s" de
pausa, "al fallo"). Un ejercicio que no esté agregado a ese día de la plantilla NO SHALL aparecer
en el plan del Miembro. El plan SHALL ser de solo lectura en este change — no SHALL incluir una
acción para marcar una serie como hecha ni un contador de series completadas.

#### Scenario: Ver el plan de un día con varios ejercicios
- **WHEN** un Miembro con la plantilla "Fuerza 4 días" ve el Día 1, con "Press banca plano" en
  estrategia Pirámide y base 4×8 · 45 kg
- **THEN** ve las cuatro series calculadas de "Press banca plano": 45 kg × 8, 47,5 kg × 6,
  50 kg × 4 y 52,5 kg × 3

#### Scenario: Un ejercicio no agregado a ese día no aparece en el plan
- **WHEN** un ejercicio no está agregado al día de la plantilla que el Miembro tiene elegida
- **THEN** ese ejercicio no aparece en el plan del día mostrado al Miembro

#### Scenario: El plan es de solo lectura
- **WHEN** un Miembro ve el plan de series de un ejercicio
- **THEN** no encuentra ninguna acción para marcar una serie como hecha ni un contador de series
  completadas de la sesión

## ADDED Requirements

### Requirement: El overview y el progreso del Miembro siguen siempre la asignación Activa
El overview y el reporte/resumen de progreso del Miembro SHALL mostrar siempre los datos de su
asignación **Activa**, sin importar cuál de sus plantillas asignadas tenga elegida en ese momento
para navegar sus días y su plan en "Mi rutina". Si el Miembro no tiene ninguna asignación Activa,
el overview y el progreso SHALL indicarlo en vez de mostrar datos de una asignación Alternativa.

#### Scenario: El overview muestra la asignación Activa aunque el Miembro esté viendo otra
- **WHEN** un Miembro tiene "Fuerza 4 días" como Activa y "Full body inicial" como Alternativa, y
  en "Mi rutina" tiene elegida "Full body inicial" para ver sus días
- **THEN** el overview y el progreso del Miembro siguen mostrando los datos de "Fuerza 4 días", su
  asignación Activa

#### Scenario: Sin asignación Activa, el overview lo indica
- **WHEN** un Miembro no tiene ninguna asignación Activa (solo tiene, o no, asignaciones
  Alternativas)
- **THEN** el overview y el progreso indican que no hay una asignación Activa, en vez de mostrar
  datos de una asignación Alternativa

### Requirement: El histórico de registros sobrevive a un ejercicio quitado de la plantilla
Quitar un ejercicio de un día de la plantilla asignada a un Miembro NO SHALL romper, ocultar ni
borrar los registros históricos que ese Miembro ya tenía cargados para ese ejercicio. Esos
registros SHALL seguir siendo consultables aunque el ejercicio ya no forme parte del plan vigente
del Miembro.

#### Scenario: Un ejercicio quitado de la plantilla no rompe el histórico del miembro
- **WHEN** un Coach quita "Aperturas con mancuernas" del día de la plantilla que un Miembro tiene
  asignada, y ese Miembro ya tenía registros históricos cargados para ese ejercicio
- **THEN** "Aperturas con mancuernas" deja de aparecer en el plan vigente que ve el Miembro
- **THEN** los registros históricos de ese Miembro para "Aperturas con mancuernas" siguen
  pudiendo consultarse, sin errores ni pérdida de datos
