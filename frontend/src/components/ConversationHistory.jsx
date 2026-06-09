import "./ConversationHistory.css";

export function ConversationHistory({ onNewConversation }) {
  return (
    <div className="conv-history">
      <div className="conv-history__header">
        <h3 className="conv-history__title">💬 Conversaciones</h3>
        <button className="conv-history__new" onClick={onNewConversation}>
          + Nueva
        </button>
      </div>
      <p className="conv-history__empty">Sin historial guardado</p>
    </div>
  );
}
