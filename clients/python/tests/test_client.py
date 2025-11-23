import os
import time
import uuid
from typing import Iterator

import pytest

from fluxiondb_client import ApiKeyScope, FluxionDBClient
from fluxiondb_client.exceptions import FluxionDBConnectionError, FluxionDBError


def _unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def client() -> Iterator[FluxionDBClient]:
    url = os.environ.get("FLUXIONDB_URL", "ws://fluxiondb:8080")
    api_key = os.environ.get("FLUXIONDB_API_KEY", "dev-secret")
    print(f"[setup] connecting to FluxionDB at {url} with api key '{api_key}'")
    sdk = FluxionDBClient(
        url=url,
        api_key=api_key,
        connection_name="python-tests",
        show_logs=True,
    )
    try:
        sdk.connect()
    except (FluxionDBConnectionError, FluxionDBError, OSError) as exc:
        pytest.skip(f"FluxionDB server unavailable: {exc}")
    print("[setup] connection established")
    yield sdk
    print("[teardown] closing connection")
    sdk.close()


def test_insert_and_query_records(client: FluxionDBClient) -> None:
    col = _unique("sensors2")
    doc = _unique("device")
    now = int(time.time())
    client.insert_multiple_records(
        [
            {"ts": now - 1, "doc": doc, "data": '{"temp":20}', "col": col},
            {"ts": now, "doc": doc, "data": '{"temp":21}', "col": col},
        ]
    )
    print(f"[records] inserted data into {col}/{doc}")

    latest = client.fetch_latest_records({"col": col, "ts": now + 5, "doc": doc})
    assert doc in latest
    assert latest[doc]["ts"] == now
    assert latest[doc]["data"] == '{"temp":21}'

    history = client.fetch_document(
        {
            "col": col,
            "doc": doc,
            "from": now - 10,
            "to": now + 10,
        }
    )
    assert len(history) == 2
    assert max(history, key=lambda item: item["ts"])["data"] == '{"temp":21}'
    print(f"[records] verified history for {col}/{doc}")


def test_key_value_round_trip(client: FluxionDBClient) -> None:
    col = _unique("config")
    key = _unique("key")
    value = '{"feature":"on"}'

    client.set_value({"col": col, "key": key, "value": value})
    assert client.get_value({"col": col, "key": key}) == value
    print(f"[kv] stored value {key} in {col}")

    values = client.get_values({"col": col})
    assert values[key] == value

    client.delete_value({"col": col, "key": key})
    remaining = client.get_values({"col": col})
    assert key not in remaining
    print(f"[kv] removed value {key} from {col}")


def test_manage_api_keys(client: FluxionDBClient) -> None:
    temp_key = _unique("py-sdk")
    scope: ApiKeyScope = "readonly"
    add_resp = client.add_api_key(temp_key, scope)
    assert add_resp.get("status") == "ok"
    print(f"[keys] added temp API key {temp_key}")

    remove_resp = client.remove_api_key(temp_key)
    assert remove_resp.get("status") == "ok"
    print(f"[keys] removed temp API key {temp_key}")


def test_get_connections_lists_self(client: FluxionDBClient) -> None:
    connections = client.get_connections()
    assert isinstance(connections, list)
    assert any(conn.get("self") for conn in connections)
    print(f"[conn] active connections: {connections}")
