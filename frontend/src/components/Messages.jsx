import { useDisplayedMessages } from '../context/MessagesContext.jsx';

/** The `{% if messages %}` block of base.html. */
export default function Messages() {
  const messages = useDisplayedMessages();
  if (!messages.length) return null;
  return (
    <div style={{ padding: '0 var(--spacing-lg)', margin: 'var(--spacing-md) 0' }}>
      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.level || ''}`}>
            {m.text}
          </div>
        ))}
      </div>
    </div>
  );
}
