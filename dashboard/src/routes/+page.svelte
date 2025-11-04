<script lang="ts">
    import { RotateCcw, Search, Trash2 } from "lucide-svelte";
    import { onMount } from "svelte";

    let { data }: { data: { collections: string[] } } = $props();

    let collections = $state<string[]>(
        data.collections ? [...data.collections].sort((a, b) => a.localeCompare(b)) : []
    );

    let selectedCollection = $state<string | null>((data.collections && data.collections[0]) ?? null);
    let selectedDocument = $state<string | null>(null);

    let collectionSearch = $state("");
    let documentSearch = $state("");

    let documents = $state<string[]>([]);
    let records = $state<Array<{ ts: number; data: string }>>([]);

    let documentsLoading = $state(false);

    let documentsError = $state<string | null>(null);
    let recordsError = $state<string | null>(null);

    let collectionsLoading = $state(false);

    let collectionsRequestToken = 0;
    let documentsRequestToken = 0;
    let recordsRequestToken = 0;

    type ConfirmState =
        | { action: "collection"; name: string }
        | { action: "document"; name: string; collection: string };

    let confirmState = $state<ConfirmState | null>(null);
    let confirmInput = $state("");
    let confirmLoading = $state(false);
    let confirmError = $state<string | null>(null);
    let confirmInputRef = $state<HTMLInputElement | null>(null);

    let filteredCollections = $derived(
        collections.filter((collection) => collection.toLowerCase().includes(collectionSearch.trim().toLowerCase()))
    );

    let filteredDocuments = $derived(
        documents.filter((document) => document.toLowerCase().includes(documentSearch.trim().toLowerCase()))
    );

    async function fetchJSON<T>(url: string): Promise<T> {
        const response = await fetch(url);
        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || `Request failed with status ${response.status}`);
        }
        return response.json() as Promise<T>;
    }

    async function refreshCollections() {
        const requestToken = ++collectionsRequestToken;
        collectionsLoading = true;
        try {
            const { collections: cols } = await fetchJSON<{ collections: string[] }>("/api/collections");
            if (collectionsRequestToken !== requestToken) {
                return;
            }

            collections = (cols ?? []).slice().sort((a, b) => a.localeCompare(b));

            if (collections.length === 0) {
                selectedCollection = null;
                selectedDocument = null;
                documents = [];
                records = [];
                return;
            }

            if (!selectedCollection || !collections.includes(selectedCollection)) {
                selectedCollection = collections[0];
            }

            if (selectedCollection) {
                await loadDocuments(selectedCollection);
            }
        } catch (error) {
            if (collectionsRequestToken !== requestToken) {
                return;
            }
            console.error(error);
            alert("Failed to refresh collections. Please try again.");
        } finally {
            if (collectionsRequestToken === requestToken) {
                collectionsLoading = false;
            }
        }
    }

    async function refreshDocuments() {
        if (!selectedCollection) {
            return;
        }
        await loadDocuments(selectedCollection);
    }

    async function loadDocuments(collection: string) {
        if (!collection) {
            documents = [];
            return;
        }

        const requestToken = ++documentsRequestToken;
        documentsLoading = true;
        documentsError = null;

        try {
            const { documents: docs } = await fetchJSON<{ documents: string[] }>(
                `/api/collections/${encodeURIComponent(collection)}/documents`
            );

            if (documentsRequestToken !== requestToken || selectedCollection !== collection) {
                return;
            }

            documents = (docs ?? []).slice().sort((a, b) => a.localeCompare(b));

            if (documents.length === 0) {
                selectedDocument = null;
                records = [];
                return;
            }

            if (!selectedDocument || !documents.includes(selectedDocument)) {
                selectedDocument = documents[0];
            }

            if (selectedDocument) {
                await loadRecords(collection, selectedDocument);
            }
        } catch (error) {
            if (documentsRequestToken !== requestToken || selectedCollection !== collection) {
                return;
            }
            console.error(error);
            documentsError = error instanceof Error ? error.message : "Failed to load documents";
            documents = [];
            selectedDocument = null;
            records = [];
        } finally {
            if (documentsRequestToken === requestToken) {
                documentsLoading = false;
            }
        }
    }

    async function loadRecords(collection: string, document: string) {
        if (!collection || !document) {
            records = [];
            return;
        }

        const requestToken = ++recordsRequestToken;
        recordsError = null;

        try {
            const nowSeconds = Math.floor(Date.now() / 1000);
            const params = new URLSearchParams();

            params.set("to", nowSeconds.toString());
            params.set("limit", "50");
            params.set("reverse", "true");
            const query = params.toString();
            const url = `/api/collections/${encodeURIComponent(collection)}/${encodeURIComponent(document)}${
                query ? `?${query}` : ""
            }`;

            const { records: recs } = await fetchJSON<{ records: Array<{ ts: number; data: string }> }>(url);

            if (
                recordsRequestToken !== requestToken ||
                selectedCollection !== collection ||
                selectedDocument !== document
            ) {
                return;
            }

            records = recs ?? [];
        } catch (error) {
            if (
                recordsRequestToken !== requestToken ||
                selectedCollection !== collection ||
                selectedDocument !== document
            ) {
                return;
            }
            console.error(error);
            recordsError = error instanceof Error ? error.message : "Failed to load records";
            records = [];
        }
    }

    async function selectCollection(collection: string) {
        selectedCollection = collection;
        selectedDocument = null;
        records = [];
        await loadDocuments(collection);
    }

    async function selectDocument(document: string) {
        if (!selectedCollection) return;
        selectedDocument = document;
        await loadRecords(selectedCollection, document);
    }

    function formatTimestamp(ts: number) {
        const date = new Date(ts * 1000);
        return date.toLocaleString(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
        });
    }

    onMount(async () => {
        if (selectedCollection) {
            await loadDocuments(selectedCollection);
        }
    });

    function openCollectionConfirm(collection: string) {
        confirmState = { action: "collection", name: collection };
        confirmInput = "";
        confirmError = null;
        confirmLoading = false;
    }

    function openDocumentConfirm(document: string) {
        if (!selectedCollection) return;
        confirmState = { action: "document", name: document, collection: selectedCollection };
        confirmInput = "";
        confirmError = null;
        confirmLoading = false;
    }

    function closeConfirm() {
        confirmState = null;
        confirmInput = "";
        confirmError = null;
        confirmLoading = false;
    }

    async function submitConfirm() {
        if (!confirmState) return;
        confirmError = null;

        if (confirmInput.trim() !== confirmState.name) {
            confirmError = "Name does not match.";
            return;
        }

        confirmLoading = true;

        try {
            if (confirmState.action === "collection") {
                const name = confirmState.name;
                const res = await fetch(`/api/collections/${encodeURIComponent(name)}`, {
                    method: "DELETE",
                });
                if (!res.ok) {
                    throw new Error(await res.text());
                }
                collections = collections.filter((item) => item !== name);
                if (selectedCollection === name) {
                    const next = collections[0] ?? null;
                    selectedCollection = next;
                    selectedDocument = null;
                    documents = [];
                    records = [];
                    if (next) {
                        await loadDocuments(next);
                    }
                }
            } else {
                const { collection, name: document } = confirmState;
                const res = await fetch(
                    `/api/collections/${encodeURIComponent(collection)}/${encodeURIComponent(document)}`,
                    { method: "DELETE" }
                );
                if (!res.ok) {
                    throw new Error(await res.text());
                }
                if (collection === selectedCollection) {
                    documents = documents.filter((item) => item !== document);
                    if (selectedDocument === document) {
                        const next = documents[0] ?? null;
                        selectedDocument = next;
                        records = [];
                        if (next) {
                            await loadRecords(collection, next);
                        }
                    }
                }
            }

            closeConfirm();
        } catch (error) {
            console.error(error);
            confirmError = "Failed to delete. Please try again.";
        } finally {
            confirmLoading = false;
        }
    }

    $effect(() => {
        if (confirmState && confirmInputRef) {
            confirmInputRef.focus();
            confirmInputRef.select();
        }
    });
