"use client";

import { useEffect, useState } from "react";
import { getSocket } from "../../../components/socket";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export default function PortalNotificationsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);

  async function load() {
    if (!token) {
      return;
    }

    const data = await apiFetch<NotificationItem[]>("/portal/notifications", { token });
    setItems(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = getSocket(token);
    socket.emit("subscribe.notifications", {});

    const onNotification = () => {
      load();
    };

    socket.on("notification.created", onNotification);

    return () => {
      socket.off("notification.created", onNotification);
    };
  }, [token]);

  async function markRead(notificationId: string) {
    if (!token) {
      return;
    }

    await apiFetch(`/portal/notifications/${notificationId}/read`, {
      method: "POST",
      token
    });

    await load();
  }

  return (
    <section>
      <h3>Notifications</h3>
      <div className="panel-list section-gap">
        {items.map((item) => (
          <article key={item.id} className={item.readAt ? "read-notification" : ""}>
            <header>
              <strong>{item.title}</strong>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </header>
            <p>{item.message}</p>
            {!item.readAt ? <button onClick={() => markRead(item.id)}>Mark as read</button> : <small>Read</small>}
          </article>
        ))}
      </div>
    </section>
  );
}
