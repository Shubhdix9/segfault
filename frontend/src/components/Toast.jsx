export default function Toast({ message, visible }) {
  return (
    <div id="toast" className={visible ? 'on' : ''} role="status" aria-live="polite">
      {message}
    </div>
  );
}
