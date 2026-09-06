# Glosario

Términos del producto tal como se usan en estos documentos, en las specs y en la UI. Cuando
el nombre en código difiere, va entre paréntesis. Orden alfabético.

| Término | Definición | Doc |
|---|---|---|
| **Acceso** | Condición de poder loguearse: tener contraseña definida y no estar bloqueado por baja. Un usuario puede existir sin acceso. | 02 |
| **Activa / Alternativa** | Estados de una asignación de plantilla. Un miembro tiene a lo sumo una Activa y varias Alternativas. | 04 |
| **Al día** | Estado de cuota: membresía activa y pago registrado para el período actual o uno posterior. Verde. | 03 |
| **Asignación** (`RoutineAssignment`) | Vínculo entre una plantilla de rutina y un miembro, con estado, fecha, autor y la carga actual del miembro. | 04 |
| **Base** (`Exercise.base_*`) | Series × reps · kg de referencia por ejercicio del catálogo. **Deprecado**: las series viven en la plantilla. | 04 |
| **Carga actual** | Kilos y reps con los que el miembro hace hoy cada serie de cada ejercicio de su plantilla. Arranca en la referencia y avanza con las sesiones. | 04 |
| **Check-in** (`Attendance`) | Registro de que un miembro vino un día. Uno por día. | 05 |
| **Coach** (`coach`) | Rol del staff. En este MVP hereda los permisos del Dueño (D10). | 01 |
| **Completó / En sala / Sin registro** | Estado de la actividad de hoy de un miembro con check-in: finalizó sesión / check-in reciente sin sesión / check-in viejo sin sesión. | 07 |
| **Cuota** | Lo que paga un miembro por mes según su plan. Coloquial para "pago del período". | 03 |
| **De baja** (`cancelled`) | Estado de membresía desactivada. Rojo. Bloquea el login solo si el rol es Miembro. | 01, 02 |
| **Dueño** (`owner`) | Rol que administra el gimnasio. Antes llamado también "Admin"; es el mismo rol (D1). | 01 |
| **Ejercicio** (`Exercise`) | Movimiento del catálogo: nombre, descripción, video o GIF, grupo muscular, tipos de entrenamiento. | 04 |
| **En mora** | Estado de cuota: membresía activa sin pago del período actual. Amarillo. | 03 |
| **Estrategia de progresión** (`ProgressionStrategy`) | Regla (Constante, Pirámide, Invertida, Drop set, Rest-pause) que genera series desde una base. En el MVP, generador opcional del editor. | 04 |
| **Evolución** | Sección del Dashboard con series por rango y granularidad. Reemplaza a Reportes. | 07 |
| **Grupo muscular** | Lista fija: Pecho, Espalda, Hombros, Bíceps, Tríceps, Antebrazo, Core, Glúteos, Cuádriceps, Isquios, Gemelos, Cuerpo completo. | 04 |
| **Invitación** (`MemberInvitation`) | Link único de 7 días que verifica email y celular y permite definir contraseña. | 02 |
| **Membresía** (`membership_status`) | Atributo del usuario: nunca fue (`none`), activa, dada de baja. Independiente del rol. | 01, 02 |
| **Miembro** (`member`) | Rol de quien entrena y paga. Usa el portal. | 01 |
| **Pago** (`Payment`) | Registro de que un miembro pagó un período: monto, método, canal, plan y precio de referencia. | 03 |
| **Período** | Mes y año que cubre un pago. Un pago por miembro por período. | 03 |
| **Plan de membresía** | Categoría de cuota con nombre y precio vigente. General, Socio del club, Jubilado, Estudiante. | 03 |
| **Plantilla de rutina** (`RoutineTemplate`) | Programa con nombre, tipo y días propios; cada día tiene grupos musculares, ejercicios y series. | 04 |
| **Portal** | La cara del Miembro en la app web: Mi rutina, Mi progreso, Mis asistencias, Mi cuota. | 00 |
| **Precio de referencia** | Precio del plan vigente al momento de registrar un pago. Se guarda en el pago. | 03 |
| **Récord personal** | Kilo máximo histórico de un miembro en un ejercicio, con fecha. | 04 |
| **Rol** (`UserRole`) | Dueño, Coach o Miembro. Define permisos, no si entrena. | 01 |
| **Semáforo** | Indicador verde / amarillo / rojo del estado de cuota en listados y ficha. | 03 |
| **Serie** | Repeticiones y kilos de un ejercicio dentro de un día de plantilla. Se agregan y quitan una a una. | 04 |
| **Sesión** | Una vez que el miembro entrena un día de su plantilla: series realizadas y si la completó. | 04 |
| **Staff** | Dueño y Coach, en conjunto. | 01 |
| **Tipo de entrenamiento** | Lista fija: Fuerza, Hipertrofia, Resistencia, Cardio, Movilidad, Funcional, Rehabilitación. Clasifica ejercicios y plantillas. | 04 |
| **Verificación de contacto** | Marca de que el email o el celular son reales: por abrir el link del canal, o a mano por el Dueño. | 02 |