</script>

<div class="min-h-screen bg-slate-100 text-slate-900">
    <nav class="border-b border-slate-200 bg-white">
        <div class="flex h-14 items-center justify-between px-8">
            <h1 class="text-lg font-semibold tracking-tight text-slate-900">FluxionDB Dashboard</h1>
            <div class="text-sm text-slate-500">Real-time time series control panel</div>
        </div>
    </nav>

    <main class="px-0 py-0">
        <div class="flex h-[calc(100vh-3.5rem)] w-full divide-x divide-slate-200">
            <section class="flex basis-[320px] flex-col bg-white">
                <div class="flex items-center gap-2 border-b border-slate-200">
                    <div class="flex flex-1 items-center gap-2">
                        <div class="relative flex-1">
                            <Search
                                class="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                aria-hidden="true"
                            />
                            <input
                                bind:value={collectionSearch}
                                placeholder="Search collections..."
                                class="w-full bg-white pl-8 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        class="ms-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:text-slate-300"
                        onclick={refreshCollections}
                        disabled={collectionsLoading}
                        aria-label="Refresh collections"
                    >
                        <RotateCcw class={`h-4 w-4${collectionsLoading ? " animate-spin" : ""}`} aria-hidden="true" />
                    </button>
                </div>
                <div class="flex-1 space-y-[1px] overflow-auto bg-slate-100/80">
                    {#if collections.length === 0}
                        <p class="px-3 py-2 text-sm text-slate-500">No collections available.</p>
                    {:else}
                        {#each filteredCollections as collection}
                            <button
                                class="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-sm transition {selectedCollection ===
                                collection
                                    ? 'bg-blue-100 text-blue-700 font-medium'
                                    : 'bg-white text-slate-700 hover:bg-slate-100'}"
                                onclick={() => selectCollection(collection)}
                            >
                                <span class="truncate font-mono">{collection}</span>
                                <span
                                    role="button"
                                    tabindex="0"
                                    class="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                                    onclick={(event) => {
                                        event.stopPropagation();
                                        openCollectionConfirm(collection);
                                    }}
                                    onkeydown={(event) => {
                                        event.stopPropagation();
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            openCollectionConfirm(collection);
                                        }
                                    }}
                                    aria-label={`Delete ${collection}`}
                                >
                                    <Trash2 class="h-4 w-4" aria-hidden="true" />
                                </span>
                            </button>
                        {/each}
                    {/if}
                </div>
            </section>

            <section class="flex basis-[320px] flex-col bg-white">
                <div class="flex items-center gap-2 border-b border-slate-200">
                    <div class="flex flex-1 items-center gap-2">
                        <div class="relative flex-1">
                            <Search
                                class="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                aria-hidden="true"
                            />
                            <input
                                bind:value={documentSearch}
                                placeholder={selectedCollection
                                    ? `Search ${selectedCollection}...`
                                    : "Search documents..."}
                                class="w-full bg-white pl-8 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        class="ms-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:text-slate-300"
                        onclick={refreshDocuments}
                        disabled={documentsLoading || !selectedCollection}
                        aria-label="Refresh documents"
                    >
                        <RotateCcw class={`h-4 w-4${documentsLoading ? " animate-spin" : ""}`} aria-hidden="true" />
                    </button>
                </div>
                <div class="flex-1 space-y-[1px] overflow-auto bg-slate-100/80">
                    {#if documentsError}
                        <p class="px-3 py-2 text-sm text-rose-500">{documentsError}</p>
                    {:else if !selectedCollection}
                        <p class="px-3 py-2 text-sm text-slate-500">Select a collection to view documents.</p>
                    {:else if documents.length === 0}
                        <p class="px-3 py-2 text-sm text-slate-500">No documents found.</p>
                    {:else}
                        {#each filteredDocuments as document}
                            <button
                                class="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-sm transition {selectedDocument ===
                                document
                                    ? 'bg-emerald-100 text-emerald-700 font-medium'
                                    : 'bg-white text-slate-700 hover:bg-slate-100'}"
                                onclick={() => selectDocument(document)}
                            >
                                <span class="truncate font-mono">{document}</span>
                                <span
                                    role="button"
                                    tabindex="0"
                                    class="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                                    onclick={(event) => {
                                        event.stopPropagation();
                                        openDocumentConfirm(document);
                                    }}
                                    onkeydown={(event) => {
                                        event.stopPropagation();
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            openDocumentConfirm(document);
                                        }
                                    }}
                                    aria-label={`Delete ${document}`}
                                >
                                    <Trash2 class="h-4 w-4" aria-hidden="true" />
                                </span>
                            </button>
                        {/each}
                    {/if}
                </div>
            </section>

            <section class="flex min-h-0 flex-1 flex-col bg-white">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
                    <div>
                        {#if selectedCollection && selectedDocument}
                            <p class="text-sm text-slate-500">
                                {selectedCollection} / {selectedDocument}
                            </p>
                        {/if}
                    </div>
                </div>

                <div class="flex-1 space-y-[2px] overflow-auto bg-slate-50">
                    {#if recordsError}
                        <p class="text-sm text-rose-500">{recordsError}</p>
                    {:else if !selectedDocument}
                        <p class="text-sm text-slate-500">Select a document to view its records.</p>
                    {:else if records.length === 0}
                        <p class="text-sm text-slate-500">No records found for this document.</p>
                    {:else}
                        {#each records as record, index (`${record.ts}:${index}`)}
                            <article class="bg-white p-2">
                                <div class="flex items-center justify-between text-xs text-slate-500 font-mono">
                                    <span>{formatTimestamp(record.ts)}</span>
                                    <span class="text-slate-400">{record.ts}</span>
                                </div>
                                <pre
                                    class="mt-1 overflow-x-auto rounded border border-slate-300 bg-slate-100 p-1 text-xs text-slate-800">{record.data}</pre>
                            </article>
                        {/each}
                    {/if}
                </div>
            </section>
        </div>
    </main>

    {#if confirmState}
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
            role="presentation"
            tabindex="-1"
            onclick={(event) => {
                if (event.target === event.currentTarget) {
                    closeConfirm();
                }
            }}
            onkeydown={(event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    closeConfirm();
                }
            }}
        >
            <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
                <h2 class="text-lg font-semibold text-slate-900">
                    Delete {confirmState.action === "collection" ? "collection" : "document"}
                </h2>
                <p class="mt-2 text-sm text-slate-600">
                    Type <span class="font-semibold text-slate-900">{confirmState.name}</span> to confirm deletion.
                </p>
                <form
                    class="mt-4 space-y-4"
                    onsubmit={(event) => {
                        event.preventDefault();
                        submitConfirm();
                    }}
                >
                    <input
                        bind:this={confirmInputRef}
                        bind:value={confirmInput}
                        placeholder={confirmState.name}
                        class="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
                    />
                    {#if confirmError}
                        <p class="text-sm text-rose-500">{confirmError}</p>
                    {/if}
                    <div class="flex justify-end gap-3">
                        <button
                            type="button"
                            class="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                            onclick={closeConfirm}
                            disabled={confirmLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                            disabled={confirmLoading || confirmInput.trim() !== confirmState.name}
                        >
                            {confirmLoading ? "Deleting…" : "Delete"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    {/if}
</div>
