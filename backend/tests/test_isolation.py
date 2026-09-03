"""Guarda la red de seguridad que aisla la suite de la base real.

`conftest.py` pisa `DATABASE_URL` antes de importar la app justamente para que el
engine del modulo no pueda apuntar a la base de desarrollo ni a la de produccion.
Ese contrato se rompio una vez de forma silenciosa: un `from tests.conftest import`
cargaba el conftest por segunda vez, corria otro `mkdtemp()` y dejaba la variable de
entorno apuntando a un SQLite distinto del que el engine usaba. Estos tests fallan si
vuelve a pasar.

A proposito no se importa nada de `conftest`: la comparacion se hace contra
`os.environ`, que es la fuente que el conftest pisa.
"""

import os

import app.database


def test_database_url_coincide_con_el_engine_de_la_app():
    assert str(app.database.engine.url) == os.environ["DATABASE_URL"]


def test_el_engine_de_la_app_no_apunta_a_postgres():
    assert app.database.engine.url.get_backend_name() == "sqlite"
