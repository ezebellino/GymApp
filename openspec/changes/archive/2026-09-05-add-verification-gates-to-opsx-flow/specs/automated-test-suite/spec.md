## ADDED Requirements

### Requirement: Comando único de lint para las dos apps
El repositorio SHALL exponer desde la raíz el comando `make lint`, que ejecuta el linter de
backend (Python) y el de frontend (`eslint` + chequeo de tipos de TypeScript), y SHALL terminar
con código de salida distinto de cero si cualquiera de los dos encuentra una offense. El comando
MUST reportar en su salida en qué app y en qué archivo/regla se originó cada offense encontrada.

#### Scenario: Lint limpio en ambas apps
- **WHEN** se corre `make lint` desde la raíz con el backend y el frontend sin offenses
- **THEN** la salida muestra el resultado del linter de backend y el de frontend
- **THEN** el comando termina con código de salida 0

#### Scenario: Offense de estilo en el backend
- **WHEN** el backend tiene una violación del linter Python configurado
- **THEN** `make lint` identifica el archivo y la regla de la offense
- **THEN** el comando termina con código de salida distinto de cero

#### Scenario: Offense de eslint en el frontend
- **WHEN** el frontend tiene una violación de una regla de `eslint`
- **THEN** `make lint` identifica el archivo y la regla de la offense
- **THEN** el comando termina con código de salida distinto de cero

#### Scenario: Error de tipos en el frontend
- **WHEN** el frontend tiene un error de tipos de TypeScript
- **THEN** `make lint` identifica el archivo y el error de tipos
- **THEN** el comando termina con código de salida distinto de cero

#### Scenario: El comando es descubrible
- **WHEN** un agente o desarrollador corre `make help` desde la raíz
- **THEN** ve listado `lint` con su descripción, junto a `test`, `test-backend` y `test-frontend`

#### Scenario: No requiere la app levantada
- **WHEN** se corre `make lint` sin haber ejecutado antes `make dev`, `make backend`,
  `make frontend` ni `make docker-up`
- **THEN** el linter se ejecuta igual y devuelve un resultado

## MODIFIED Requirements

### Requirement: La documentación de agentes describe la suite existente
La documentación de agentes SHALL reflejar que existe una suite ejecutable y un comando de lint:
`AGENTS.md` de raíz, `backend/AGENTS.md` y `frontend/AGENTS.md` MUST indicar cómo correr los tests
y cómo correr `make lint`, y MUST NOT seguir afirmando que el repo no tiene tests automatizados ni
que no tiene lint configurado. La skill `role-qa` MUST describir que la verificación arranca por
correr la suite, y la skill `verify-change` MUST describir que corre `make lint` y `make test`
como paso 0 antes de Code Reviewer y QA.

#### Scenario: La raíz documenta el comando de tests
- **WHEN** un agente lee el `AGENTS.md` de la raíz
- **THEN** encuentra `make test`, `make test-backend` y `make test-frontend` documentados
- **THEN** no encuentra la afirmación de que no hay test suite en el repo

#### Scenario: La raíz documenta el comando de lint
- **WHEN** un agente lee el `AGENTS.md` de la raíz
- **THEN** encuentra `make lint` documentado, incluyendo qué cubre en cada app
- **THEN** no encuentra la afirmación de que el repo no tiene lint configurado

#### Scenario: Cada app documenta su suite y su lint
- **WHEN** un agente lee `backend/AGENTS.md` o `frontend/AGENTS.md`
- **THEN** encuentra cómo correr los tests de esa app y dónde viven sus archivos de test
- **THEN** encuentra cómo correr el lint de esa app y con qué herramienta

#### Scenario: El rol QA sabe que puede ejecutar tests
- **WHEN** un agente adopta el rol `role-qa`
- **THEN** la skill le indica correr la suite automatizada como primer paso de verificación y
  reservar el "NO VERIFICABLE" para lo que la suite y la prueba manual no alcanzan
- **THEN** la skill ya no afirma que toda verificación es manual por falta de tests

#### Scenario: La skill de verificación describe el gate de lint y test
- **WHEN** un agente lee `.agents/skills/verify-change/SKILL.md`
- **THEN** encuentra que el paso 0 corre `make lint` y `make test` antes de lanzar a Code Reviewer
  y QA, y que un resultado en rojo produce veredicto FALLA sin lanzar a esos roles

#### Scenario: Sin drift entre proveedores
- **WHEN** se corre `make agents-check` después de actualizar la documentación de agentes
- **THEN** no reporta drift entre `.agents/` y los directorios generados de cada proveedor
