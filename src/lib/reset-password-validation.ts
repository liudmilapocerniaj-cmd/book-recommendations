export function validateResetPassword(password: string, confirmation: string): string | null {
  if (!password.trim()) return "Įveskite naują slaptažodį.";
  if (password.length < 8) return "Slaptažodį turi sudaryti bent 8 simboliai.";
  if (password !== confirmation) return "Slaptažodžiai nesutampa.";
  return null;
}
