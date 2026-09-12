"""Test del adaptador real de storage (`exercise-catalog`, design D3/D11):
demuestra que "presignar no hace red" es cierto y que el adaptador está bien
cableado, sin abrir un socket. El resto de la suite corre contra
`InMemoryObjectStorage` (ver `tests/conftest.py`, fixture `storage`)."""

import datetime
from contextlib import ExitStack
from unittest.mock import patch

from app.storage import S3ObjectStorage


def _frozen_at(*timestamps: float) -> ExitStack:
    """Congela, para la duración del `with`, tanto `time.time()` (lo que usa
    `S3ObjectStorage` para el índice de ventana, A3/H4) como el reloj de firma
    de botocore (`botocore.auth.get_current_datetime`, lo que mete SigV4 en
    `X-Amz-Date`) a la MISMA secuencia de instantes reales. Sin esto, `time.time`
    quedaría mockeado pero el `X-Amz-Date` seguiría saliendo del reloj real del
    proceso: dos firmas hechas en el mismo segundo real darían la misma
    signature sin importar a qué ventana lógica se las quiera atribuir, así que
    la prueba de "cambia de ventana" no probaría nada. Esto es un detalle de
    ESTE test, no de producción: `S3ObjectStorage` ya no toca
    `botocore.auth.get_current_datetime` (ver el comentario de A3 en
    `app/storage.py` sobre por qué eso era el bug)."""
    datetimes = [
        datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).replace(tzinfo=None)
        for ts in timestamps
    ]
    stack = ExitStack()
    stack.enter_context(patch("app.storage.time.time", side_effect=list(timestamps)))
    stack.enter_context(
        patch(
            "botocore.auth.get_current_datetime",
            side_effect=lambda remove_tzinfo=True: datetimes.pop(0),
        )
    )
    return stack


def test_s3_object_storage_presigna_sin_red():
    storage = S3ObjectStorage(
        bucket="gymapp-media",
        endpoint_url="http://localhost:9000",
        region="us-east-1",
        access_key_id="fake-access-key",
        secret_access_key="fake-secret-key",
        use_path_style=True,
        url_ttl_seconds=3600,
        url_window_seconds=900,
    )

    url = storage.presigned_get_url("exercises/ex-1/demo.mp4")

    assert "X-Amz-Signature" in url
    assert "gymapp-media" in url
    assert "exercises/ex-1/demo.mp4" in url


def test_presigna_contra_el_endpoint_publico_y_opera_contra_el_interno():
    storage = S3ObjectStorage(
        bucket="gymapp-media",
        endpoint_url="http://minio:9000",
        public_endpoint_url="http://localhost:9000",
        region="us-east-1",
        access_key_id="fake-access-key",
        secret_access_key="fake-secret-key",
        use_path_style=True,
        url_ttl_seconds=3600,
        url_window_seconds=900,
    )

    # A3/H4 (verificación): las dos llamadas tienen que separarse de verdad en
    # el tiempo para probar la propiedad. Hacerlas back-to-back (dentro del
    # mismo segundo) dejaba pasar el bug original: SigV4 mete `X-Amz-Date` (el
    # instante de la firma) en la query, así que sin memoizar la URL entera la
    # firma cambiaría cada segundo aunque la expiración cuantizada fuera
    # estable. Acá se simulan 1,2 s de diferencia real, sin cruzar el borde de
    # la ventana de 900 s: la segunda llamada tiene que pegarle a la caché y
    # devolver la URL de la primera **sin volver a firmar**.
    window_start = 1_800_000_000  # múltiplo exacto de 900, para fijar el borde
    with _frozen_at(window_start + 10.0, window_start + 11.2):
        url_1 = storage.presigned_get_url("exercises/ex-1/demo.mp4")
        url_2 = storage.presigned_get_url("exercises/ex-1/demo.mp4")

    assert url_1.startswith("http://localhost:9000/")
    assert "minio:9000" not in url_1
    assert url_1 == url_2

    # Y cruzando a la ventana siguiente, la URL sí tiene que cambiar (si no, la
    # cuantización no estaría haciendo nada y el TTL efectivo sería infinito).
    # Con una key distinta se evita que la entrada ya cacheada arriba (misma
    # ventana de `window_start`) contamine esta prueba.
    with _frozen_at(window_start + 10.0, window_start + 900.0):
        url_before = storage.presigned_get_url("exercises/ex-2/demo.mp4")
        url_after = storage.presigned_get_url("exercises/ex-2/demo.mp4")

    assert url_before != url_after
