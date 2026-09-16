## MODIFIED Requirements

### Requirement: Eliminación de una plantilla sin asignaciones
Un Dueño o Coach SHALL poder eliminar una plantilla únicamente si no tiene ninguna copia asignada en estado **Activo** a ningún Miembro. Si la plantilla tiene al menos una copia Activa, el sistema SHALL rechazar la eliminación indicando cuántos miembros la tienen asignada como Activa. Una plantilla cuyas únicas copias asignadas estén en estado Alternativa SHALL poder eliminarse: esas copias y su histórico de progreso SHALL sobrevivir intactos, dejando de depender de la plantilla eliminada.

#### Scenario: Eliminar una plantilla sin ninguna asignación
- **WHEN** un Dueño elimina una plantilla que no tiene ninguna copia asignada a ningún Miembro
- **THEN** el sistema la elimina

#### Scenario: Rechazar la eliminación de una plantilla con una copia Activa
- **WHEN** un Coach intenta eliminar la plantilla "Fuerza 4 días", que 2 Miembros tienen como copia
  Activa
- **THEN** el sistema rechaza la eliminación e indica que 2 miembros la tienen asignada como Activa

#### Scenario: Eliminar una plantilla cuyas únicas copias son Alternativas
- **WHEN** un Dueño elimina la plantilla "Full body inicial", de la que solo existen copias en
  estado Alternativa (ningún Miembro la tiene como Activa)
- **THEN** el sistema elimina la plantilla
- **THEN** las copias Alternativas que se habían originado de "Full body inicial", y el progreso
  que sus Miembros ya registraron contra ellas, se conservan intactos
