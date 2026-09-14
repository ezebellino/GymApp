## Purpose

La vista "Mi rutina" del Miembro: elegir entre las plantillas que le asignaron, ver solo los días de la plantilla elegida y, por cada ejercicio activo, el plan calculado serie por serie (peso × repeticiones con anotaciones) según la estrategia y la base ajustada para ese cliente. El plan es de solo lectura; el registro serie por serie y el progreso quedan para capabilities futuras.

## Requirements

### Requirement: Elegir entre las plantillas asignadas
La vista "Mi rutina" de un Miembro SHALL mostrar únicamente las plantillas que le fueron
asignadas, y SHALL permitirle elegir cuál de ellas ver. Si el Miembro no tiene ninguna plantilla
asignada, la vista SHALL indicarlo en vez de mostrar una lista vacía sin explicación.

#### Scenario: Un Miembro con dos plantillas asignadas
- **WHEN** un Miembro con "Fuerza 4 días" (Activa) y "Full body inicial" (Alternativa) abre "Mi
  rutina"
- **THEN** ve ambas plantillas para elegir entre ellas

#### Scenario: Un Miembro sin ninguna plantilla asignada
- **WHEN** un Miembro sin ninguna plantilla asignada abre "Mi rutina"
- **THEN** el sistema le muestra un mensaje indicando que todavía no tiene una plantilla asignada,
  en vez de una sección vacía

### Requirement: Ver los días de la plantilla elegida
Al elegir una plantilla, la vista SHALL mostrar únicamente los días que esa plantilla incluye, en
el orden configurado para ella, y SHALL permitir al Miembro navegar entre esos días.

#### Scenario: Solo se ven los días de la plantilla elegida
- **WHEN** un Miembro elige la plantilla "Full body inicial", que incluye Día 1 y Día 4
- **THEN** la vista le muestra únicamente esos dos días para navegar, sin mostrar el Día 2 ni el
  Día 3

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

### Requirement: El plan refleja los ajustes de base hechos para ese cliente
El plan calculado que ve el Miembro SHALL usar, para cada ejercicio, la base ajustada para ese
cliente en particular en lugar de la base propia que ese ejercicio tiene en la plantilla, cuando
la asignación de la plantilla tenga ese ajuste.

#### Scenario: El plan usa la base ajustada para ese cliente
- **WHEN** la base de "Press banca plano" fue ajustada a 4×6 · 50 kg para un Miembro en particular
- **THEN** el plan de series que ve ese Miembro para "Press banca plano" se calcula a partir de
  4×6 · 50 kg, no de la base propia que ese ejercicio tiene en la plantilla

### Requirement: Un cambio del administrador se refleja de inmediato
La vista "Mi rutina" SHALL reflejar, la próxima vez que el Miembro la abra o la actualice, un
cambio que un Dueño o Coach haya hecho sobre la configuración de una plantilla asignada (activar
o desactivar un ejercicio, cambiar su estrategia), sin requerir ninguna acción adicional del
Miembro.

#### Scenario: Cambio de estrategia visible para el cliente
- **WHEN** un Coach cambia la estrategia de "Press banca plano" de Constante a Rest-pause en la
  plantilla que un Miembro tiene asignada, y ese Miembro vuelve a abrir "Mi rutina"
- **THEN** ve el plan de "Press banca plano" calculado con la regla de Rest-pause
