import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import './DirectChatPanel.css';

/**
 * Assigned student↔trainer chat (REST + polling).
 * @param {{ role: 'student' | 'teacher', currentUserId: string }} props
 */
function DirectChatPanel({ role, currentUserId }) {
  const [peers, setPeers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activePeerId, setActivePeerId] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const threadRef = useRef(null);
  const sinceRef = useRef(null);

  const api = getApiBaseUrl();
  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const loadPeersAndInbox = useCallback(async () => {
    try {
      const [peersRes, convRes] = await Promise.all([
        fetch(`${api}/api/chat/peers`, { headers: authHeaders() }),
        fetch(`${api}/api/chat/conversations`, { headers: authHeaders() })
      ]);
      const peersJson = peersRes.ok ? await peersRes.json() : { peers: [] };
      const convJson = convRes.ok ? await convRes.json() : { conversations: [] };
      setPeers(peersJson.peers || []);
      setConversations(convJson.conversations || []);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Unable to load messages right now.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadMessages = useCallback(
    async (convoId, { incremental = false } = {}) => {
      if (!convoId) return;
      try {
        let url = `${api}/api/chat/conversations/${convoId}/messages`;
        if (incremental && sinceRef.current) {
          url += `?since=${encodeURIComponent(sinceRef.current)}`;
        }
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const list = data.messages || [];
        if (incremental) {
          if (list.length) {
            setMessages((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              const merged = [...prev];
              list.forEach((m) => {
                if (!seen.has(m.id)) merged.push(m);
              });
              return merged;
            });
          }
        } else {
          setMessages(list);
        }
        if (list.length) {
          const last = list[list.length - 1];
          sinceRef.current = last.createdAt;
        }
      } catch (err) {
        console.error(err);
      }
    },
    [api]
  );

  const openPeer = useCallback(
    async (peerId) => {
      setActivePeerId(peerId);
      sinceRef.current = null;
      setMessages([]);
      const existing = conversations.find((c) => String(c.peerId) === String(peerId));
      if (existing?.id) {
        setConversationId(existing.id);
        await loadMessages(existing.id, { incremental: false });
      } else {
        setConversationId('');
      }
    },
    [conversations, loadMessages]
  );

  useEffect(() => {
    loadPeersAndInbox();
  }, [loadPeersAndInbox]);

  useEffect(() => {
    if (!activePeerId && peers.length === 1) {
      openPeer(peers[0].id);
    }
  }, [peers, activePeerId, openPeer]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadPeersAndInbox();
      if (conversationId) {
        loadMessages(conversationId, { incremental: true });
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [conversationId, loadPeersAndInbox, loadMessages]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, activePeerId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !activePeerId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${api}/api/chat/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ peerId: activePeerId, text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Failed to send message');
        return;
      }
      setDraft('');
      setConversationId(data.conversationId || conversationId);
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        sinceRef.current = data.message.createdAt;
      }
      await loadPeersAndInbox();
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const peerList = (() => {
    const map = new Map();
    peers.forEach((p) => map.set(String(p.id), { ...p, unread: 0 }));
    conversations.forEach((c) => {
      const id = String(c.peerId);
      const prev = map.get(id) || {
        id,
        name: c.peerName,
        role: c.peerRole,
        isAvailable: c.isAvailable,
        batchName: ''
      };
      map.set(id, {
        ...prev,
        name: c.peerName || prev.name,
        unread: c.unread || 0,
        isAvailable: typeof c.isAvailable === 'boolean' ? c.isAvailable : prev.isAvailable,
        lastMessagePreview: c.lastMessagePreview || '',
        lastMessageAt: c.lastMessageAt
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });
  })();

  const activePeer = peerList.find((p) => String(p.id) === String(activePeerId));

  if (loading) {
    return (
      <div className="dc-panel">
        <p className="dc-empty">Loading messages…</p>
      </div>
    );
  }

  return (
    <div className="dc-panel">
      <aside className="dc-peers">
        <div className="dc-peers__head">
          {role === 'student' ? 'Your trainers' : 'Your students'}
        </div>
        {peerList.length === 0 ? (
          <p className="dc-empty dc-empty--side">
            {role === 'student'
              ? 'No trainer assigned yet.'
              : 'No students assigned to your batches yet.'}
          </p>
        ) : (
          peerList.map((peer) => (
            <button
              key={peer.id}
              type="button"
              className={`dc-peer ${String(peer.id) === String(activePeerId) ? 'is-active' : ''}`}
              onClick={() => openPeer(peer.id)}
            >
              <div className="dc-peer__row">
                <span className="dc-peer__name">{peer.name}</span>
                {peer.unread > 0 && <span className="dc-peer__unread">{peer.unread}</span>}
              </div>
              {(peer.batchName || peer.lastMessagePreview) && (
                <span className="dc-peer__meta">
                  {peer.lastMessagePreview || peer.batchName}
                </span>
              )}
            </button>
          ))
        )}
      </aside>

      <section className="dc-thread">
        {!activePeerId ? (
          <div className="dc-empty">Select a conversation to start messaging.</div>
        ) : (
          <>
            <div className="dc-thread__head">
              <div>
                <strong>{activePeer?.name || 'Chat'}</strong>
                {activePeer?.batchName && (
                  <span className="dc-thread__sub">{activePeer.batchName}</span>
                )}
              </div>
            </div>

            <div className="dc-thread__messages" ref={threadRef}>
              {messages.length === 0 ? (
                <p className="dc-empty">No messages yet. Say hello.</p>
              ) : (
                messages.map((m) => {
                  const mine = String(m.senderId) === String(currentUserId);
                  return (
                    <div
                      key={m.id}
                      className={`dc-bubble ${mine ? 'dc-bubble--mine' : 'dc-bubble--theirs'}`}
                    >
                      <p>{m.text}</p>
                      <time>
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : ''}
                      </time>
                    </div>
                  );
                })
              )}
            </div>

            {error && <p className="dc-error">{error}</p>}

            <form className="dc-composer" onSubmit={sendMessage}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                maxLength={2000}
                disabled={sending}
              />
              <button type="submit" className="ss-shell-btn ss-shell-btn--primary" disabled={sending || !draft.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export default DirectChatPanel;
