"use client";

import { useState, useEffect } from "react";
import { Announcement } from "@/lib/types";
import {
    getAllAnnouncements,
    createAnnouncement,
    deleteAnnouncement,
    toggleAnnouncement,
} from "@/lib/api";

export default function AnnouncementsPanel() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [type, setType] = useState("info");

    const load = () => {
        setLoading(true);
        getAllAnnouncements()
            .then(setAnnouncements)
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async () => {
        if (!title || !message) return;
        await createAnnouncement({ title, message, type });
        setTitle("");
        setMessage("");
        setType("info");
        setShowForm(false);
        load();
    };

    const handleToggle = async (id: number) => {
        await toggleAnnouncement(id);
        load();
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Delete this announcement?")) return;
        await deleteAnnouncement(id);
        load();
    };

    const typeColors: Record<string, string> = {
        info: "bg-blue-50 border-blue-200 text-blue-800",
        warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
        urgent: "bg-red-50 border-red-200 text-red-800",
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{announcements.length} Announcements</h3>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                    + New Announcement
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <input
                        type="text"
                        placeholder="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <textarea
                        placeholder="Message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="flex gap-3">
                        <select value={type} onChange={(e) => setType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="urgent">Urgent</option>
                        </select>
                        <button onClick={handleCreate} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700">
                            Publish
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {announcements.map((a) => (
                    <div
                        key={a.id}
                        className={`rounded-xl border p-4 ${a.active ? typeColors[a.type] || typeColors.info : "bg-gray-50 border-gray-200 opacity-60"}`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-sm">{a.title}</h4>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/50">{a.type}</span>
                                    {!a.active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Inactive</span>}
                                </div>
                                <p className="text-sm mt-1 opacity-80">{a.message}</p>
                                <p className="text-xs mt-2 opacity-60">
                                    By {a.createdBy} &bull; {new Date(a.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <div className="flex gap-2 ml-4 shrink-0">
                                <button
                                    onClick={() => handleToggle(a.id)}
                                    className="text-xs font-medium px-2 py-1 rounded hover:bg-white/50"
                                >
                                    {a.active ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                    onClick={() => handleDelete(a.id)}
                                    className="text-xs font-medium text-red-600 px-2 py-1 rounded hover:bg-white/50"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {announcements.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No announcements yet.</div>
                )}
            </div>
        </div>
    );
}
