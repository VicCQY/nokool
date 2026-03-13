"use client";

import { useState, useRef, useCallback } from "react";

interface ImportResult {
  politiciansCreated: number;
  politiciansUpdated: number;
  promisesCreated: number;
  statusChangesCreated: number;
}

interface LastImport {
  date: string;
  politiciansCreated: number;
  politiciansUpdated: number;
  promisesCreated: number;
  statusChangesCreated: number;
}

function getLastImport(): LastImport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("nokool-last-import");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastImport(result: ImportResult) {
  localStorage.setItem(
    "nokool-last-import",
    JSON.stringify({ date: new Date().toISOString(), ...result })
  );
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [clearFirst, setClearFirst] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "importing" | "success" | "error" | "validation"
  >("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [lastImport, setLastImport] = useState<LastImport | null>(
    getLastImport()
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File | null) => {
    if (f && f.name.endsWith(".xlsx")) {
      setFile(f);
      setStatus("idle");
      setErrors([]);
      setErrorMessage("");
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("importing");
    setErrors([]);
    setErrorMessage("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("clearFirst", clearFirst ? "true" : "false");

      const res = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus("success");
        setResult(data.summary);
        saveLastImport(data.summary);
        setLastImport({
          date: new Date().toISOString(),
          ...data.summary,
        });
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      } else if (res.status === 422 && data.errors) {
        setStatus("validation");
        setErrors(data.errors);
      } else {
        setStatus("error");
        setErrorMessage(data.error || "An unexpected error occurred");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error — could not reach the server");
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Import Data</h1>
      <p className="text-sm text-gray-500 mb-8">
        Upload an Excel spreadsheet (.xlsx) to bulk import politicians,
        promises, and status history. Use the NoKool data template.
      </p>

      {/* Download template */}
      <div className="mb-8">
        <a
          href="/api/admin/template"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <svg
            className="h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download Template
        </a>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-50"
              : file
                ? "border-green-300 bg-green-50"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <svg
                className="h-10 w-10 text-green-500 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {(file.size / 1024).toFixed(1)} KB — Click or drop to replace
              </p>
            </>
          ) : (
            <>
              <svg
                className="h-10 w-10 text-gray-300 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <p className="text-sm font-medium text-gray-600">
                Drop your .xlsx file here, or click to browse
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Only Excel (.xlsx) files are accepted
              </p>
            </>
          )}
        </div>

        {/* Clear data checkbox */}
        <label className="mt-5 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={clearFirst}
            onChange={(e) => setClearFirst(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">
              Clear existing data first
            </span>
            <p className="text-xs text-red-500 mt-0.5">
              This will delete ALL existing politicians, promises, votes,
              donations, and lobbying records before importing. Cannot be
              undone.
            </p>
          </div>
        </label>

        {/* Import button */}
        <button
          type="submit"
          disabled={!file || status === "importing"}
          className="mt-6 w-full sm:w-auto rounded-lg bg-[#0D0D0D] px-8 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "importing" ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Importing...
            </span>
          ) : (
            "Import"
          )}
        </button>
      </form>

      {/* Success */}
      {status === "success" && result && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
          <h3 className="text-sm font-semibold text-green-800 mb-2">
            Import successful
          </h3>
          <ul className="text-sm text-green-700 space-y-1">
            {result.politiciansCreated > 0 && (
              <li>
                {result.politiciansCreated} politician
                {result.politiciansCreated !== 1 ? "s" : ""} created
              </li>
            )}
            {result.politiciansUpdated > 0 && (
              <li>
                {result.politiciansUpdated} politician
                {result.politiciansUpdated !== 1 ? "s" : ""} updated
              </li>
            )}
            <li>
              {result.promisesCreated} promise
              {result.promisesCreated !== 1 ? "s" : ""} imported
            </li>
            {result.statusChangesCreated > 0 && (
              <li>
                {result.statusChangesCreated} status change
                {result.statusChangesCreated !== 1 ? "s" : ""} imported
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Validation errors */}
      {status === "validation" && errors.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-semibold text-red-800 mb-2">
            Validation failed — nothing was imported
          </h3>
          <p className="text-xs text-red-600 mb-3">
            Fix the following {errors.length} error
            {errors.length !== 1 ? "s" : ""} and try again:
          </p>
          <ul className="max-h-64 overflow-y-auto space-y-1 text-sm text-red-700">
            {errors.map((err, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-red-400 flex-shrink-0">&bull;</span>
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Server error */}
      {status === "error" && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-semibold text-red-800">Import failed</h3>
          <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
        </div>
      )}

      {/* Last import history */}
      {lastImport && (
        <div className="mt-8 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500">
            Last import:{" "}
            {new Date(lastImport.date).toLocaleString()} —{" "}
            {lastImport.politiciansCreated + lastImport.politiciansUpdated}{" "}
            politician
            {lastImport.politiciansCreated + lastImport.politiciansUpdated !== 1
              ? "s"
              : ""}
            , {lastImport.promisesCreated} promise
            {lastImport.promisesCreated !== 1 ? "s" : ""}
            {lastImport.statusChangesCreated > 0 && (
              <>
                , {lastImport.statusChangesCreated} status change
                {lastImport.statusChangesCreated !== 1 ? "s" : ""}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
