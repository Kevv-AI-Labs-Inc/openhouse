const NEW_EVENT_REQUEST_KEY = "openhouse:new-event-request";
const NEW_EVENT_EVENT_NAME = "openhouse:new-event";

export function requestNewEventDialog() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NEW_EVENT_REQUEST_KEY, String(Date.now()));
  window.dispatchEvent(new CustomEvent(NEW_EVENT_EVENT_NAME));
}

export function consumeNewEventDialogRequest() {
  if (typeof window === "undefined") return false;

  const query = new URLSearchParams(window.location.search);
  const requestedViaQuery = query.get("new") === "1";
  const requestedViaStorage = Boolean(sessionStorage.getItem(NEW_EVENT_REQUEST_KEY));

  if (requestedViaQuery || requestedViaStorage) {
    sessionStorage.removeItem(NEW_EVENT_REQUEST_KEY);
    return true;
  }

  return false;
}

export function clearNewEventDialogRequest() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(NEW_EVENT_REQUEST_KEY);
}

export function subscribeToNewEventDialogRequest(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleRequest = () => listener();
  window.addEventListener(NEW_EVENT_EVENT_NAME, handleRequest);
  return () => window.removeEventListener(NEW_EVENT_EVENT_NAME, handleRequest);
}
