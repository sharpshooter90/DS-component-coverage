import React from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { X } from "lucide-react";

interface ErrorMessageProps {
  message: string;
  onDismiss: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onDismiss }) => {
  return (
    <Card className="m-4 border-destructive bg-destructive/10">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="text-sm text-destructive flex-1">{message}</div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-6 w-6 text-destructive hover:bg-destructive/20"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default ErrorMessage;
