/* Настройки Промосети. Заполните два значения из Supabase:
   Project Settings → API → Project URL и anon public key.
   Ключ anon публичный по замыслу Supabase: данные защищены входом по паролю и правилами доступа в базе. */
window.PROMOSET_CONFIG = {
  supabaseUrl: "https://kkxetvreetaffbpvlfpj.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtreGV0dnJlZXRhZmZicHZsZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MzYxNjYsImV4cCI6MjEwODAxMjE2Nn0.q8Y0Vl4IBp1gHLldwNEPz43rCLRBASaWwbEiHrzOjSM",
  tiles: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">участники OpenStreetMap</a>',
    maxNativeZoom: 19
  }
};
