"use client";

import { useState, useRef } from "react";
import { importExcel, exportExcel, exportCsv } from "@/lib/api";

interface ImportExportProps {
    onImportComplete?: () => void;
}

export default function ImportExport({ onImportComplete }: ImportExportProps) {
    const [importing, setImporting] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [exportingCsv, setExportingCsv] = useState(false);
    const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        setResult(null);
        try {
            const res = await importExcel(file);
            setResult(res);
            onImportComplete?.();
        } catch (err) {
            setResult({ imported: 0, errors: ["Import failed. Ensure the file format matches the original Excel."] });
        } finally {
            setImporting(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Import */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Import Excel</h4>
                    <p className="text-xs text-gray-500 mb-4">
                        Upload an Excel file matching the original format. This replaces all existing schedules.
                    </p>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImport}
                        className="hidden"
                        id="import-file"
                    />
                    <label
                        htmlFor="import-file"
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${importing
                                ? "bg-gray-100 text-gray-400 cursor-wait"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        {importing ? "Importing..." : "Choose File"}
                    </label>
                </div>

                {/* Export Excel */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Export Excel</h4>
                    <p className="text-xs text-gray-500 mb-4">
                        Download schedules as an Excel file matching the original format.
                    </p>
                    <button
                        onClick={async () => {
                            setExportingExcel(true);
                            try { await exportExcel(); } catch (e) { console.error(e); }
                            finally { setExportingExcel(false); }
                        }}
                        disabled={exportingExcel}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {exportingExcel ? "Exporting..." : "Export .xlsx"}
                    </button>
                </div>

                {/* Export CSV */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Export CSV</h4>
                    <p className="text-xs text-gray-500 mb-4">
                        Download schedules as a lightweight CSV file.
                    </p>
                    <button
                        onClick={async () => {
                            setExportingCsv(true);
                            try { await exportCsv(); } catch (e) { console.error(e); }
                            finally { setExportingCsv(false); }
                        }}
                        disabled={exportingCsv}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {exportingCsv ? "Exporting..." : "Export .csv"}
                    </button>
                </div>
            </div>

            {result && (
                <div className={`rounded-xl border p-4 ${result.errors?.length ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
                    <p className="font-semibold text-sm">
                        {result.imported > 0 ? `Successfully imported ${result.imported} schedules` : "Import completed"}
                    </p>
                    {result.errors?.length > 0 && (
                        <ul className="mt-2 text-xs text-red-700 list-disc list-inside">
                            {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
