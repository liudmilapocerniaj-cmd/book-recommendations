// Lithuanian display text only; this does not change how requests are handled.
const messages: Record<string, string> = {
  same_password: "Naujas slaptažodis turi skirtis nuo dabartinio.",
  otp_expired: "Atkūrimo nuoroda nebegalioja. Paprašykite naujos nuorodos.",
  reauthentication_needed: "Atkūrimo sesija nebegalioja. Paprašykite naujos atkūrimo nuorodos.",
  invalid_credentials: "Neteisingas el. paštas arba slaptažodis.",
  email_not_confirmed: "Prieš prisijungdami patvirtinkite el. pašto adresą gautame laiške.",
  user_already_exists: "Paskyra su šiuo el. pašto adresu jau yra. Prisijunkite.",
  email_exists: "Šis el. pašto adresas jau naudojamas.",
  weak_password: "Slaptažodis per silpnas. Pasirinkite ilgesnį ir sudėtingesnį slaptažodį.",
  over_email_send_rate_limit: "Pasiektas laiškų siuntimo limitas. Bandykite vėliau.",
  over_request_rate_limit: "Per daug bandymų. Šiek tiek palaukite ir bandykite dar kartą.",
  email_address_not_authorized: "Šiuo el. pašto adresu patvirtinimo laiško išsiųsti negalima.",
  email_address_invalid: "Įveskite galiojantį el. pašto adresą.",
  signup_disabled: "Šiuo metu registracija išjungta.",
  session_not_found: "Prisijungimo sesija baigėsi. Prisijunkite iš naujo.",
  refresh_token_not_found: "Prisijungimo sesija baigėsi. Prisijunkite iš naujo.",
  "42501": "Neturite teisės atlikti šio veiksmo.",
  "23502": "Užpildykite visus privalomus laukus.",
  "Invalid login credentials": "Neteisingas el. paštas arba slaptažodis.",
  "Failed to fetch": "Nepavyko prisijungti prie serverio. Patikrinkite interneto ryšį ir bandykite dar kartą.",
};

const localMessages = new Set([
  "Prieš kurdami rekomendaciją prisijunkite iš naujo.",
  "Neturite teisės redaguoti šios rekomendacijos.",
  "Rekomendacija nerasta arba pakeitimai neleidžiami.",
  "Rekomendacija nerasta arba neturite teisės jos ištrinti.",
]);

export function uiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  if (localMessages.has(message)) return message;
  return messages[code] ?? messages[message] ?? fallback;
}
