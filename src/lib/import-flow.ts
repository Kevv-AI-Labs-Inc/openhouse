export function normalizeAddressImportInput(input: {
  query?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}) {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  const address = typeof input.address === "string" ? input.address.trim() : "";
  const city = typeof input.city === "string" ? input.city.trim() : "";
  const state = typeof input.state === "string" ? input.state.trim() : "";
  const postalCode =
    typeof input.postalCode === "string" ? input.postalCode.trim() : "";

  return {
    query: query || address,
    address: address || query,
    city: city || undefined,
    state: state || undefined,
    postalCode: postalCode || undefined,
  };
}
