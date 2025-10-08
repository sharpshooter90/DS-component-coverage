import React from "react";

interface ErrorMessageProps {
  message: string;
  onDismiss: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onDismiss }) => {
  return (
    <div className="error-message">
      <div className="error-message-text">{message}</div>
      <button className="error-dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
};

export default ErrorMessage;
