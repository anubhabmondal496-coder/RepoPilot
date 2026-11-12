// Test fixture for RepoPilot background intelligence
// Open this file in the Extension Development Host to see active Problems diagnostics.

export async function checkBackendHealth() {
  // Valid route: matches @app.get("/api/v1/health") in backend.py
  const response = await fetch('/api/v1/health');
  return response.json();
}

export async function fetchUserById(userId: string) {
  // Valid route: matches @app.get("/api/v1/users/{id}") via parameter normalization
  const response = await fetch(`/api/v1/users/${userId}`);
  return response.json();
}

export async function triggerOrphanedRouteMismatch() {
  // Intentional route mismatch: this endpoint does NOT exist in backend.py
  // RepoPilot will flag an Error diagnostic in the Problems panel on this line!
  const response = await fetch('/api/v1/nonexistent-route');
  return response.json();
}

export async function triggerSecondRouteMismatch() {
  // Intentional route mismatch: missing endpoint
  // RepoPilot will flag an Error diagnostic in the Problems panel on this line!
  const response = await fetch('/api/v1/billing/invoices');
  return response.json();
}
