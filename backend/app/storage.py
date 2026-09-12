"""Puerto de object storage del catálogo de ejercicios (`exercise-catalog`, design D8).

`ObjectStorage` es el `Protocol` que separa al router de qué proveedor guarda los
archivos: `S3ObjectStorage` (boto3, sirve igual para MinIO y para el Storage Bucket
de Railway con `endpoint_url` configurable) e `InMemoryObjectStorage` (para que
`make test` corra sin red ni Docker, ver design D11). Se resuelve con la
dependencia `get_storage()` de `app/deps.py`, overrideable como `get_db`.
"""

import logging
import threading
import time
from typing import BinaryIO, Protocol

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError, EndpointConnectionError
from fastapi import HTTPException, status

from .config import settings

log = logging.getLogger("request")


class ObjectStorage(Protocol):
    """Puerto que separa al router del proveedor de storage real."""

    def put_object(self, key: str, fileobj: BinaryIO, content_type: str) -> None: ...

    def delete_object(self, key: str) -> None:
        """Idempotente: borrar una key que no existe no es un error."""
        ...

    def presigned_get_url(self, key: str) -> str:
        """Sin red (design D3): puro HMAC local, no contacta al bucket."""
        ...


class InMemoryObjectStorage:
    """Adaptador de test/dev sin red (design D11). `objects` queda expuesto para que
    los tests puedan afirmar sobre su contenido (`assert key in storage.objects`)."""

    def __init__(self, bucket: str = "gymapp-media") -> None:
        self.bucket = bucket
        self.objects: dict[str, tuple[bytes, str]] = {}

    def put_object(self, key: str, fileobj: BinaryIO, content_type: str) -> None:
        self.objects[key] = (fileobj.read(), content_type)

    def delete_object(self, key: str) -> None:
        self.objects.pop(key, None)

    def presigned_get_url(self, key: str) -> str:
        # Expiración cuantizada, igual criterio que `S3ObjectStorage` (design D3):
        # no hace falta que sea una firma real, solo que sea determinística dentro
        # de la ventana para no romper la caché del browser en los tests.
        window = settings.STORAGE_URL_WINDOW_SECONDS or 1
        quantized_exp = (int(time.time()) // window + 1) * window
        return f"memory://{self.bucket}/{key}?exp={quantized_exp}"


class S3ObjectStorage:
    """Adaptador real sobre boto3 (design D8). `endpoint_url` configurable: el mismo
    código sirve para MinIO (dev/Docker) y para el Storage Bucket de Railway (prod).

    Dos clientes de boto3 (design D3.1): uno de **operaciones** (`put_object` /
    `delete_object`), contra el endpoint con el que el backend **habla** de verdad,
    y uno de **firma** (`generate_presigned_url`), contra el endpoint que tiene que
    poder resolver el browser. En Compose son distintos (`http://minio:9000` vs
    `http://localhost:9000`); en todo el resto de los entornos coinciden y se reusa
    el mismo cliente. El cliente de firma nunca hace I/O — presignar es HMAC local
    — así que da igual que su endpoint sea inalcanzable desde el contenedor.
    **Nunca** reescribir el host de una URL ya firmada: SigV4 firma `host` dentro de
    `SignedHeaders` y el resultado sería una firma inválida (403 de MinIO/S3).
    """

    def __init__(
        self,
        *,
        bucket: str,
        endpoint_url: str | None,
        public_endpoint_url: str | None = None,
        region: str,
        access_key_id: str,
        secret_access_key: str,
        use_path_style: bool,
        url_ttl_seconds: int,
        url_window_seconds: int,
    ) -> None:
        self.bucket = bucket
        self.url_ttl_seconds = url_ttl_seconds
        self.url_window_seconds = url_window_seconds

        def _make_client(endpoint: str | None):
            return boto3.client(
                "s3",
                endpoint_url=endpoint or None,
                region_name=region,
                aws_access_key_id=access_key_id or None,
                aws_secret_access_key=secret_access_key or None,
                config=BotoConfig(
                    signature_version="s3v4",
                    s3={"addressing_style": "path" if use_path_style else "virtual"},
                ),
            )

        self._client = _make_client(endpoint_url)
        # Vacío ⇒ cae al endpoint interno (design D3.1): solo Compose los difiere.
        if public_endpoint_url and public_endpoint_url != endpoint_url:
            self._sign_client = _make_client(public_endpoint_url)
        else:
            self._sign_client = self._client

        # Rehecho tras H4/A3 (verificación): la implementación anterior
        # monkeypatcheaba `botocore.auth.get_current_datetime` (un atributo de
        # módulo **global**, compartido por todo el proceso) para forzar el
        # reloj de la firma a un instante cuantizado. `original =
        # botocore_auth.get_current_datetime` se leía **fuera** del
        # `with _presign_clock_lock`, así que dos hilos podían intercalarse:
        # el hilo B leía esa línea mientras el hilo A tenía el parche puesto,
        # capturaba el lambda de A como "el original" y al salir de su propio
        # `finally` restauraba el módulo a ese lambda — dejando
        # `get_current_datetime` congelado para siempre, hasta reiniciar el
        # proceso (reproducido con 8 hilos contra el threadpool sync de
        # FastAPI). Pasados 15 minutos, toda firma nueva quedaba con un
        # `X-Amz-Date` vencido y S3/MinIO empezaba a devolver
        # `RequestTimeTooSkewed` (403) en cualquier operación firmada,
        # incluidas `put_object`/`delete_object` de este mismo cliente.
        #
        # Se memoiza la URL, no el reloj: nunca se toca un interno de boto3/
        # botocore y no hay estado global mutable. `_presigned_cache` guarda
        # `(key, índice de ventana) -> URL ya firmada`; en un miss se firma una
        # sola vez con el reloj real (`generate_presigned_url` sin parchear
        # nada) y `ExpiresIn = ttl + window` (constante, no depende de en qué
        # segundo de la ventana se firmó). El resultado se cachea entero, así
        # que toda llamada posterior dentro de la misma ventana devuelve la
        # URL **idéntica byte a byte**, en vez de recalcular una firma que
        # variaría por `X-Amz-Date`. El desalojo descarta las entradas de
        # cualquier ventana que no sea la actual — con un solo worker de
        # uvicorn (`backend/Dockerfile`), el caché por proceso alcanza.
        self._presigned_cache: dict[tuple[str, int], str] = {}
        self._presigned_cache_lock = threading.Lock()

    def put_object(self, key: str, fileobj: BinaryIO, content_type: str) -> None:
        try:
            self._client.upload_fileobj(
                fileobj, self.bucket, key, ExtraArgs={"ContentType": content_type}
            )
        except (ClientError, EndpointConnectionError) as exc:
            log.warning("storage.put_object failed key=%s error=%s", key, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo guardar el archivo, probá de nuevo",
            ) from exc

    def delete_object(self, key: str) -> None:
        # Best-effort (design D6): un borrado de storage fallido nunca se convierte
        # en un 500 de una operación que ya se commiteó.
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
        except (ClientError, EndpointConnectionError) as exc:
            log.warning("storage.delete_object failed key=%s error=%s", key, exc)

    def presigned_get_url(self, key: str) -> str:
        # Expiración cuantizada a `url_window_seconds` (design D3): la misma key
        # produce una URL idéntica dentro de la ventana, para no romper la caché
        # HTTP del browser. Presignar no hace red: es puro HMAC local, por eso el
        # cliente de firma puede tener un endpoint inalcanzable desde acá (D3.1).
        #
        # Memoiza la URL, no el reloj (rehecho tras H4/A3, ver el comentario en
        # `__init__`): el índice de ventana identifica la caché, y dentro de esa
        # ventana toda llamada para la misma key devuelve la URL ya firmada, sin
        # tocar ningún interno de botocore.
        window = self.url_window_seconds or 1
        now = int(time.time())
        window_index = now // window
        cache_key = (key, window_index)

        with self._presigned_cache_lock:
            cached = self._presigned_cache.get(cache_key)
        if cached is not None:
            return cached

        # `ExpiresIn` constante (D3): no depende de en qué segundo de la
        # ventana se firma, así que el instante efectivo de expiración queda
        # acotado a "TTL + hasta una ventana" sin importar cuándo se generó.
        expires_in = self.url_ttl_seconds + window
        url = self._sign_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

        with self._presigned_cache_lock:
            # Desalojo: se descarta cualquier entrada de una ventana que no sea
            # la actual, en vez de llevar un TTL por entrada — con un solo
            # worker de uvicorn (`backend/Dockerfile`) alcanza y mantiene el
            # dict acotado sin un hilo de limpieza aparte.
            self._presigned_cache = {
                k: v for k, v in self._presigned_cache.items() if k[1] == window_index
            }
            self._presigned_cache[cache_key] = url
        return url


def build_storage() -> ObjectStorage:
    """Construye el adaptador según `STORAGE_BACKEND`. Sin `lru_cache` acá: lo cachea
    `get_storage()` en `app/deps.py`, que es donde se puede overridear en tests."""
    if settings.STORAGE_BACKEND == "memory":
        return InMemoryObjectStorage(bucket=settings.STORAGE_BUCKET)
    return S3ObjectStorage(
        bucket=settings.STORAGE_BUCKET,
        endpoint_url=settings.STORAGE_ENDPOINT_URL,
        public_endpoint_url=settings.STORAGE_PUBLIC_ENDPOINT_URL,
        region=settings.STORAGE_REGION,
        access_key_id=settings.STORAGE_ACCESS_KEY_ID,
        secret_access_key=settings.STORAGE_SECRET_ACCESS_KEY,
        use_path_style=settings.STORAGE_USE_PATH_STYLE,
        url_ttl_seconds=settings.STORAGE_URL_TTL_SECONDS,
        url_window_seconds=settings.STORAGE_URL_WINDOW_SECONDS,
    )
