"""Tests de la media del catálogo de ejercicios (`exercise-catalog`, design D3/D4/
D5/D6): subida con validación de formato y tamaño, ciclo de vida del objeto
(reemplazo, desactivar, borrar) y la prioridad archivo propio > URL externa.

Corre contra `InMemoryObjectStorage` (fixture `storage` de `conftest.py`, design
D11): nunca abre un socket. Un PNG "falso" (los 8 bytes de firma + relleno)
alcanza para pasar el sniff de magic bytes de `exercises.py` sin necesitar un
archivo real.
"""

from fastapi import HTTPException, status

from tests.helpers import OWNER_EMAIL

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _fake_png(filler: bytes = b"0") -> bytes:
    return _PNG_SIGNATURE + filler * 32


def _create_exercise(client, headers, **overrides):
    payload = {"name": "Ejercicio con media"}
    payload.update(overrides)
    response = client.post("/exercises/", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def _upload(client, headers, exercise_id, *, filename="demo.png", content=None, content_type="image/png"):
    return client.post(
        f"/exercises/{exercise_id}/media",
        files={"file": (filename, content or _fake_png(), content_type)},
        headers=headers,
    )


# --- Subida (task 6.7) -------------------------------------------------------


def test_subir_archivo_guarda_la_key_y_devuelve_url_prefirmada(client, owner_user, auth_header, storage):
    headers = auth_header(OWNER_EMAIL)
    exercise = _create_exercise(client, headers, name="Ejercicio con archivo (test)")

    response = _upload(client, headers, exercise["id"])

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["media_kind"] == "file"
    assert body["media_file_url"]
    assert body["media_content_type"] == "image/png"

    stored_keys = [key for key in storage.objects if key.startswith(f"exercises/{exercise['id']}/")]
    assert len(stored_keys) == 1


def test_subir_archivo_mas_grande_que_el_limite_devuelve_413_y_no_escribe_en_storage(
    client, owner_user, auth_header, storage, monkeypatch
):
    from app.routers import exercises as exercises_router

    monkeypatch.setattr(exercises_router.settings, "STORAGE_MAX_UPLOAD_BYTES", 10)
    headers = auth_header(OWNER_EMAIL)
    exercise = _create_exercise(client, headers, name="Ejercicio con limite (test)")

    response = _upload(client, headers, exercise["id"], content=_fake_png(b"0" * 2000))

    assert response.status_code == 413, response.text
    assert storage.objects == {}


def test_archivo_de_exactamente_el_limite_se_acepta(
    client, owner_user, auth_header, storage, monkeypatch
):
    """Task 12.11 (H7, design D4.1): la implementación anterior chequeaba
    `Content-Length` contra el límite, y ese header del multipart incluye los
    boundaries — un archivo de exactamente `STORAGE_MAX_UPLOAD_BYTES` se
    rechazaba por unos cientos de bytes de overhead que no eran del archivo.
    La reescrita (task 12.10) usa `file.size`, que es exacto, así que un
    archivo de exactamente el límite se acepta."""
    from app.routers import exercises as exercises_router

    limit = len(_fake_png())
    monkeypatch.setattr(exercises_router.settings, "STORAGE_MAX_UPLOAD_BYTES", limit)
    headers = auth_header(OWNER_EMAIL)
    exercise = _create_exercise(client, headers, name="Ejercicio en el limite exacto (test)")

    response = _upload(client, headers, exercise["id"], content=_fake_png())

    assert response.status_code == 200, response.text
    assert response.json()["media_kind"] == "file"


def test_subir_formato_no_permitido_devuelve_415_y_conserva_la_media_anterior(
    client, owner_user, auth_header, storage
):
    headers = auth_header(OWNER_EMAIL)
    exercise = _create_exercise(client, headers, name="Ejercicio con media previa (test)")
    first = _upload(client, headers, exercise["id"])
    assert first.status_code == 200, first.text
    previous_media_url = first.json()["media_file_url"]

    response = _upload(
        client,
        headers,
        exercise["id"],
        filename="documento.pdf",
        content=b"%PDF-1.4 no es un formato soportado",
        content_type="application/pdf",
    )

    assert response.status_code == 415, response.text
    unchanged = client.get(f"/exercises/{exercise['id']}", headers=headers).json()
    assert unchanged["media_kind"] == "file"
    assert unchanged["media_file_url"] == previous_media_url


# --- Ciclo de vida del objeto (task 6.8, design D6) --------------------------


def test_reemplazar_el_archivo_borra_el_objeto_anterior_despues_del_commit(
    client, owner_user, auth_header, storage
):
    headers = auth_header(OWNER_EMAIL)
    exercise = _create_exercise(client, headers, name="Ejercicio a reemplazar (test)")

    _upload(client, headers, exercise["id"], filename="uno.png", content=_fake_png(b"1"))
    assert len(storage.objects) == 1
    old_key = next(iter(storage.objects))

    second = _upload(client, headers, exercise["id"], filename="dos.png", content=_fake_png(b"2"))

    assert second.status_code == 200, second.text
    assert old_key not in storage.objects
    assert len(storage.objects) == 1


def test_desactivar_ejercicio_no_borra_el_objeto_del_storage(client, owner_user, auth_header, storage):
    headers = auth_header(OWNER_EMAIL)
    exercise = _create_exercise(client, headers, name="Ejercicio con demo (test)")
    _upload(client, headers, exercise["id"])
    assert len(storage.objects) == 1

    response = client.post(f"/exercises/{exercise['id']}/deactivate", headers=headers)

    assert response.status_code == 200, response.text
    assert len(storage.objects) == 1


def test_borrar_ejercicio_con_archivo_propio_elimina_el_objeto_del_storage(
    client, owner_user, auth_header, storage
):
    headers = auth_header(OWNER_EMAIL)
    exercise = _create_exercise(client, headers, name="Ejercicio borrable con media (test)")
    _upload(client, headers, exercise["id"])
    assert len(storage.objects) == 1

    response = client.delete(f"/exercises/{exercise['id']}", headers=headers)

    assert response.status_code == 204, response.text
    assert storage.objects == {}


# --- Prioridad y falla (task 6.9) --------------------------------------------


def test_archivo_propio_tiene_prioridad_sobre_la_url_externa_en_media_kind(
    client, owner_user, auth_header, storage
):
    headers = auth_header(OWNER_EMAIL)
    exercise = _create_exercise(
        client,
        headers,
        name="Ejercicio con los dos (test)",
        external_media_url="https://youtube.com/watch?v=xyz",
    )

    response = _upload(client, headers, exercise["id"])

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["media_kind"] == "file"
    assert body["external_media_url"] == "https://youtube.com/watch?v=xyz"


def test_quitar_el_archivo_propio_deja_la_url_externa_como_principal(
    client, owner_user, auth_header, storage
):
    headers = auth_header(OWNER_EMAIL)
    exercise = _create_exercise(
        client,
        headers,
        name="Ejercicio con reemplazo de media (test)",
        external_media_url="https://youtube.com/watch?v=xyz",
    )
    _upload(client, headers, exercise["id"])

    response = client.delete(f"/exercises/{exercise['id']}/media", headers=headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["media_kind"] == "external"
    assert body["external_media_url"] == "https://youtube.com/watch?v=xyz"
    assert storage.objects == {}


def test_fallo_del_storage_al_subir_devuelve_502_y_conserva_el_archivo_anterior(
    client, owner_user, auth_header, storage
):
    headers = auth_header(OWNER_EMAIL)
    exercise = _create_exercise(client, headers, name="Ejercicio con fallo de storage (test)")
    first = _upload(client, headers, exercise["id"], filename="uno.png", content=_fake_png(b"1"))
    assert first.status_code == 200, first.text
    previous_media_url = first.json()["media_file_url"]

    def _boom(*args, **kwargs):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "No se pudo guardar el archivo, probá de nuevo"
        )

    storage.put_object = _boom

    response = _upload(client, headers, exercise["id"], filename="dos.png", content=_fake_png(b"2"))

    assert response.status_code == 502, response.text
    unchanged = client.get(f"/exercises/{exercise['id']}", headers=headers).json()
    assert unchanged["media_file_url"] == previous_media_url
