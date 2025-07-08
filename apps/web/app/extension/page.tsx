"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("extension");

export default function ExtensionPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const threadId = searchParams.get("threadId");
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [iframeSrc, setIframeSrc] = useState<string>("/automation");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (token) {
      validateSessionToken();
    } else {
      setError("No session token provided");
      setIsValidating(false);
    }
  }, [token]);

  useEffect(() => {
    // Listen for messages from the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === "UPDATE_IFRAME_SRC") {
        const { url } = event.data;
        setIframeSrc(url);
        logger.info("Updating iframe src", { url });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const validateSessionToken = async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/extension/verify-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsValid(true);
        setUserData(data);
        // Store the token for the main app to use
        if (typeof window !== "undefined") {
          sessionStorage.setItem("extensionToken", token);
          sessionStorage.setItem("extensionUser", JSON.stringify(data));
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Invalid session token");
      }
    } catch (error) {
      logger.error("Error validating session token:", { error });
      setError("Failed to validate session token");
    } finally {
      setIsValidating(false);
    }
  };

  // Determine the initial iframe src based on threadId
  useEffect(() => {
    if (isValid && userData && threadId) {
      // If we have a threadId, open the assistant page
      const assistantUrl = `/assistant?threadId=${threadId}`;
      setIframeSrc(assistantUrl);
      logger.info("Setting iframe to assistant with threadId", {
        threadId,
        assistantUrl,
      });
    } else if (isValid && userData) {
      // Default to automation page
      setIframeSrc("/automation");
    }
  }, [isValid, userData, threadId]);

  if (isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Validating session...</p>
        </div>
      </div>
    );
  }

  if (!isValid || error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
            {error || "Invalid session"}
          </div>
          <p className="text-gray-600">
            Please re-authenticate in the extension.
          </p>
        </div>
      </div>
    );
  }

  // If we have a valid session token, load the main app content
  if (isValid && token && userData) {
    return (
      <div className="h-screen w-full">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="h-full w-full border-0"
          title="Inbox Zero"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
