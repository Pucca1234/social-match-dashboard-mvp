export type ErrorLogItem = {
  id: string;
  message: string;
  detail?: string;
  time: string;
};

type ErrorLogPanelProps = {
  logs: ErrorLogItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
};

export default function ErrorLogPanel({ logs, isOpen, onToggle, onClear }: ErrorLogPanelProps) {
  return (
    <div className={`error-log ${isOpen ? "is-open" : ""}`}>
      <button type="button" className="error-log-toggle" onClick={onToggle}>
        Error Log ({logs.length})
      </button>
      {isOpen && (
        <div className="error-log-panel">
          <div className="error-log-header">
            <span>최근 오류</span>
            <button type="button" onClick={onClear}>
              비우기
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="error-log-empty">오류 로그가 없습니다.</div>
          ) : (
            <ul className="error-log-list">
              {logs.map((log) => (
                <li key={log.id}>
                  <div className="error-log-message">{log.message}</div>
                  <div className="error-log-meta">{log.time}</div>
                  {log.detail && <pre className="error-log-detail">{log.detail}</pre>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
